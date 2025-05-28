const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return true;

  } catch (error) {
    logger.error('Database connection failed:', error);
    console.error('❌ Database connection failed:', error.message);
    console.warn('⚠️  Server will continue running without database connection');
    console.warn('⚠️  Face registration and some features may not work properly');
    console.warn('⚠️  Please check MongoDB Atlas IP whitelist and connection string');

    // Don't exit - let the server run without database
    // This allows frontend to connect and show appropriate error messages
    return false;
  }
};

module.exports = connectDB;
