const User = require("../models/User");

const getUsers = async (req, res) => {
  try {
    const { excludeUserId } = req.query;
    const query = excludeUserId ? { _id: { $ne: excludeUserId } } : {};
    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUsers };
