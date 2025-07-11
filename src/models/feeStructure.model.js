const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const feeComponentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['base', 'service', 'event', 'fine', 'misc', 'custom'],
    default: 'base'
  },
  isRequired: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // For service-specific data: { roomType, route, distance, eventName, etc. }
  }
}, { _id: true });

const serviceFeeSchema = new mongoose.Schema({
  serviceType: {
    type: String,
    enum: ['hostel', 'mess', 'transport', 'event', 'workshop', 'certification', 'custom'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  isOptional: {
    type: Boolean,
    default: true
  },
  configuration: {
    // Hostel specific
    roomType: {
      type: String,
      enum: ['single', 'shared', 'ac-single', 'ac-shared', 'deluxe']
    },
    // Transport specific
    route: String,
    distance: Number,
    pickupPoints: [String],
    // Event specific
    eventName: String,
    eventDate: Date,
    // Custom fields
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  applicableFrom: {
    type: Date,
    default: Date.now
  },
  applicableTo: {
    type: Date
  },
  description: {
    type: String,
    maxlength: 500
  }
}, { _id: true });

const feeStructureSchema = new mongoose.Schema({
  // Course identification
  programName: {
    type: String,
    required: true,
    trim: true
  },
  branch: {
    type: String,
    required: true,
    trim: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  academicSession: {
    type: String,
    required: true,
    trim: true
    // Format: "2024-25"
  },
  
  // Course metadata
  courseInfo: {
    category: String,
    course_name: String,
    duration: String,
    totalSemesters: Number
  },
  
  // Fee components
  baseFees: [feeComponentSchema],
  serviceFees: [serviceFeeSchema],
  
  // Totals
  totalBaseFee: {
    type: Number,
    default: 0
  },
  totalServiceFee: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    default: 0
  },
  
  // Status and metadata
  status: {
    type: String,
    enum: ['draft', 'active', 'archived', 'inactive'],
    default: 'draft'
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateName: {
    type: String,
    trim: true
  },
  
  // Assignment tracking
  assignedStudents: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedDate: {
      type: Date,
      default: Date.now
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Audit trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modificationHistory: [{
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    changes: {
      type: mongoose.Schema.Types.Mixed
    },
    reason: String
  }],
  
  // Propagation settings
  propagationSettings: {
    autoAssignToNewStudents: {
      type: Boolean,
      default: true
    },
    notifyOnChanges: {
      type: Boolean,
      default: true
    },
    effectiveFrom: {
      type: Date,
      default: Date.now
    }
  },
  
  // Notes and comments
  notes: {
    type: String,
    maxlength: 1000
  },
  adminComments: [{
    comment: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
feeStructureSchema.index({ programName: 1, branch: 1, semester: 1, academicSession: 1 });
feeStructureSchema.index({ status: 1, academicSession: 1 });
feeStructureSchema.index({ createdBy: 1, createdAt: -1 });

// Pre-save middleware to calculate totals
feeStructureSchema.pre('save', function(next) {
  // Calculate base fee total
  this.totalBaseFee = this.baseFees.reduce((sum, fee) => sum + fee.amount, 0);
  
  // Calculate service fee total
  this.totalServiceFee = this.serviceFees.reduce((sum, fee) => sum + fee.amount, 0);
  
  // Calculate grand total
  this.grandTotal = this.totalBaseFee + this.totalServiceFee;
  
  next();
});

// Methods
feeStructureSchema.methods.clone = function(newSession, newSemester) {
  const cloned = new this.constructor({
    programName: this.programName,
    branch: this.branch,
    semester: newSemester || this.semester,
    academicSession: newSession || this.academicSession,
    courseInfo: this.courseInfo,
    baseFees: this.baseFees,
    serviceFees: this.serviceFees,
    createdBy: this.lastModifiedBy || this.createdBy,
    status: 'draft',
    notes: `Cloned from ${this.academicSession} - Semester ${this.semester}`
  });
  
  return cloned;
};

feeStructureSchema.methods.assignToStudents = async function(studentIds, assignedBy) {
  const assignments = studentIds.map(studentId => ({
    studentId,
    assignedDate: new Date(),
    assignedBy
  }));
  
  this.assignedStudents.push(...assignments);
  return this.save();
};

feeStructureSchema.methods.addModificationLog = function(changes, reason, modifiedBy) {
  this.modificationHistory.push({
    modifiedBy,
    modifiedAt: new Date(),
    changes,
    reason
  });
  
  this.lastModifiedBy = modifiedBy;
};

// Static methods
feeStructureSchema.statics.findByCourse = function(programName, branch, semester, academicSession) {
  return this.findOne({
    programName,
    branch,
    semester,
    academicSession,
    status: { $ne: 'archived' }
  });
};

feeStructureSchema.statics.getActiveStructures = function(filters = {}) {
  return this.find({
    status: 'active',
    ...filters
  }).populate('createdBy lastModifiedBy', 'firstName lastName');
};

feeStructureSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('FeeStructure', feeStructureSchema); 