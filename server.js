const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const User = require("./models/User");
const File = require("./models/File");

dotenv.config();
const app = express();

app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

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
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { userId } = req.body;

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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
