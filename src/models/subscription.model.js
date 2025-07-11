const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // Student and fee information
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
  
  // Razorpay subscription details
  razorpaySubscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayPlanId: {
    type: String,
    required: true
  },
  razorpayCustomerId: {
    type: String,
    required: true
  },
  
  // Subscription configuration
  planType: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    required: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  installmentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalInstallments: {
    type: Number,
    required: true,
    min: 1
  },
  completedInstallments: {
    type: Number,
    default: 0
  },
  
  // Subscription status and dates
  status: {
    type: String,
    enum: ['created', 'authenticated', 'active', 'paused', 'halted', 'cancelled', 'completed', 'expired'],
    default: 'created'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  nextChargeAt: {
    type: Date
  },
  
  // Payment tracking
  paidInstallments: [{
    installmentNumber: {
      type: Number,
      required: true
    },
    razorpayPaymentId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    paidAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'success'
    },
    receiptNo: {
      type: String,
      required: true
    },
    notes: String
  }],
  
  // Failed payments tracking
  failedPayments: [{
    installmentNumber: {
      type: Number,
      required: true
    },
    razorpayPaymentId: String,
    failedAt: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    retryCount: {
      type: Number,
      default: 0
    },
    nextRetryAt: Date
  }],
  
  // Subscription metadata
  notes: {
    type: String,
    maxlength: 1000
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: String,
  
  // Academic information
  academicYear: {
    type: String,
    required: true
  },
  semester: {
    type: Number,
    required: true
  },
  
  // Customer and payment method info
  customerDetails: {
    name: String,
    email: String,
    phone: String
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet'],
    required: true
  },
  
  // Webhook tracking
  webhookEvents: [{
    eventType: {
      type: String,
      required: true
    },
    eventData: {
      type: mongoose.Schema.Types.Mixed
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['processed', 'failed', 'ignored'],
      default: 'processed'
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
subscriptionSchema.index({ studentId: 1, academicYear: 1, semester: 1 });
subscriptionSchema.index({ razorpaySubscriptionId: 1 });
subscriptionSchema.index({ status: 1, nextChargeAt: 1 });
subscriptionSchema.index({ createdBy: 1, status: 1 });

// Virtual for remaining amount
subscriptionSchema.virtual('remainingAmount').get(function() {
  return this.totalAmount - (this.completedInstallments * this.installmentAmount);
});

// Virtual for completion percentage
subscriptionSchema.virtual('completionPercentage').get(function() {
  return Math.round((this.completedInstallments / this.totalInstallments) * 100);
});

// Static method to get active subscriptions
subscriptionSchema.statics.getActiveSubscriptions = function(filters = {}) {
  const query = {
    status: { $in: ['active', 'authenticated'] },
    ...filters
  };
  
  return this.find(query)
    .populate('studentId', 'firstName lastName studentId email phone')
    .populate('studentFeeId', 'semester academicYear totalDue totalPaid')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 });
};

// Static method to get subscriptions due for charge
subscriptionSchema.statics.getSubscriptionsDueForCharge = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    nextChargeAt: { $lte: now },
    completedInstallments: { $lt: this.totalInstallments }
  })
  .populate('studentId', 'firstName lastName email phone')
  .populate('studentFeeId');
};

// Method to record successful payment
subscriptionSchema.methods.recordPayment = function(paymentData) {
  const { razorpayPaymentId, amount, receiptNo, notes } = paymentData;
  
  this.paidInstallments.push({
    installmentNumber: this.completedInstallments + 1,
    razorpayPaymentId,
    amount,
    paidAt: new Date(),
    status: 'success',
    receiptNo,
    notes
  });
  
  this.completedInstallments += 1;
  
  // Update next charge date
  if (this.completedInstallments < this.totalInstallments) {
    const nextDate = new Date(this.nextChargeAt);
    if (this.planType === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (this.planType === 'quarterly') {
      nextDate.setMonth(nextDate.getMonth() + 3);
    } else if (this.planType === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    this.nextChargeAt = nextDate;
  } else {
    // Subscription completed
    this.status = 'completed';
    this.nextChargeAt = null;
  }
  
  return this.save();
};

// Method to record failed payment
subscriptionSchema.methods.recordFailedPayment = function(failureData) {
  const { razorpayPaymentId, reason } = failureData;
  
  const existingFailure = this.failedPayments.find(
    fp => fp.installmentNumber === this.completedInstallments + 1
  );
  
  if (existingFailure) {
    existingFailure.retryCount += 1;
    existingFailure.failedAt = new Date();
    existingFailure.reason = reason;
    
    // Set next retry (24 hours later)
    const nextRetry = new Date();
    nextRetry.setHours(nextRetry.getHours() + 24);
    existingFailure.nextRetryAt = nextRetry;
  } else {
    this.failedPayments.push({
      installmentNumber: this.completedInstallments + 1,
      razorpayPaymentId,
      failedAt: new Date(),
      reason,
      retryCount: 1,
      nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours later
    });
  }
  
  // If too many failures, halt subscription
  const currentFailure = this.failedPayments.find(
    fp => fp.installmentNumber === this.completedInstallments + 1
  );
  
  if (currentFailure && currentFailure.retryCount >= 3) {
    this.status = 'halted';
  }
  
  return this.save();
};

// Method to cancel subscription
subscriptionSchema.methods.cancelSubscription = function(cancelledBy, reason) {
  this.status = 'cancelled';
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  this.nextChargeAt = null;
  return this.save();
};

// Method to add webhook event
subscriptionSchema.methods.addWebhookEvent = function(eventType, eventData, status = 'processed') {
  this.webhookEvents.push({
    eventType,
    eventData,
    processedAt: new Date(),
    status
  });
  return this.save();
};

module.exports = mongoose.model('Subscription', subscriptionSchema); 