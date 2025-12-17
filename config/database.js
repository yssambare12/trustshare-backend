const mongoose = require("mongoose");

mongoose.set("strictQuery", false);

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI environment variable is not set!");
    console.error("Please set MONGODB_URI in your environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
