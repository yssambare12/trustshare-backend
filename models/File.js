const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  uploadedBy: {
    type: String,
    required: true,
  },
  sharedWith: {
    type: [String],
    default: [],
  },
  shareToken: {
    type: String,
    default: null,
  },
  sharedAt: {
    type: Date,
    default: null,
  },
  viewedBy: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("File", fileSchema);
