const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/user.model');
const LoginActivity = require('../models/loginActivity.model');
const SessionLog = require('../models/sessionLog.model');
const { verifyToken } = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');
const { getClientIP, parseUserAgent } = require('../utils/ipUtils');
const { endAllActiveSessionsForUser } = require('../utils/sessionUtils');

const router = express.Router();

// Get all users (Super Admin only)
router.get('/', verifyToken, permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get users by role (Super Admin and Admin)
router.get('/by-role/:role', verifyToken, permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { role } = req.params;
    const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
    
    // Validate role
    if (!['admin', 'accountant'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role. Only admin and accountant are allowed.' 
      });
    }

    // Build query
    let query = { role };
    
    // Add search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status !== 'all') {
      query.isActive = status === 'active';
    }

    // Execute query with pagination
    const users = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Get last login info for each user
    const usersWithActivity = await Promise.all(users.map(async (user) => {
      const lastActivity = await LoginActivity.findOne({
        userId: user._id,
        loginStatus: 'success'
      }).sort({ loginTime: -1 });

      return {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLogin: lastActivity ? lastActivity.loginTime : user.lastLogin,
        lastLoginIP: lastActivity ? lastActivity.ipAddress : null,
        createdAt: user.createdAt,
        initials: `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
      };
    }));

    res.json({
      success: true,
      data: {
        users: usersWithActivity,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users by role:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching users' 
    });
  }
});

// Get login activities (Super Admin and Admin)
router.get('/login-activities', verifyToken, permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, days = 30 } = req.query;
    
    // Build query
    let query = {};
    
    // Filter by user if specified
    if (userId) {
      query.userId = userId;
    }

    // Filter by date range
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - parseInt(days));
    query.loginTime = { $gte: dateLimit };

    // Execute query with pagination
    const activities = await LoginActivity.find(query)
      .populate('userId', 'firstName lastName email')
      .sort({ loginTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LoginActivity.countDocuments(query);

    // Format activities for frontend
    const formattedActivities = activities.map(activity => {
      const user = activity.userId || { firstName: 'Unknown', lastName: 'User', email: activity.email };
      return {
        id: activity._id,
        user: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          initials: `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
        },
        action: activity.loginStatus === 'success' ? 'Login Success' : 
                activity.loginStatus === 'failed' ? 'Login Failed' : 'Account Locked',
        details: activity.loginStatus === 'success' ? 'Logged in successfully' :
                activity.failureReason || 'Login attempt failed',
        ip: activity.ipAddress,
        timestamp: activity.loginTime,
        type: activity.loginStatus === 'success' ? 'success' : 
              activity.loginStatus === 'failed' ? 'error' : 'warning',
        deviceInfo: activity.deviceInfo,
        sessionDuration: activity.sessionDuration
      };
    });

    res.json({
      success: true,
      data: {
        activities: formattedActivities,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error fetching login activities:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching login activities' 
    });
  }
});

// Get user by ID (Super Admin, Admin)
router.get('/:id', verifyToken, permit('STUDENT_MANAGEMENT'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// Update user (Super Admin only)
router.put('/:id',
  verifyToken,
  permit('ADMIN_MANAGEMENT'),
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('role').optional().isIn(['super_admin', 'admin', 'accountant', 'student']),
    body('isActive').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update user fields
      Object.keys(req.body).forEach(key => {
        if (key !== 'password') { // Password updates handled separately
          user[key] = req.body[key];
        }
      });

      await user.save();
      res.json({ message: 'User updated successfully', user });
    } catch (error) {
      res.status(500).json({ message: 'Error updating user' });
    }
  }
);

// Delete user (Super Admin only)
router.delete('/:id', verifyToken, permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Prevent deletion of super admin
    if (user.role === 'super_admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Cannot delete super admin user' 
      });
    }

    // Prevent users from deleting themselves
    if (user._id.toString() === req.user.userId) {
      return res.status(403).json({ 
        success: false,
        message: 'Cannot delete your own account' 
      });
    }

    // Delete user and related data
    await User.findByIdAndDelete(req.params.id);
    await LoginActivity.deleteMany({ userId: req.params.id });

    res.json({ 
      success: true,
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting user' 
    });
  }
});

