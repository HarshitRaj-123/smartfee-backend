const SessionLog = require('../models/sessionLog.model');

/**
 * Extract client IP address from request
 * @param {Object} req - Express request object
 * @returns {String} - Client IP address
 */
const getClientIP = (req) => {
  return req.ip ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.headers['x-client-ip'] ||
         req.headers['x-forwarded'] ||
         req.headers['forwarded-for'] ||
         req.headers['forwarded'] ||
         'Unknown';
};

/**
 * Parse user agent to extract device information
 * @param {String} userAgent - User agent string
 * @returns {Object} - Parsed device info
 */
const parseUserAgent = (userAgent = '') => {
  const deviceInfo = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Unknown'
  };

  if (!userAgent) return deviceInfo;

  // Browser detection
  if (userAgent.includes('Chrome')) deviceInfo.browser = 'Chrome';
  else if (userAgent.includes('Firefox')) deviceInfo.browser = 'Firefox';
  else if (userAgent.includes('Safari')) deviceInfo.browser = 'Safari';
  else if (userAgent.includes('Edge')) deviceInfo.browser = 'Edge';
  else if (userAgent.includes('Opera')) deviceInfo.browser = 'Opera';

  // OS detection
  if (userAgent.includes('Windows')) deviceInfo.os = 'Windows';
  else if (userAgent.includes('Mac OS')) deviceInfo.os = 'macOS';
  else if (userAgent.includes('Linux')) deviceInfo.os = 'Linux';
  else if (userAgent.includes('Android')) deviceInfo.os = 'Android';
  else if (userAgent.includes('iOS')) deviceInfo.os = 'iOS';

  // Device detection
  if (userAgent.includes('Mobile')) deviceInfo.device = 'Mobile';
  else if (userAgent.includes('Tablet')) deviceInfo.device = 'Tablet';
  else deviceInfo.device = 'Desktop';

  return deviceInfo;
};

/**
 * Create a new session log entry
 * @param {String} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created session log
 */
const createSessionLog = async (userId, req) => {
  try {
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseUserAgent(userAgent);

    const sessionLog = new SessionLog({
      userId,
      ipAddress,
      userAgent,
      deviceInfo,
      loginTimestamp: new Date(),
      status: 'active'
    });

    return await sessionLog.save();
  } catch (error) {
    console.error('Error creating session log:', error);
    throw error;
  }
};

/**
 * End active session for a user
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Updated session log
 */
const endActiveSession = async (userId) => {
  try {
    const activeSession = await SessionLog.findActiveSession(userId);
    
    if (activeSession) {
      return await activeSession.endSession();
    }
    
    return null;
  } catch (error) {
    console.error('Error ending active session:', error);
    throw error;
  }
};

/**
 * End all active sessions for a user (useful for security actions)
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Update result
 */
const endAllActiveSessionsForUser = async (userId) => {
  try {
    return await SessionLog.endAllActiveSessions(userId);
  } catch (error) {
    console.error('Error ending all active sessions:', error);
    throw error;
  }
};

/**
 * Get active sessions count for a user
 * @param {String} userId - User ID
 * @returns {Promise<Number>} - Count of active sessions
 */
const getActiveSessionsCount = async (userId) => {
  try {
    return await SessionLog.countDocuments({ userId, status: 'active' });
  } catch (error) {
    console.error('Error getting active sessions count:', error);
    return 0;
  }
};

/**
 * Get user's session history
 * @param {String} userId - User ID
 * @param {Object} options - Query options (limit, skip, etc.)
 * @returns {Promise<Array>} - Session history
 */
const getUserSessionHistory = async (userId, options = {}) => {
  try {
    const { limit = 50, skip = 0, status = null } = options;
    
    const query = { userId };
    if (status) query.status = status;

    return await SessionLog.find(query)
      .sort({ loginTimestamp: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
  } catch (error) {
    console.error('Error getting user session history:', error);
    return [];
  }
};

module.exports = {
  getClientIP,
  parseUserAgent,
  createSessionLog,
  endActiveSession,
  endAllActiveSessionsForUser,
  getActiveSessionsCount,
  getUserSessionHistory
}; 