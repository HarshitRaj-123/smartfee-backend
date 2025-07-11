const mongoose = require('mongoose');

const feeItemSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeCategory',
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
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // For custom data like route/distance/roomType
    // Example: { route: "Route A", distance: "10km", roomType: "AC" }
  },
  isOptional: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    maxlength: 200
  }
}, { _id: true });

const feeTemplateSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course', // Assuming you have a Course model
    required: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  templateName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  feeItems: [feeItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isTemplate: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  academicYear: {
    type: String,
    required: true
    // Format: "2024-25"
  },
  description: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
feeTemplateSchema.index({ courseId: 1, semester: 1, academicYear: 1 });
feeTemplateSchema.index({ isTemplate: 1, isActive: 1 });
feeTemplateSchema.index({ createdBy: 1 });

// Pre-save middleware to calculate total amount
feeTemplateSchema.pre('save', function(next) {
  if (this.feeItems && this.feeItems.length > 0) {
    this.totalAmount = this.feeItems.reduce((total, item) => total + item.amount, 0);
  }
  next();
});

// Virtual for template identifier
feeTemplateSchema.virtual('templateIdentifier').get(function() {
  return `${this.templateName} - Sem ${this.semester} (${this.academicYear})`;
});

// Static method to get template by course and semester
feeTemplateSchema.statics.getTemplateByCourse = function(courseId, semester, academicYear) {
  return this.findOne({
    courseId,
    semester,
    academicYear,
    isTemplate: true,
    isActive: true
  }).populate('feeItems.categoryId');
};

// Static method to get all active templates
feeTemplateSchema.statics.getActiveTemplates = function(filters = {}) {
  const query = { isTemplate: true, isActive: true, ...filters };
  return this.find(query)
    .populate('courseId', 'name code')
    .populate('feeItems.categoryId', 'name type')
    .sort({ courseId: 1, semester: 1 });
};

// Method to clone template for student
feeTemplateSchema.methods.cloneForStudent = function(studentId) {
  const studentFeeData = {
    studentId,
    courseId: this.courseId,
    semester: this.semester,
    academicYear: this.academicYear,
    templateId: this._id,
    feeItems: this.feeItems.map(item => ({
      categoryId: item.categoryId,
      name: item.name,
      originalAmount: item.amount,
      paid: 0,
      status: 'unpaid',
      meta: item.meta,
      isOptional: item.isOptional,
      description: item.description
    })),
    totalDue: this.totalAmount,
    totalPaid: 0
  };
  
  return studentFeeData;
};

module.exports = mongoose.model('FeeTemplate', feeTemplateSchema); 