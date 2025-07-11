const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentFeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentFee',
    required: true
  },
  mode: {
    type: String,
    enum: ['online', 'offline'],
    required: true
  },
  method: {
    type: String,
    enum: ['upi', 'cash', 'cheque', 'card', 'netbanking', 'wallet', 'razorpay', 'subscription', 'qr_code'],
    required: true
  },
  paidAmount: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  paidFor: [{
    feeItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FeeCategory'
    },
    name: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  receiptNo: {
    type: String,
    required: true,
    unique: true
  },
  transactionId: {
    type: String,
    // For online payments
  },
  chequeDetails: {
    chequeNo: String,
    bankName: String,
    chequeDate: Date,
    status: {
      type: String,
      enum: ['pending', 'cleared', 'bounced'],
      default: 'pending'
    }
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'verified', 'failed', 'refunded'],
    default: 'confirmed'
  },
  // Razorpay specific fields
  razorpayOrderId: {
    type: String,
    // Razorpay order ID
  },
  razorpayPaymentId: {
    type: String,
    // Razorpay payment ID
  },
  razorpaySignature: {
    type: String,
    // Razorpay signature for verification
  },
  paymentStatus: {
    type: String,
    enum: ['created', 'authorized', 'captured', 'refunded', 'failed'],
    // Razorpay payment status
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundStatus: {
    type: String,
    enum: ['none', 'partial', 'full'],
    default: 'none'
  },
  // Subscription/EMI specific fields
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
    // For EMI payments via subscription
  },
  installmentNumber: {
    type: Number,
    // For EMI payments - which installment this payment represents
  },
  isPartialPayment: {
    type: Boolean,
    default: false
  },
  partialPaymentGroup: {
    type: String,
    // Groups multiple partial payments together
  },
  // QR Code payment fields
  qrCodeId: {
    type: String,
    // Unique QR code identifier for tracking
  },
  qrCodeGeneratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Admin/Accountant who generated the QR code
  },
  // Payment source tracking
  paymentSource: {
    type: String,
    enum: ['student_portal', 'admin_entry', 'qr_scan', 'subscription_auto', 'walk_in'],
    default: 'admin_entry'
  },
  // Receipt and notification status
  receiptSent: {
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  // Admin verification for offline payments
  requiresVerification: {
    type: Boolean,
    default: false
  },
  verificationNotes: {
    type: String,
    maxlength: 500
  },
  notes: {
    type: String,
    maxlength: 500
  },
  academicYear: {
    type: String,
    required: true
  },
  semester: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
paymentSchema.index({ studentId: 1, date: -1 });
paymentSchema.index({ studentFeeId: 1 });
paymentSchema.index({ receiptNo: 1 });
paymentSchema.index({ status: 1, date: -1 });
paymentSchema.index({ mode: 1, method: 1 });
paymentSchema.index({ academicYear: 1, semester: 1 });

// Virtual for formatted receipt number
paymentSchema.virtual('formattedReceiptNo').get(function() {
  return `SF-${this.receiptNo}`;
});

// Static method to generate receipt number
paymentSchema.statics.generateReceiptNo = async function() {
  const currentYear = new Date().getFullYear();
  const count = await this.countDocuments({
    createdAt: {
      $gte: new Date(currentYear, 0, 1),
      $lt: new Date(currentYear + 1, 0, 1)
    }
  });
  
  return `${currentYear}${String(count + 1).padStart(6, '0')}`;
};

// Static method to get payments by student
paymentSchema.statics.getPaymentsByStudent = function(studentId, filters = {}) {
  const query = { studentId, ...filters };
  return this.find(query)
    .populate('studentFeeId', 'semester academicYear')
    .populate('addedBy', 'firstName lastName')
    .populate('verifiedBy', 'firstName lastName')
    .sort({ date: -1 });
};

// Static method to get payments by date range
paymentSchema.statics.getPaymentsByDateRange = function(startDate, endDate, filters = {}) {
  const query = {
    date: { $gte: startDate, $lte: endDate },
    ...filters
  };
  return this.find(query)
    .populate('studentId', 'firstName lastName studentId')
    .populate('studentFeeId', 'semester academicYear')
    .populate('addedBy', 'firstName lastName')
    .sort({ date: -1 });
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function(filters = {}) {
  const stats = await this.aggregate([
    { $match: filters },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$paidAmount' },
        totalPayments: { $sum: 1 },
        avgPayment: { $avg: '$paidAmount' },
        onlinePayments: {
          $sum: { $cond: [{ $eq: ['$mode', 'online'] }, 1, 0] }
        },
        offlinePayments: {
          $sum: { $cond: [{ $eq: ['$mode', 'offline'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalAmount: 0,
    totalPayments: 0,
    avgPayment: 0,
    onlinePayments: 0,
    offlinePayments: 0
  };
};

// Method to mark payment as verified
paymentSchema.methods.markAsVerified = function(verifiedBy) {
  this.verifiedBy = verifiedBy;
  this.status = 'confirmed';
  return this.save();
};

// Method to refund payment
paymentSchema.methods.refund = function(reason) {
  this.status = 'refunded';
  this.notes = (this.notes || '') + `\nRefunded: ${reason}`;
  return this.save();
};

module.exports = mongoose.model('Payment', paymentSchema); 