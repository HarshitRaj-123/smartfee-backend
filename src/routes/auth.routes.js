const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user.model');
const LoginActivity = require('../models/loginActivity.model');
const SessionLog = require('../models/sessionLog.model');
const { verifyToken } = require('../middleware/auth.middleware');
const { getClientIP, parseUserAgent } = require('../utils/ipUtils');
const { 
  createSessionLog, 
  endActiveSession, 
  endAllActiveSessionsForUser 
} = require('../utils/sessionUtils');

const router = express.Router();

// Generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Register route
router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn(['super_admin', 'admin', 'accountant', 'student'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create new user
      const user = new User({
        email,
        password,
        firstName,
        lastName,
        role
      });

      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);

      // Update user with refresh token
      user.refreshToken = refreshToken;
      await user.save();

      // Set tokens in cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Error registering user' });
    }
  }
);

// Login route with activity tracking
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseUserAgent(userAgent);

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        // Log failed login attempt
        await LoginActivity.create({
          userId: null,
          email,
          ipAddress,
          userAgent,
          loginStatus: 'failed',
          loginTime: new Date(),
          failureReason: 'User not found',
          deviceInfo
        });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check if user is active
      if (!user.isActive) {
        // Log inactive account attempt
        await LoginActivity.create({
          userId: user._id,
          email,
          ipAddress,
          userAgent,
          loginStatus: 'failed',
          loginTime: new Date(),
          failureReason: 'Account deactivated',
          deviceInfo
        });
        return res.status(401).json({ message: 'Account has been deactivated' });
      }

      // Check if account is locked
      if (user.isLocked()) {
        // Log locked account attempt
        await LoginActivity.create({
          userId: user._id,
          email,
          ipAddress,
          userAgent,
          loginStatus: 'locked',
          loginTime: new Date(),
          failureReason: 'Account locked',
          deviceInfo
        });
        return res.status(401).json({ message: 'Account is locked' });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        // Increment login attempts
        user.loginAttempts += 1;
        if (user.loginAttempts >= 5) {
          user.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
        }
        await user.save();

        // Log failed login attempt
        await LoginActivity.create({
          userId: user._id,
          email,
          ipAddress,
          userAgent,
          loginStatus: 'failed',
          loginTime: new Date(),
          failureReason: 'Invalid password',
          deviceInfo
        });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Reset login attempts on successful login
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      user.lastLogin = Date.now();

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);

      // Update user with refresh token
      user.refreshToken = refreshToken;
      await user.save();

      // Create session log entry
      try {
        await createSessionLog(user._id, req);
      } catch (sessionError) {
        console.error('Error creating session log:', sessionError);
        // Don't fail login if session logging fails
      }

      // Log successful login in LoginActivity
      await LoginActivity.create({
        userId: user._id,
        email,
        ipAddress,
        userAgent,
        loginStatus: 'success',
        loginTime: new Date(),
        deviceInfo
      });

      // Set tokens in cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        message: 'Login successful',
        accessToken: accessToken,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error logging in' });
    }
  }
);

// Refresh token route
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account has been deactivated' });
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);

    // Update user's refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    // Set new tokens in cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      message: 'Token refreshed successfully',
      accessToken: tokens.accessToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// Forgot password route
router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();

      // TODO: Send email with reset token
      // For now, we'll just return the token
      res.json({
        message: 'Password reset token generated',
        resetToken // Remove this in production
      });
    } catch (error) {
      res.status(500).json({ message: 'Error generating reset token' });
    }
  }
);

// Reset password route
router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 6 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findOne({
        resetPasswordToken: req.body.token,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      // Update password
      user.password = req.body.password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      res.status(500).json({ message: 'Error resetting password' });
    }
  }
);

// Logout route with session tracking
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      // End active session in SessionLog
      try {
        await endActiveSession(user._id);
      } catch (sessionError) {
        console.error('Error ending session:', sessionError);
        // Don't fail logout if session ending fails
      }

      // Find the most recent login activity for this user
      const recentActivity = await LoginActivity.findOne({
        userId: user._id,
        loginStatus: 'success',
        logoutTime: { $exists: false }
      }).sort({ loginTime: -1 });

      if (recentActivity) {
        // Update logout time and calculate session duration
        const logoutTime = new Date();
        const sessionDuration = Math.round((logoutTime - recentActivity.loginTime) / (1000 * 60)); // in minutes
        
        recentActivity.logoutTime = logoutTime;
        recentActivity.sessionDuration = sessionDuration;
        await recentActivity.save();
      }

      // Clear refresh token
      user.refreshToken = null;
      await user.save();
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error logging out' });
  }
});

// Verify token route
router.get('/verify-token', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshToken');
    res.json({
      message: 'Token is valid',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying token' });
  }
});

// Get current user route
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshToken');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

module.exports = router; 