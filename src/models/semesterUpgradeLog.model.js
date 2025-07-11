const mongoose = require('mongoose');

const semesterUpgradeLogSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  fromSemester: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  toSemester: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  academicYear: {
    type: String,
    required: true
  },
  upgradeType: {
    type: String,
    enum: ['auto', 'manual', 'bulk'],
    required: true
  },
  upgradeReason: {
    type: String,
    enum: ['semester_completion', 'manual_promotion', 'bulk_upgrade', 'correction', 'readmission'],
    required: true
  },
  upgradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  upgradeDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // Service changes during upgrade
  serviceChanges: [{
    serviceName: {
      type: String,
      enum: ['hostel', 'mess', 'transport', 'library'],
      required: true
    },
    action: {
      type: String,
      enum: ['opted_in', 'opted_out', 'modified', 'no_change'],
      required: true
    },
    previousData: {
      type: mongoose.Schema.Types.Mixed
    },
    newData: {
      type: mongoose.Schema.Types.Mixed
    }
  }],
  
  // Fee template information
  feeTemplateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeTemplate'
  },
  feeAmount: {
    type: Number,
    min: 0
  },
  
  // Status and notes
  status: {
    type: String,
    enum: ['completed', 'failed', 'rolled_back'],
    default: 'completed'
  },
  notes: {
    type: String,
    maxlength: 500
  },
  
  // Rollback information
  isRolledBack: {
    type: Boolean,
    default: false
  },
  rolledBackBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rollbackDate: {
    type: Date
  },
  rollbackReason: {
    type: String,
    maxlength: 300
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
semesterUpgradeLogSchema.index({ studentId: 1, upgradeDate: -1 });
semesterUpgradeLogSchema.index({ courseId: 1, toSemester: 1 });
semesterUpgradeLogSchema.index({ academicYear: 1, upgradeDate: -1 });
semesterUpgradeLogSchema.index({ upgradedBy: 1, upgradeDate: -1 });
semesterUpgradeLogSchema.index({ upgradeType: 1, status: 1 });

// Static method to get upgrade history for a student
semesterUpgradeLogSchema.statics.getStudentUpgradeHistory = function(studentId) {
  return this.find({ studentId })
    .populate('studentId', 'firstName lastName studentId')
    .populate('courseId', 'name code')
    .populate('upgradedBy', 'firstName lastName role')
    .populate('rolledBackBy', 'firstName lastName role')
    .sort({ upgradeDate: -1 });
};

// Static method to get bulk upgrade logs
semesterUpgradeLogSchema.statics.getBulkUpgradeLogs = function(upgradeDate, upgradedBy) {
  const query = { upgradeType: 'bulk' };
  if (upgradeDate) {
    const startDate = new Date(upgradeDate);
    const endDate = new Date(upgradeDate);
    endDate.setDate(endDate.getDate() + 1);
    query.upgradeDate = { $gte: startDate, $lt: endDate };
  }
  if (upgradedBy) query.upgradedBy = upgradedBy;
  
  return this.find(query)
    .populate('studentId', 'firstName lastName studentId')
    .populate('courseId', 'name code')
    .populate('upgradedBy', 'firstName lastName role')
    .sort({ upgradeDate: -1 });
};

// Static method to get upgrade statistics
semesterUpgradeLogSchema.statics.getUpgradeStats = function(academicYear = null) {
  const matchQuery = {};
  if (academicYear) matchQuery.academicYear = academicYear;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          upgradeType: '$upgradeType',
          status: '$status'
        },
        count: { $sum: 1 },
        students: { $addToSet: '$studentId' }
      }
    },
    {
      $group: {
        _id: '$_id.upgradeType',
        statusBreakdown: {
          $push: {
            status: '$_id.status',
            count: '$count',
            uniqueStudents: { $size: '$students' }
          }
        },
        totalUpgrades: { $sum: '$count' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Method to rollback upgrade
semesterUpgradeLogSchema.methods.rollback = function(rolledBackBy, reason) {
  this.isRolledBack = true;
  this.rolledBackBy = rolledBackBy;
  this.rollbackDate = new Date();
  this.rollbackReason = reason;
  this.status = 'rolled_back';
  return this.save();
};

module.exports = mongoose.model('SemesterUpgradeLog', semesterUpgradeLogSchema); 