// Update user status and handle automatic logout
router.patch('/:id/status', verifyToken, permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Prevent deactivating super admin
    if (user.role === 'super_admin' && !isActive) {
      return res.status(403).json({ 
        success: false,
        message: 'Cannot deactivate super admin user' 
      });
    }

    // Prevent users from deactivating themselves
    if (user._id.toString() === req.user.userId && !isActive) {
      return res.status(403).json({ 
        success: false,
        message: 'Cannot deactivate your own account' 
      });
    }

    // Update user status
    user.isActive = isActive;
    
    // If deactivating, clear refresh token to force logout and end all sessions
    if (!isActive) {
      user.refreshToken = null;
      
      // End all active sessions for this user
      try {
        await endAllActiveSessionsForUser(user._id);
      } catch (sessionError) {
        console.error('Error ending user sessions:', sessionError);
        // Don't fail the request if session ending fails
      }
    }
    
    await user.save();

    // Log the status change activity
    try {
      await LoginActivity.create({
        userId: user._id,
        email: user.email,
        ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
        userAgent: req.headers['user-agent'] || 'Unknown',
        loginStatus: isActive ? 'activated' : 'deactivated',
        failureReason: isActive ? 'Account activated by admin' : 'Account deactivated by admin',
        adminAction: isActive ? 'user_activated' : 'user_deactivated',
        deviceInfo: { browser: 'Admin Panel', os: 'Web', device: 'Desktop' }
      });
    } catch (activityError) {
      console.error('Failed to log activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    res.json({ 
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating user status',
      error: error.message
    });
  }
});

// Change password (Any authenticated user or Super Admin for others)
router.put('/:id/password',
  verifyToken,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Only allow users to change their own password unless super_admin
      if (user._id.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Not authorized to change this password' });
      }

      // Verify current password
      const isMatch = await user.comparePassword(req.body.currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Update password
      user.password = req.body.newPassword;
      await user.save();

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error updating password' });
    }
  }
);

// Get current user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          studentId: user.studentId, // For students
          employeeId: user.employeeId, // For staff
          department: user.department,
          phone: user.phone,
          address: user.address,
          dateOfBirth: user.dateOfBirth,
          enrollmentDate: user.enrollmentDate, // For students
          joinDate: user.joinDate, // For staff
          status: user.status,
          profilePicture: user.profilePicture,
          preferences: user.preferences || {},
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
});

// Update current user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'address', 
      'dateOfBirth', 'profilePicture', 'preferences'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user profile'
    });
  }
});

