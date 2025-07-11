const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Recipient information
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientRole: {
    type: String,
    enum: ['student', 'admin', 'accountant', 'super_admin'],
    required: true
  },
  
  // Notification content
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: [
      'semester_upgrade',
      'service_change', 
      'fee_assigned',
      'payment_reminder',
      'fine_added',
      'discount_applied',
      'payment_received',
      'system_alert',
      'general_announcement'
    ],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Notification metadata
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['student_fee', 'payment', 'semester_upgrade', 'service', 'course', 'user']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  
  // Delivery channels
  channels: {
    app: {
      enabled: { type: Boolean, default: true },
      delivered: { type: Boolean, default: false },
      deliveredAt: { type: Date }
    },
    email: {
      enabled: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      deliveredAt: { type: Date },
      emailAddress: { type: String }
    },
    sms: {
      enabled: { type: Boolean, default: false },
      delivered: { type: Boolean, default: false },
      deliveredAt: { type: Date },
      phoneNumber: { type: String }
    }
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  
  // Scheduling
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  
  // Sender information
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sentBySystem: {
    type: Boolean,
    default: false
  },
  
  // Additional data
  actionUrl: {
    type: String,
    maxlength: 500
  },
  actionLabel: {
    type: String,
    maxlength: 50
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, type: 1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ isRead: 1, recipientId: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create semester upgrade notification
notificationSchema.statics.createSemesterUpgradeNotification = function(student, upgradeData) {
  return this.create({
    recipientId: student._id,
    recipientRole: 'student',
    title: 'Semester Upgraded Successfully',
    message: `Congratulations! You have been upgraded to Semester ${upgradeData.toSemester} for the academic year ${upgradeData.academicYear}.`,
    type: 'semester_upgrade',
    priority: 'high',
    relatedEntity: {
      entityType: 'semester_upgrade',
      entityId: upgradeData.upgradeLogId
    },
    channels: {
      app: { enabled: true },
      email: { 
        enabled: true, 
        emailAddress: student.email 
      },
      sms: { 
        enabled: !!student.phone, 
        phoneNumber: student.phone 
      }
    },
    sentBySystem: true,
    actionUrl: '/student/semester-info',
    actionLabel: 'View Details',
    metadata: {
      fromSemester: upgradeData.fromSemester,
      toSemester: upgradeData.toSemester,
      courseId: upgradeData.courseId,
      academicYear: upgradeData.academicYear
    }
  });
};

// Static method to create service change notification
notificationSchema.statics.createServiceChangeNotification = function(student, serviceData) {
  const action = serviceData.isOpted ? 'opted into' : 'opted out of';
  
  return this.create({
    recipientId: student._id,
    recipientRole: 'student',
    title: `${serviceData.serviceName} Service Updated`,
    message: `You have successfully ${action} ${serviceData.serviceName} service. ${serviceData.isOpted ? 'Service charges will be reflected in your next fee structure.' : 'Service charges have been removed from future fees.'}`,
    type: 'service_change',
    priority: 'medium',
    relatedEntity: {
      entityType: 'service',
      entityId: student._id
    },
    channels: {
      app: { enabled: true },
      email: { 
        enabled: true, 
        emailAddress: student.email 
      }
    },
    sentBySystem: true,
    actionUrl: '/student/services',
    actionLabel: 'View Services',
    metadata: {
      serviceName: serviceData.serviceName,
      isOpted: serviceData.isOpted,
      serviceData: serviceData.serviceData
    }
  });
};

// Static method to create fee assigned notification
notificationSchema.statics.createFeeAssignedNotification = function(student, feeData) {
  return this.create({
    recipientId: student._id,
    recipientRole: 'student',
    title: 'New Fee Structure Assigned',
    message: `Fee structure for Semester ${feeData.semester} has been assigned. Total amount: ₹${feeData.totalAmount}. Due date: ${feeData.dueDate.toLocaleDateString()}.`,
    type: 'fee_assigned',
    priority: 'high',
    relatedEntity: {
      entityType: 'student_fee',
      entityId: feeData._id
    },
    channels: {
      app: { enabled: true },
      email: { 
        enabled: true, 
        emailAddress: student.email 
      },
      sms: { 
        enabled: !!student.phone, 
        phoneNumber: student.phone 
      }
    },
    sentBySystem: true,
    actionUrl: '/student/fee-details',
    actionLabel: 'View Fee Details',
    metadata: {
      semester: feeData.semester,
      totalAmount: feeData.totalAmount,
      dueDate: feeData.dueDate,
      academicYear: feeData.academicYear
    }
  });
};

// Static method to create payment reminder
notificationSchema.statics.createPaymentReminderNotification = function(student, feeData, daysOverdue = 0) {
  const isOverdue = daysOverdue > 0;
  const title = isOverdue ? 'Payment Overdue' : 'Payment Reminder';
  const message = isOverdue 
    ? `Your payment for Semester ${feeData.semester} is overdue by ${daysOverdue} days. Amount due: ₹${feeData.balanceDue}. Please pay immediately to avoid additional charges.`
    : `Reminder: Your payment for Semester ${feeData.semester} is due on ${feeData.dueDate.toLocaleDateString()}. Amount due: ₹${feeData.balanceDue}.`;
  
  return this.create({
    recipientId: student._id,
    recipientRole: 'student',
    title,
    message,
    type: 'payment_reminder',
    priority: isOverdue ? 'urgent' : 'high',
    relatedEntity: {
      entityType: 'student_fee',
      entityId: feeData._id
    },
    channels: {
      app: { enabled: true },
      email: { 
        enabled: true, 
        emailAddress: student.email 
      },
      sms: { 
        enabled: !!student.phone, 
        phoneNumber: student.phone 
      }
    },
    sentBySystem: true,
    actionUrl: '/student/fee-payment',
    actionLabel: 'Pay Now',
    metadata: {
      semester: feeData.semester,
      balanceDue: feeData.balanceDue,
      dueDate: feeData.dueDate,
      daysOverdue,
      isOverdue
    }
  });
};

// Static method to get unread notifications count
notificationSchema.statics.getUnreadCount = function(recipientId) {
  return this.countDocuments({
    recipientId,
    isRead: false,
    status: { $ne: 'failed' }
  });
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = function(notificationIds, recipientId) {
  return this.updateMany(
    {
      _id: { $in: notificationIds },
      recipientId,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
        status: 'read'
      }
    }
  );
};

// Method to mark single notification as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  this.status = 'read';
  return this.save();
};

// Method to mark as delivered for a specific channel
notificationSchema.methods.markAsDelivered = function(channel) {
  if (this.channels[channel]) {
    this.channels[channel].delivered = true;
    this.channels[channel].deliveredAt = new Date();
    
    // Update overall status if all enabled channels are delivered
    const enabledChannels = Object.keys(this.channels).filter(ch => this.channels[ch].enabled);
    const deliveredChannels = enabledChannels.filter(ch => this.channels[ch].delivered);
    
    if (enabledChannels.length === deliveredChannels.length) {
      this.status = 'delivered';
    }
    
    this.markModified('channels');
  }
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema); 