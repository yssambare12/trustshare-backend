const mongoose = require('mongoose');

// User schema with email and createdAt
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
