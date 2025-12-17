const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const User = require("./models/User");
const File = require("./models/File");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/json'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: images, PDF, CSV, Excel, Word, Text, ZIP, JSON`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Create a new user
app.post("/users", async (req, res) => {
  try {
    const { email } = req.body;
    const user = new User({ email });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload a file
app.post("/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const fileData = new File({
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        uploadedBy: userId,
      });

      await fileData.save();

      res.status(201).json(fileData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

app.get("/files", async (req, res) => {
  try {
    const files = await File.find();
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/share", async (req, res) => {
  try {
    const { fileId, userIds, ownerId } = req.body;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (file.uploadedBy !== ownerId) {
      return res.status(403).json({ error: "Only owner can share" });
    }

    file.sharedWith = userIds;
    await file.save();

    res.json(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/files/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const files = await File.find({
      $or: [{ uploadedBy: userId }, { sharedWith: userId }],
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/share-link", async (req, res) => {
  try {
    const { fileId } = req.body;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const token = Math.random().toString(36).substring(2, 15);
    file.shareToken = token;
    await file.save();

    res.json({ token, fileId: file._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/file-by-link/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { userId } = req.query;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(403).json({ error: "User not found" });
    }

    const file = await File.findOne({ shareToken: token });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (
      file.uploadedBy !== userId &&
      !file.sharedWith.includes(userId)
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
