const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'accountant', 'student'],
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Student-specific fields
  studentId: {
    type: String,
    trim: true,
    sparse: true // Allows multiple null values
  },
  enrollmentDate: {
    type: Date
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  // Course information from organized courses (alternative to courseId)
  courseInfo: {
    category: { type: String, trim: true },
    program_name: { type: String, trim: true },
    branch: { type: String, trim: true },
    course_name: { type: String, trim: true },
    duration: { type: String, trim: true },
    totalSemesters: { type: Number }
  },
  currentSemester: {
    type: Number,
    min: 1,
    max: 12,
    default: 1
  },
  academicYear: {
    type: String // Format: "2024-25"
  },
  rollNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  yearOfJoining: {
    type: Number
  },
  
  // Services opted by student
  servicesOpted: {
    hostel: {
      isOpted: { type: Boolean, default: false },
      roomType: { type: String, enum: ['single', 'double', 'triple', 'ac', 'non-ac'], default: 'double' },
      blockName: { type: String, trim: true },
      roomNumber: { type: String, trim: true },
      optedDate: { type: Date },
      lastModified: { type: Date, default: Date.now }
    },
    mess: {
      isOpted: { type: Boolean, default: false },
      mealType: { type: String, enum: ['veg', 'non-veg', 'both'], default: 'veg' },
      planType: { type: String, enum: ['monthly', 'semester', 'annual'], default: 'monthly' },
      optedDate: { type: Date },
      lastModified: { type: Date, default: Date.now }
    },
    transport: {
      isOpted: { type: Boolean, default: false },
      route: { type: String, trim: true },
      distance: { type: Number }, // in km
      pickupPoint: { type: String, trim: true },
      optedDate: { type: Date },
      lastModified: { type: Date, default: Date.now }
    },
    library: {
      isOpted: { type: Boolean, default: true },
      cardNumber: { type: String, trim: true },
      optedDate: { type: Date },
      lastModified: { type: Date, default: Date.now }
    }
  },
  
  // Academic status
  academicStatus: {
    type: String,
    enum: ['active', 'on_hold', 'backlog', 'suspended', 'graduated', 'dropped'],
    default: 'active'
  },
  isUpgradeEligible: {
    type: Boolean,
    default: true
  },
  upgradeHoldReason: {
    type: String,
    trim: true
  },
  
  // Staff-specific fields  
  employeeId: {
    type: String,
    trim: true,
    sparse: true // Allows multiple null values
  },
  joinDate: {
    type: Date
  },
  // Common profile fields
  department: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    trim: true
  },
  aadhaarNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  // Guardian information
  guardianName: {
    type: String,
    trim: true
  },
  guardianPhone: {
    type: String,
    trim: true
  },
  motherName: {
    type: String,
    trim: true
  },
  // Scholarship information
  scholarshipInfo: {
    isApplicable: { type: Boolean, default: false },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    type: { type: String, enum: ['merit', 'need-based', 'sports', 'cultural', 'other'], default: 'merit' },
    description: { type: String, trim: true },
    validFrom: { type: Date },
    validTo: { type: Date },
    lastModified: { type: Date, default: Date.now }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  profilePicture: {
    type: String,
    trim: true
  },
  preferences: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Authentication fields
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  refreshToken: {
    type: String
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
userSchema.index({ studentId: 1 });
userSchema.index({ courseId: 1, currentSemester: 1 });
userSchema.index({ academicYear: 1, currentSemester: 1 });
userSchema.index({ role: 1, isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to update service
userSchema.methods.updateService = function(serviceName, serviceData) {
  if (this.servicesOpted[serviceName]) {
    Object.assign(this.servicesOpted[serviceName], serviceData);
    this.servicesOpted[serviceName].lastModified = new Date();
    this.markModified(`servicesOpted.${serviceName}`);
  }
  return this.save();
};

// Method to opt in/out of service
userSchema.methods.toggleService = function(serviceName, isOpted, additionalData = {}) {
  if (this.servicesOpted[serviceName]) {
    this.servicesOpted[serviceName].isOpted = isOpted;
    if (isOpted) {
      this.servicesOpted[serviceName].optedDate = new Date();
    }
    Object.assign(this.servicesOpted[serviceName], additionalData);
    this.servicesOpted[serviceName].lastModified = new Date();
    this.markModified(`servicesOpted.${serviceName}`);
  }
  return this.save();
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for display ID (studentId for students, employeeId for staff)
userSchema.virtual('displayId').get(function() {
  return this.role === 'student' ? this.studentId : this.employeeId;
});

// Static method to get students by course and semester
userSchema.statics.getStudentsByCourse = function(courseId, semester = null) {
  const query = { 
    role: 'student', 
    courseId, 
    isActive: true 
  };
  if (semester) query.currentSemester = semester;
  
  return this.find(query)
    .populate('courseId', 'name code totalSemesters')
    .sort({ currentSemester: 1, lastName: 1 });
};

// Static method to get upgrade eligible students
userSchema.statics.getUpgradeEligibleStudents = function(courseId = null) {
  const query = {
    role: 'student',
    isActive: true,
    isUpgradeEligible: true,
    academicStatus: 'active'
  };
  if (courseId) query.courseId = courseId;
  
  return this.find(query)
    .populate('courseId', 'name code totalSemesters')
    .sort({ courseId: 1, currentSemester: 1 });
};

const User = mongoose.model('User', userSchema);

module.exports = User; 