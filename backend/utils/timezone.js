const moment = require('moment-timezone');

// Set default timezone to IST
const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Timezone utility functions for IST (Indian Standard Time)
 */
class TimezoneUtils {
  /**
   * Get current IST timestamp in ISO format
   * @returns {string} ISO string with IST offset (+05:30)
   */
  static now() {
    return moment().tz(IST_TIMEZONE).format();
  }

  /**
   * Get current IST timestamp for logging
   * @returns {string} Formatted timestamp for logs
   */
  static nowForLogging() {
    return moment().tz(IST_TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Convert UTC date to IST
   * @param {Date|string} date - Date to convert
   * @returns {string} IST formatted date
   */
  static toIST(date) {
    return moment(date).tz(IST_TIMEZONE).format();
  }

  /**
   * Convert UTC date to IST for logging
   * @param {Date|string} date - Date to convert
   * @returns {string} IST formatted date for logs
   */
  static toISTForLogging(date) {
    return moment(date).tz(IST_TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Get IST Date object
   * @returns {Date} Date object adjusted for IST
   */
  static getISTDate() {
    return moment().tz(IST_TIMEZONE).toDate();
  }

  /**
   * Format date for API responses
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date for API
   */
  static formatForAPI(date) {
    return moment(date).tz(IST_TIMEZONE).format();
  }

  /**
   * Format date for database storage (still UTC but with IST context)
   * @param {Date|string} date - Date to format
   * @returns {Date} Date object for database
   */
  static formatForDatabase(date = null) {
    if (date) {
      return moment(date).tz(IST_TIMEZONE).utc().toDate();
    }
    return moment().tz(IST_TIMEZONE).utc().toDate();
  }

  /**
   * Parse IST date string to Date object
   * @param {string} dateString - IST date string
   * @returns {Date} Parsed date object
   */
  static parseIST(dateString) {
    return moment.tz(dateString, IST_TIMEZONE).toDate();
  }

  /**
   * Get timezone info
   * @returns {Object} Timezone information
   */
  static getTimezoneInfo() {
    const now = moment().tz(IST_TIMEZONE);
    return {
      timezone: IST_TIMEZONE,
      offset: now.format('Z'),
      abbreviation: 'IST',
      isDST: now.isDST(),
      utcOffset: now.utcOffset()
    };
  }

  /**
   * Format duration in human readable format
   * @param {number} seconds - Duration in seconds
   * @returns {string} Human readable duration
   */
  static formatDuration(seconds) {
    const duration = moment.duration(seconds, 'seconds');
    if (duration.asHours() >= 1) {
      return `${Math.floor(duration.asHours())}h ${duration.minutes()}m`;
    } else if (duration.asMinutes() >= 1) {
      return `${Math.floor(duration.asMinutes())}m ${duration.seconds()}s`;
    } else {
      return `${Math.floor(duration.asSeconds())}s`;
    }
  }

  /**
   * Get relative time from now in IST
   * @param {Date|string} date - Date to compare
   * @returns {string} Relative time string
   */
  static fromNow(date) {
    return moment(date).tz(IST_TIMEZONE).fromNow();
  }

  /**
   * Check if date is today in IST
   * @param {Date|string} date - Date to check
   * @returns {boolean} True if date is today in IST
   */
  static isToday(date) {
    const today = moment().tz(IST_TIMEZONE).startOf('day');
    const checkDate = moment(date).tz(IST_TIMEZONE).startOf('day');
    return today.isSame(checkDate);
  }

  /**
   * Get start of day in IST
   * @param {Date|string} date - Date (optional, defaults to today)
   * @returns {Date} Start of day in IST
   */
  static startOfDay(date = null) {
    if (date) {
      return moment(date).tz(IST_TIMEZONE).startOf('day').toDate();
    }
    return moment().tz(IST_TIMEZONE).startOf('day').toDate();
  }

  /**
   * Get end of day in IST
   * @param {Date|string} date - Date (optional, defaults to today)
   * @returns {Date} End of day in IST
   */
  static endOfDay(date = null) {
    if (date) {
      return moment(date).tz(IST_TIMEZONE).endOf('day').toDate();
    }
    return moment().tz(IST_TIMEZONE).endOf('day').toDate();
  }
}

module.exports = TimezoneUtils;
