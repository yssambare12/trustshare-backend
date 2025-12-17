const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const File = require("./models/File");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

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

app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = new User({ email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      userId: user._id,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      userId: user._id,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/users", authMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password');
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
    const { userId } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "User ID is required" });
    }

    const files = await File.find({
      $or: [
        { uploadedBy: userId },
        { sharedWith: userId }
      ]
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/share", async (req, res) => {
  try {
    const { fileId, userIds, ownerId } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "User IDs are required and must be an array" });
    }

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (file.uploadedBy !== ownerId) {
      return res.status(403).json({ error: "Only owner can share" });
    }

    const existingShares = file.sharedWith || [];
    const newShares = [...existingShares, ...userIds];
    file.sharedWith = [...new Set(newShares)];

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

    if (!userId) {
      return res.status(401).json({ error: "User ID is required" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(403).json({ error: "User not found. Only users with accounts can access shared files." });
    }

    const file = await File.findOne({ shareToken: token });

    if (!file) {
      return res.status(404).json({ error: "File not found or invalid share link" });
    }

    res.json(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/download/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "User ID is required" });
    }

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const isOwner = file.uploadedBy === userId;
    const isSharedWith = file.sharedWith.includes(userId);

    if (!isOwner && !isSharedWith) {
      return res.status(403).json({ error: "Access denied. You do not have permission to download this file." });
    }

    const filePath = path.join(__dirname, "uploads", file.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    res.download(filePath, file.originalName, (err) => {
      if (err) {
        console.error("Download error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error downloading file" });
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
