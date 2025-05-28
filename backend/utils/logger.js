const winston = require('winston');
const path = require('path');
const TimezoneUtils = require('./timezone');

// Define log format with IST timestamps
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: () => TimezoneUtils.nowForLogging()
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development with IST timestamps
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: () => TimezoneUtils.nowForLogging()
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaString = '';
    if (Object.keys(meta).length) {
      try {
        // Filter out circular references and non-serializable objects
        const cleanMeta = {};
        for (const [key, value] of Object.entries(meta)) {
          if (typeof value !== 'function' && typeof value !== 'symbol') {
            if (typeof value === 'object' && value !== null) {
              // For objects, only include simple properties
              if (value.constructor === Object || Array.isArray(value)) {
                cleanMeta[key] = value;
              } else {
                cleanMeta[key] = value.toString();
              }
            } else {
              cleanMeta[key] = value;
            }
          }
        }
        metaString = JSON.stringify(cleanMeta, null, 2);
      } catch (error) {
        metaString = '[Circular or non-serializable object]';
      }
    }
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'katomaran-backend' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create a stream object for Morgan HTTP request logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
