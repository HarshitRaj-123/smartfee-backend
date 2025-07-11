const mongoose = require('mongoose');

const sessionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  loginTimestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  logoutTimestamp: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
    required: true
  },
  userAgent: {
    type: String,
    default: null
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String
  },
  sessionDuration: {
    type: Number, // in minutes, calculated when session ends
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
sessionLogSchema.index({ userId: 1, status: 1 });
sessionLogSchema.index({ loginTimestamp: -1 });
sessionLogSchema.index({ status: 1, loginTimestamp: -1 });

// Virtual to calculate session duration
sessionLogSchema.virtual('duration').get(function() {
  if (this.logoutTimestamp && this.loginTimestamp) {
    return Math.round((this.logoutTimestamp - this.loginTimestamp) / (1000 * 60)); // minutes
  }
  return null;
});

// Method to end session
sessionLogSchema.methods.endSession = function() {
  this.logoutTimestamp = new Date();
  this.status = 'ended';
  this.sessionDuration = this.duration;
  return this.save();
};

// Static method to find active session for user
sessionLogSchema.statics.findActiveSession = function(userId) {
  return this.findOne({ userId, status: 'active' });
};

// Static method to end all active sessions for a user
sessionLogSchema.statics.endAllActiveSessions = function(userId) {
  return this.updateMany(
    { userId, status: 'active' },
    { 
      logoutTimestamp: new Date(),
      status: 'ended',
      $set: { sessionDuration: null } // Will be calculated by pre-save hook
    }
  );
};

// Pre-save hook to calculate session duration
sessionLogSchema.pre('save', function(next) {
  if (this.logoutTimestamp && this.loginTimestamp && !this.sessionDuration) {
    this.sessionDuration = Math.round((this.logoutTimestamp - this.loginTimestamp) / (1000 * 60));
  }
  next();
});

module.exports = mongoose.model('SessionLog', sessionLogSchema); 