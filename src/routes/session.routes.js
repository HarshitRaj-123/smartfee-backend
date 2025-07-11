const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');
const SessionLog = require('../models/sessionLog.model');
const { 
  getUserSessionHistory, 
  getActiveSessionsCount,
  endAllActiveSessionsForUser 
} = require('../utils/sessionUtils');

const router = express.Router();

// Get current user's session history
router.get('/my-sessions', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const sessions = await getUserSessionHistory(req.user.userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      status
    });

    const total = await SessionLog.countDocuments({ 
      userId: req.user.userId,
      ...(status && { status })
    });

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching session history'
    });
  }
});

// Get active sessions count for current user
router.get('/active-count', verifyToken, async (req, res) => {
  try {
    const count = await getActiveSessionsCount(req.user.userId);
    res.json({
      success: true,
      data: { activeSessionsCount: count }
    });
  } catch (error) {
    console.error('Error getting active sessions count:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting active sessions count'
    });
  }
});

// End all active sessions for current user (except current one)
router.post('/end-all-others', verifyToken, async (req, res) => {
  try {
    // Get current session (most recent active session)
    const currentSession = await SessionLog.findOne({
      userId: req.user.userId,
      status: 'active'
    }).sort({ loginTimestamp: -1 });

    if (currentSession) {
      // End all active sessions except the current one
      await SessionLog.updateMany(
        { 
          userId: req.user.userId, 
          status: 'active',
          _id: { $ne: currentSession._id }
        },
        { 
          logoutTimestamp: new Date(),
          status: 'ended',
          sessionDuration: null // Will be calculated by pre-save hook
        }
      );
    }

    res.json({
      success: true,
      message: 'All other sessions ended successfully'
    });
  } catch (error) {
    console.error('Error ending other sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending other sessions'
    });
  }
});

// Admin routes - Get any user's session history
router.get('/user/:userId', verifyToken, permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const sessions = await getUserSessionHistory(userId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      status
    });

    const total = await SessionLog.countDocuments({ 
      userId,
      ...(status && { status })
    });

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user session history'
    });
  }
});

// Admin routes - End all sessions for a specific user
router.post('/user/:userId/end-all', verifyToken, permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await endAllActiveSessionsForUser(userId);
    
    res.json({
      success: true,
      message: 'All user sessions ended successfully',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Error ending user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending user sessions'
    });
  }
});

// Admin routes - Get session statistics
router.get('/stats', verifyToken, permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await SessionLog.aggregate([
      {
        $match: {
          loginTimestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          activeSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          endedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] }
          },
          averageSessionDuration: {
            $avg: { $cond: [{ $ne: ['$sessionDuration', null] }, '$sessionDuration', 0] }
          },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          _id: 0,
          totalSessions: 1,
          activeSessions: 1,
          endedSessions: 1,
          averageSessionDuration: { $round: ['$averageSessionDuration', 2] },
          uniqueUsersCount: { $size: '$uniqueUsers' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalSessions: 0,
        activeSessions: 0,
        endedSessions: 0,
        averageSessionDuration: 0,
        uniqueUsersCount: 0
      }
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching session statistics'
    });
  }
});

module.exports = router; 