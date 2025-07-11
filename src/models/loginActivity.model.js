const mongoose = require('mongoose');

const loginActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Allow null for failed login attempts when user doesn't exist
    default: null
  },
  email: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  loginTime: {
    type: Date
  },
  logoutTime: {
    type: Date
  },
  sessionDuration: {
    type: Number // in minutes
  },
  loginStatus: {
    type: String,
    enum: ['success', 'failed', 'locked', 'activated', 'deactivated'],
    default: 'success'
  },
  failureReason: {
    type: String
  },
  adminAction: {
    type: String,
    enum: ['user_activated', 'user_deactivated', 'user_deleted', 'password_reset'],
  },
  location: {
    country: String,
    city: String,
    region: String
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
loginActivitySchema.index({ userId: 1, loginTime: -1 });
loginActivitySchema.index({ loginTime: -1 });
loginActivitySchema.index({ ipAddress: 1 });

module.exports = mongoose.model('LoginActivity', loginActivitySchema); 