const SubscriptionService = require('../services/subscription.service');
const Subscription = require('../models/subscription.model');
const StudentFee = require('../models/studentFee.model');
const User = require('../models/user.model');

// Create new subscription (EMI plan)
const createSubscription = async (req, res) => {
  try {
    const {
      studentId,
      studentFeeId,
      planType,
      totalAmount,
      installmentAmount,
      totalInstallments,
      startDate,
      notes
    } = req.body;

    // Validate required fields
    if (!studentId || !studentFeeId || !planType || !totalAmount || !installmentAmount || !totalInstallments) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate plan type
    if (!['monthly', 'quarterly', 'yearly'].includes(planType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type. Must be monthly, quarterly, or yearly'
      });
    }

    // Validate amounts
    if (installmentAmount * totalInstallments !== totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Total amount must equal installment amount × total installments'
      });
    }

    const subscriptionData = {
      studentId,
      studentFeeId,
      planType,
      totalAmount,
      installmentAmount,
      totalInstallments,
      startDate: startDate || new Date(),
      createdBy: req.user.id,
      notes
    };

    const result = await SubscriptionService.createSubscription(subscriptionData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription: result.subscription,
        authUrl: result.authUrl
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all subscriptions with pagination and filters
const getSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      planType,
      studentId,
      academicYear,
      semester,
      search
    } = req.query;

    const filters = {};
    
    if (status) filters.status = status;
    if (planType) filters.planType = planType;
    if (studentId) filters.studentId = studentId;
    if (academicYear) filters.academicYear = academicYear;
    if (semester) filters.semester = parseInt(semester);

    let query = Subscription.find(filters)
      .populate('studentId', 'firstName lastName studentId email phone')
      .populate('studentFeeId', 'semester academicYear totalDue totalPaid')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Add search functionality
    if (search) {
      query = query.populate({
        path: 'studentId',
        match: {
          $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { studentId: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    const total = await Subscription.countDocuments(filters);
    const subscriptions = await query
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Filter out subscriptions where student doesn't match search
    const filteredSubscriptions = search 
      ? subscriptions.filter(sub => sub.studentId)
      : subscriptions;

    res.json({
      success: true,
      data: {
        subscriptions: filteredSubscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get subscription by ID
const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await SubscriptionService.getSubscriptionDetails(id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      data: result.subscription
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get student subscriptions
const getStudentSubscriptions = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, academicYear, semester } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (academicYear) filters.academicYear = academicYear;
    if (semester) filters.semester = parseInt(semester);

    const result = await SubscriptionService.getStudentSubscriptions(studentId, filters);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      data: result.subscriptions
    });
  } catch (error) {
    console.error('Error getting student subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    const result = await SubscriptionService.cancelSubscription(id, req.user.id, reason);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get subscription statistics
const getSubscriptionStats = async (req, res) => {
  try {
    const { academicYear, semester, planType, dateFrom, dateTo } = req.query;

    const filters = {};
    if (academicYear) filters.academicYear = academicYear;
    if (semester) filters.semester = parseInt(semester);
    if (planType) filters.planType = planType;
    
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo);
    }

    const result = await SubscriptionService.getSubscriptionStats(filters);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      data: result.stats
    });
  } catch (error) {
    console.error('Error getting subscription stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Handle subscription webhook
const handleSubscriptionWebhook = async (req, res) => {
  try {
    const event = req.headers['x-razorpay-event-id'];
    const signature = req.headers['x-razorpay-signature'];
    const payload = req.body;

    // Verify webhook signature (implement actual verification)
    // const isValidSignature = RazorpayService.verifyWebhookSignature(payload, signature);
    // if (!isValidSignature) {
    //   return res.status(400).json({ success: false, message: 'Invalid signature' });
    // }

    const result = await SubscriptionService.handleSubscriptionWebhook(event, payload);

    if (!result.success) {
      console.error('Webhook processing failed:', result.error);
      return res.status(400).json({
        success: false,
        message: result.error
      });
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('Error handling subscription webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Approve subscription (for admin approval workflow)
const approveSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    if (subscription.status !== 'created') {
      return res.status(400).json({
        success: false,
        message: 'Subscription cannot be approved in current status'
      });
    }

    subscription.approvedBy = req.user.id;
    subscription.status = 'authenticated';
    if (notes) {
      subscription.notes = (subscription.notes || '') + `\nApproved: ${notes}`;
    }

    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription approved successfully',
      data: subscription
    });
  } catch (error) {
    console.error('Error approving subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get active subscriptions due for charge (for cron jobs)
const getSubscriptionsDueForCharge = async (req, res) => {
  try {
    const subscriptions = await Subscription.getSubscriptionsDueForCharge();

    res.json({
      success: true,
      data: {
        subscriptions,
        count: subscriptions.length
      }
    });
  } catch (error) {
    console.error('Error getting subscriptions due for charge:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Retry failed subscription payment
const retryFailedPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { installmentNumber } = req.body;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    const failedPayment = subscription.failedPayments.find(
      fp => fp.installmentNumber === installmentNumber
    );

    if (!failedPayment) {
      return res.status(404).json({
        success: false,
        message: 'Failed payment not found'
      });
    }

    // This would trigger a retry in Razorpay
    // For now, we'll just update the retry count and next retry date
    failedPayment.retryCount += 1;
    failedPayment.nextRetryAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours later

    await subscription.save();

    res.json({
      success: true,
      message: 'Payment retry scheduled',
      data: {
        installmentNumber,
        retryCount: failedPayment.retryCount,
        nextRetryAt: failedPayment.nextRetryAt
      }
    });
  } catch (error) {
    console.error('Error retrying failed payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  createSubscription,
  getSubscriptions,
  getSubscriptionById,
  getStudentSubscriptions,
  cancelSubscription,
  getSubscriptionStats,
  handleSubscriptionWebhook,
  approveSubscription,
  getSubscriptionsDueForCharge,
  retryFailedPayment
}; 