// Get user-specific dashboard data
router.get('/dashboard-data', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    const dashboardData = {
      userId,
      role: userRole,
      personalStats: {},
      recentActivities: [],
      notifications: [],
      quickActions: []
    };

    // Role-specific data fetching
    switch (userRole) {
      case 'student':
        try {
          const StudentFee = require('../models/studentFee.model');
          const Payment = require('../models/payment.model');
          
          // Get student's current fee information
          const currentFee = await StudentFee.findOne({
            studentId: userId
          }).sort({ createdAt: -1 });

          // Get payment history
          const payments = await Payment.find({
            studentId: userId,
            status: 'completed'
          }).sort({ createdAt: -1 }).limit(5);

          // Get pending payments
          const pendingPayments = await Payment.countDocuments({
            studentId: userId,
            status: { $in: ['pending', 'processing'] }
          });

          dashboardData.personalStats = {
            outstandingFees: currentFee ? currentFee.balanceDue : 0,
            paidFees: currentFee ? currentFee.totalPaid : 0,
            upcomingPayments: pendingPayments,
            totalTransactions: payments.length
          };

          // Recent activities from payments
          dashboardData.recentActivities = payments.map(payment => ({
            description: `Payment of ₹${payment.amount} for ${payment.description || 'fees'}`,
            date: payment.createdAt.toISOString().split('T')[0],
            type: 'payment'
          }));
        } catch (error) {
          console.error('Error fetching student dashboard data:', error);
          dashboardData.personalStats = {
            outstandingFees: 0,
            paidFees: 0,
            upcomingPayments: 0,
            totalTransactions: 0
          };
        }
        break;
        
      case 'accountant':
        try {
          const Payment = require('../models/payment.model');
          
          // Get payments processed by this accountant
          const paymentsProcessed = await Payment.countDocuments({
            recordedBy: userId,
            status: 'completed'
          });

          // Get pending verifications
          const pendingVerifications = await Payment.countDocuments({
            status: 'pending',
            paymentMethod: { $in: ['cash', 'cheque', 'bank_transfer'] }
          });

          // Get monthly collections
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const monthlyCollections = await Payment.aggregate([
            {
              $match: {
                recordedBy: userId,
                status: 'completed',
                createdAt: { $gte: startOfMonth }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' }
              }
            }
          ]);

          // Get assigned students count (assuming accountants are assigned to students)
          const User = require('../models/user.model');
          const studentsAssigned = await User.countDocuments({
            role: 'student',
            assignedAccountant: userId
          });

          dashboardData.personalStats = {
            studentsAssigned: studentsAssigned,
            paymentsProcessed: paymentsProcessed,
            pendingVerifications: pendingVerifications,
            monthlyCollections: monthlyCollections.length > 0 ? monthlyCollections[0].total : 0
          };

          // Recent activities from recent payments
          const recentPayments = await Payment.find({
            recordedBy: userId
          }).populate('studentId', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(5);

          dashboardData.recentActivities = recentPayments.map(payment => ({
            description: `Processed payment of ₹${payment.amount} for ${payment.studentId ? payment.studentId.firstName + ' ' + payment.studentId.lastName : 'student'}`,
            date: payment.createdAt.toISOString().split('T')[0],
            type: 'payment_processing'
          }));
        } catch (error) {
          console.error('Error fetching accountant dashboard data:', error);
          dashboardData.personalStats = {
            studentsAssigned: 0,
            paymentsProcessed: 0,
            pendingVerifications: 0,
            monthlyCollections: 0
          };
        }
        break;
        
      case 'admin':
      case 'super_admin':
        try {
          const User = require('../models/user.model');
          const Payment = require('../models/payment.model');
          
          // Get total users and students
          const totalUsers = await User.countDocuments({ isActive: true });
          const totalStudents = await User.countDocuments({ role: 'student', isActive: true });

          // Get total revenue
          const revenueResult = await Payment.aggregate([
            {
              $match: { status: 'completed' }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' }
              }
            }
          ]);

          dashboardData.personalStats = {
            totalUsers: totalUsers,
            totalStudents: totalStudents,
            totalRevenue: revenueResult.length > 0 ? revenueResult[0].total : 0,
            systemHealth: 'Good'
          };

          // Recent activities from login activities
          const LoginActivity = require('../models/loginActivity.model');
          const recentActivities = await LoginActivity.find({
            loginStatus: 'success'
          }).populate('userId', 'firstName lastName')
            .sort({ loginTime: -1 })
            .limit(5);

          dashboardData.recentActivities = recentActivities.map(activity => ({
            description: `${activity.userId ? activity.userId.firstName + ' ' + activity.userId.lastName : 'User'} logged in`,
            date: activity.loginTime.toISOString().split('T')[0],
            type: 'login'
          }));
        } catch (error) {
          console.error('Error fetching admin dashboard data:', error);
          dashboardData.personalStats = {
            totalUsers: 0,
            totalStudents: 0,
            totalRevenue: 0,
            systemHealth: 'Good'
          };
        }
        break;
    }

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data'
    });
  }
});

// Get user-specific notifications
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    // Fetch real notifications from database
    const Notification = require('../models/notification.model');
    let notifications = [];
    
    try {
      // Get notifications for this user
      notifications = await Notification.find({
        $or: [
          { userId: userId }, // User-specific notifications
          { role: userRole }, // Role-specific notifications
          { isGlobal: true }  // Global notifications
        ]
      }).sort({ createdAt: -1 }).limit(20);

      // Format notifications for frontend
      notifications = notifications.map(notification => ({
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        read: notification.readBy.includes(userId),
        createdAt: notification.createdAt,
        priority: notification.priority
      }));
    } catch (error) {
      console.error('Error fetching notifications from database:', error);
      
      // Fallback to basic system notifications
      notifications = [
        {
          id: 'welcome-' + userId,
          title: 'Welcome to SmartFee',
          message: 'Your account has been successfully created and is ready to use.',
          type: 'info',
          read: false,
          createdAt: new Date(),
          priority: 'normal'
        }
      ];

      // Add role-specific notifications
      if (userRole === 'student') {
        notifications.push({
          id: 'student-info-' + userId,
          title: 'Fee Payment Information',
          message: 'You can view your fee structure and make payments online through the Fee Payment section.',
          type: 'info',
          read: false,
          createdAt: new Date(),
          priority: 'normal'
        });
      } else if (userRole === 'accountant') {
        notifications.push({
          id: 'accountant-info-' + userId,
          title: 'Accountant Dashboard',
          message: 'You can manage student payments and verify transactions through your dashboard.',
          type: 'info',
          read: false,
          createdAt: new Date(),
          priority: 'normal'
        });
      } else if (userRole === 'admin' || userRole === 'super_admin') {
        notifications.push({
          id: 'admin-info-' + userId,
          title: 'Admin Dashboard',
          message: 'You have full access to manage users, students, and system settings.',
          type: 'info',
          read: false,
          createdAt: new Date(),
          priority: 'normal'
        });
      }
    }

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
});

