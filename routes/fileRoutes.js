const express = require("express");
const {
  uploadFile,
  getFiles,
  getFilesByUserId,
  shareFile,
  generateShareLink,
  getFileByLink,
  downloadFile,
  getNotifications,
  markViewed
} = require("../controllers/fileController");

const router = express.Router();

router.post("/upload", uploadFile);
router.get("/files", getFiles);
router.get("/files/:userId", getFilesByUserId);
router.post("/share", shareFile);
router.post("/share-link", generateShareLink);
router.get("/file-by-link/:token", getFileByLink);
router.get("/download/:fileId", downloadFile);
router.get("/notifications", getNotifications);
router.post("/mark-viewed", markViewed);

module.exports = router;
