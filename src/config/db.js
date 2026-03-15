// ============================================================
// Database Configuration - Connect to MongoDB 🗄️
// ============================================================
// This file handles connecting to our MongoDB database.
// MongoDB is where we store all our data: PDFs, chunks, questions,
// student answers, and profiles.

const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * This happens when the server starts up
 */
const connectDB = async () => {
  try {
    // Connect using the URI from our .env file
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 6+ doesn't need extra options, but we keep it simple
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Database Connection Error: ${error.message}`);
    // If we can't connect to the database, the server can't work
    // So we exit the process
    process.exit(1);
  }
};

/**
 * Disconnect from database gracefully
 * Called when the server is shutting down
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('👋 MongoDB connection closed.');
  } catch (error) {
    console.error(`⚠️  Error closing database connection: ${error.message}`);
  }
};

// Listen for connection events and log them
mongoose.connection.on('connected', () => {
  console.log('📊 Mongoose connected to database.');
});

mongoose.connection.on('error', (err) => {
  console.error(`💥 Mongoose connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('📊 Mongoose disconnected from database.');
});

// Export our connection functions
module.exports = { connectDB, disconnectDB };
