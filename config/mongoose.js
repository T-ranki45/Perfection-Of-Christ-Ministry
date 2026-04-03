const mongoose = require("mongoose");

const DEFAULT_MONGODB_URI =
  "mongodb+srv://perfection:Password123@churchwebsite.sv9kfnh.mongodb.net/?appName=ChurchWebsite";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.SONGS_MONGODB_URI ||
  DEFAULT_MONGODB_URI;

let connectionPromise = null;

async function connectMongoose() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2 && connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose.connect(MONGODB_URI, {
    dbName: process.env.DB_NAME || "pocm-db",
    serverSelectionTimeoutMS: 8000,
  });

  try {
    await connectionPromise;
    return mongoose.connection;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

module.exports = { connectMongoose };
