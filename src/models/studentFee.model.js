const mongoose = require('mongoose');

const studentFeeItemSchema = new mongoose.Schema({
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
  originalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paid: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  notes: {
    type: String,
    maxlength: 300
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isOptional: {
    type: Boolean,
    default: false
  },
  isIncluded: {
    type: Boolean,
    default: true
    // For optional services - can be excluded after generation
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const fineSchema = new mongoose.Schema({
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
  reason: {
    type: String,
    required: true
  },
  imposedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  imposedDate: {
    type: Date,
    default: Date.now
  },
  isPaid: {
    type: Boolean,
    default: false
  }
}, { _id: true });

const discountSchema = new mongoose.Schema({
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
    enum: ['percentage', 'fixed'],
    default: 'fixed'
  },
  reason: {
    type: String,
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedDate: {
    type: Date,
    default: Date.now
  },
  appliedTo: [{
    feeItemId: mongoose.Schema.Types.ObjectId,
    amount: Number
  }]
}, { _id: true });

const studentFeeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: false
  },
  semester: {
    type: Number,
    required: false,
    min: 1,
    max: 10
  },
  academicYear: {
    type: String,
    required: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeTemplate',
    required: false
  },
  feeItems: [studentFeeItemSchema],
  fines: [fineSchema],
  discounts: [discountSchema],
  totalDue: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  totalFines: {
    type: Number,
    default: 0
  },
  totalDiscounts: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'overdue'],
    default: 'unpaid'
  },
  dueDate: {
    type: Date
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
studentFeeSchema.index({ studentId: 1, semester: 1, academicYear: 1 });
studentFeeSchema.index({ courseId: 1, semester: 1 });
studentFeeSchema.index({ status: 1, dueDate: 1 });
studentFeeSchema.index({ templateId: 1 });

// Pre-save middleware to calculate totals and status
studentFeeSchema.pre('save', function(next) {
  // Calculate total due from included fee items
  this.totalDue = this.feeItems
    .filter(item => item.isIncluded)
    .reduce((total, item) => total + item.originalAmount, 0);
  
  // Calculate total paid from included fee items
  this.totalPaid = this.feeItems
    .filter(item => item.isIncluded)
    .reduce((total, item) => total + item.paid, 0);
  
  // Calculate total fines
  this.totalFines = this.fines
    .filter(fine => !fine.isPaid)
    .reduce((total, fine) => total + fine.amount, 0);
  
  // Calculate total discounts
  this.totalDiscounts = this.discounts
    .reduce((total, discount) => total + discount.amount, 0);
  
  // Calculate net amount
  this.netAmount = this.totalDue + this.totalFines - this.totalDiscounts;
  
  // Update overall status
  if (this.totalPaid === 0) {
    this.status = 'unpaid';
  } else if (this.totalPaid >= this.netAmount) {
    this.status = 'paid';
  } else {
    this.status = 'partial';
  }
  
  // Check for overdue
  if (this.dueDate && this.dueDate < new Date() && this.status !== 'paid') {
    this.status = 'overdue';
  }
  
  // Update individual fee item status
  this.feeItems.forEach(item => {
    if (item.paid === 0) {
      item.status = 'unpaid';
    } else if (item.paid >= item.originalAmount) {
      item.status = 'paid';
    } else {
      item.status = 'partial';
    }
    item.lastUpdated = new Date();
  });
  
  next();
});

// Virtual for balance due
studentFeeSchema.virtual('balanceDue').get(function() {
  return Math.max(0, this.netAmount - this.totalPaid);
});

// Virtual for payment percentage
studentFeeSchema.virtual('paymentPercentage').get(function() {
  return this.netAmount > 0 ? Math.round((this.totalPaid / this.netAmount) * 100) : 0;
});

// Static method to get student fees by semester
studentFeeSchema.statics.getStudentFeesBySemester = function(studentId, semester, academicYear) {
  return this.findOne({
    studentId,
    semester,
    academicYear
  })
  .populate('studentId', 'firstName lastName studentId email')
  .populate('courseId', 'name code')
  .populate('feeItems.categoryId', 'name type')
  .populate('templateId', 'templateName');
};

// Static method to get overdue fees
studentFeeSchema.statics.getOverdueFees = function(filters = {}) {
  const query = {
    status: { $in: ['unpaid', 'partial', 'overdue'] },
    dueDate: { $lt: new Date() },
    ...filters
  };
  
  return this.find(query)
    .populate('studentId', 'firstName lastName studentId email')
    .populate('courseId', 'name code')
    .sort({ dueDate: 1 });
};

// Method to add fine
studentFeeSchema.methods.addFine = function(fineData) {
  this.fines.push(fineData);
  return this.save();
};

// Method to add discount
studentFeeSchema.methods.addDiscount = function(discountData) {
  this.discounts.push(discountData);
  return this.save();
};

// Method to record payment for specific fee items
studentFeeSchema.methods.recordPayment = function(paymentData) {
  const { paidFor, amount } = paymentData;
  let remainingAmount = amount;
  
  // Distribute payment across specified fee items
  paidFor.forEach(itemId => {
    const feeItem = this.feeItems.id(itemId);
    if (feeItem && remainingAmount > 0) {
      const itemBalance = feeItem.originalAmount - feeItem.paid;
      const paymentForItem = Math.min(remainingAmount, itemBalance);
      feeItem.paid += paymentForItem;
      remainingAmount -= paymentForItem;
    }
  });
  
  return this.save();
};

module.exports = mongoose.model('StudentFee', studentFeeSchema); 