// Get user-specific transactions (for students)
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    if (userRole !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only students can access this endpoint.'
      });
    }

    // Fetch real transaction data for students
    const Payment = require('../models/payment.model');
    let transactions = [];
    
    try {
      // Get all payments for this student
      const payments = await Payment.find({
        studentId: userId
      }).sort({ createdAt: -1 }).limit(50);

      // Format transactions for frontend
      transactions = payments.map(payment => ({
        id: payment._id,
        amount: payment.amount,
        type: payment.paymentType || 'fee_payment',
        status: payment.status,
        description: payment.description || 'Fee Payment',
        date: payment.createdAt,
        receiptNumber: payment.receiptNumber,
        paymentMethod: payment.paymentMethod,
        transactionId: payment.transactionId,
        semester: payment.semester,
        academicYear: payment.academicYear
      }));
    } catch (error) {
      console.error('Error fetching transactions from database:', error);
      
      // Fallback to empty array if database query fails
      transactions = [];
    }

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
});

// Get user-specific fee information (for students)
router.get('/fees', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    if (userRole !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only students can access this endpoint.'
      });
    }

    // Get actual student fee data from database
    const StudentFee = require('../models/studentFee.model');
    const User = require('../models/user.model');
    
    const student = await User.findById(userId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get current semester fee
    const currentFee = await StudentFee.findOne({
      studentId: userId,
      semester: student.currentSemester,
      academicYear: student.academicYear
    }).populate('feeItems.categoryId', 'name type');

    if (!currentFee) {
      return res.status(404).json({
        success: false,
        message: 'No fee record found for current semester. Please contact administration.'
      });
    }

    // Calculate fee breakdown
    const feeStructure = currentFee.feeItems.map(item => ({
      category: item.name,
      amount: item.originalAmount,
      paid: item.paid,
      status: item.status,
      isOptional: item.isOptional
    }));

    const feeData = {
      totalFees: currentFee.netAmount,
      paidFees: currentFee.totalPaid,
      outstandingFees: currentFee.balanceDue,
      dueDate: currentFee.dueDate,
      status: currentFee.status,
      semester: currentFee.semester,
      academicYear: currentFee.academicYear,
      feeStructure: feeStructure,
      fines: currentFee.totalFines,
      discounts: currentFee.totalDiscounts
    };

    res.json({
      success: true,
      data: feeData
    });
  } catch (error) {
    console.error('Error fetching fees:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching fees'
    });
  }
});

// Get assigned students (for accountants)
router.get('/assigned-students', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    if (userRole !== 'accountant') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only accountants can access this endpoint.'
      });
    }

    // Fetch real assigned students data for accountants
    const User = require('../models/user.model');
    const StudentFee = require('../models/studentFee.model');
    let assignedStudents = [];
    
    try {
      // Get students assigned to this accountant
      const students = await User.find({
        role: 'student',
        assignedAccountant: userId,
        isActive: true
      }).select('firstName lastName email studentId department courseId currentSemester');

      // Get fee status for each student
      assignedStudents = await Promise.all(students.map(async (student) => {
        try {
          // Get current semester fee
          const currentFee = await StudentFee.findOne({
            studentId: student._id,
            semester: student.currentSemester
          });

          return {
            id: student._id,
            name: `${student.firstName} ${student.lastName}`,
            studentId: student.studentId,
            email: student.email,
            department: student.department,
            semester: student.currentSemester,
            feeStatus: currentFee ? (currentFee.balanceDue > 0 ? 'pending' : 'paid') : 'not_set',
            outstandingAmount: currentFee ? currentFee.balanceDue : 0,
            totalFees: currentFee ? currentFee.netAmount : 0,
            paidAmount: currentFee ? currentFee.totalPaid : 0
          };
        } catch (error) {
          console.error(`Error fetching fee data for student ${student._id}:`, error);
          return {
            id: student._id,
            name: `${student.firstName} ${student.lastName}`,
            studentId: student.studentId,
            email: student.email,
            department: student.department,
            semester: student.currentSemester,
            feeStatus: 'unknown',
            outstandingAmount: 0,
            totalFees: 0,
            paidAmount: 0
          };
        }
      }));
    } catch (error) {
      console.error('Error fetching assigned students from database:', error);
      
      // Fallback to empty array if database query fails
      assignedStudents = [];
    }

    res.json({
      success: true,
      data: assignedStudents
    });
  } catch (error) {
    console.error('Error fetching assigned students:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assigned students'
    });
  }
});

module.exports = router; 