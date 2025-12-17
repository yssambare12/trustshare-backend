const path = require("path");
const fs = require("fs");
const multer = require("multer");
const File = require("../models/File");
const User = require("../models/User");
const { upload, MAX_FILE_SIZE } = require("../config/upload");

const uploadFile = (req, res) => {
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
};

const getFiles = async (req, res) => {
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
};

const getFilesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const files = await File.find({
      $or: [{ uploadedBy: userId }, { sharedWith: userId }],
    });

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const shareFile = async (req, res) => {
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
    file.sharedAt = new Date();

    await file.save();

    res.json(file);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const generateShareLink = async (req, res) => {
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
};

const getFileByLink = async (req, res) => {
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
};

const downloadFile = async (req, res) => {
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

    const filePath = path.join(__dirname, "..", "uploads", file.filename);

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
};

const getNotifications = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "User ID is required" });
    }

    const sharedFiles = await File.find({
      sharedWith: userId,
      viewedBy: { $ne: userId }
    });

    res.json({
      count: sharedFiles.length,
      files: sharedFiles
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markViewed = async (req, res) => {
  try {
    const { fileId, userId } = req.body;

    if (!userId || !fileId) {
      return res.status(400).json({ error: "User ID and File ID are required" });
    }

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    if (!file.viewedBy.includes(userId)) {
      file.viewedBy.push(userId);
      await file.save();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  uploadFile,
  getFiles,
  getFilesByUserId,
  shareFile,
  generateShareLink,
  getFileByLink,
  downloadFile,
  getNotifications,
  markViewed
};
