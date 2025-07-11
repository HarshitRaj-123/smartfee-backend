const SessionLog = require('../models/sessionLog.model');

/**
 * Middleware to clean up expired sessions
 * This should be run periodically (e.g., daily via cron job)
 */
const cleanupExpiredSessions = async () => {
  try {
    // Consider sessions older than 24 hours without logout as expired
    const expirationTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const result = await SessionLog.updateMany(
      {
        status: 'active',
        loginTimestamp: { $lt: expirationTime }
      },
      {
        status: 'ended',
        logoutTimestamp: new Date(),
        $set: { sessionDuration: null } // Will be calculated by pre-save hook
      }
    );

    console.log(`Cleaned up ${result.modifiedCount} expired sessions`);
    return result;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    throw error;
  }
};

/**
 * Express middleware to check and end current session if user is inactive
 */
const checkSessionValidity = async (req, res, next) => {
  try {
    if (req.user && req.user.userId) {
      // Check if user has an active session
      const activeSession = await SessionLog.findOne({
        userId: req.user.userId,
        status: 'active'
      }).sort({ loginTimestamp: -1 });

      if (activeSession) {
        // Check if session is older than 24 hours
        const sessionAge = Date.now() - activeSession.loginTimestamp.getTime();
        const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

        if (sessionAge > maxSessionAge) {
          // End the expired session
          await activeSession.endSession();
          
          // Clear cookies and return unauthorized
          res.clearCookie('accessToken');
          res.clearCookie('refreshToken');
          
          return res.status(401).json({
            message: 'Session expired due to inactivity',
            code: 'SESSION_EXPIRED'
          });
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Error checking session validity:', error);
    next(); // Continue even if session check fails
  }
};

/**
 * Initialize session cleanup cron job
 * This should be called once when the server starts
 */
const initializeSessionCleanup = () => {
  // Run cleanup every hour
  setInterval(async () => {
    try {
      await cleanupExpiredSessions();
    } catch (error) {
      console.error('Scheduled session cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  // Run initial cleanup
  setTimeout(async () => {
    try {
      await cleanupExpiredSessions();
      console.log('Initial session cleanup completed');
    } catch (error) {
      console.error('Initial session cleanup failed:', error);
    }
  }, 5000); // 5 seconds after startup
};

module.exports = {
  cleanupExpiredSessions,
  checkSessionValidity,
  initializeSessionCleanup
}; 