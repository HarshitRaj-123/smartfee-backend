const RazorpayService = require('./razorpay.service');
const Subscription = require('../models/subscription.model');
const Payment = require('../models/payment.model');
const StudentFee = require('../models/studentFee.model');
const User = require('../models/user.model');

class SubscriptionService {
  // Create Razorpay plan for subscription
  static async createPlan(planData) {
    try {
      const { amount, interval, intervalCount, notes } = planData;
      
      const planOptions = {
        period: interval, // monthly, quarterly, yearly
        interval: intervalCount || 1,
        item: {
          name: 'SmartFee EMI Plan',
          amount: Math.round(amount * 100), // Convert to paise
          currency: 'INR'
        },
        notes
      };

      // This would be implemented with Razorpay Plans API
      // For now, we'll simulate the response
      const plan = {
        id: `plan_${Date.now()}`,
        entity: 'plan',
        interval: intervalCount,
        period: interval,
        item: planOptions.item,
        notes: notes || {},
        created_at: Math.floor(Date.now() / 1000)
      };

      return {
        success: true,
        plan
      };
    } catch (error) {
      console.error('Error creating plan:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create customer for subscription
  static async createCustomer(customerData) {
    try {
      const { name, email, phone, notes } = customerData;
      
      const customerOptions = {
        name,
        email,
        contact: phone,
        notes
      };

      // This would be implemented with Razorpay Customers API
      const customer = {
        id: `cust_${Date.now()}`,
        entity: 'customer',
        name,
        email,
        contact: phone,
        notes: notes || {},
        created_at: Math.floor(Date.now() / 1000)
      };

      return {
        success: true,
        customer
      };
    } catch (error) {
      console.error('Error creating customer:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create subscription
  static async createSubscription(subscriptionData) {
    try {
      const {
        studentId,
        studentFeeId,
        planType,
        totalAmount,
        installmentAmount,
        totalInstallments,
        startDate,
        createdBy,
        notes
      } = subscriptionData;

      // Validate student and fee
      const student = await User.findById(studentId);
      if (!student) {
        throw new Error('Student not found');
      }

      const studentFee = await StudentFee.findById(studentFeeId);
      if (!studentFee) {
        throw new Error('Student fee record not found');
      }

      // Create customer
      const customerData = await this.createCustomer({
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        phone: student.phone,
        notes: { studentId, purpose: 'EMI Payment' }
      });

      if (!customerData.success) {
        throw new Error('Failed to create customer');
      }

      // Create plan
      const planData = await this.createPlan({
        amount: installmentAmount,
        interval: planType,
        intervalCount: 1,
        notes: { studentId, totalAmount, totalInstallments }
      });

      if (!planData.success) {
        throw new Error('Failed to create plan');
      }

      // Calculate end date
      const endDate = new Date(startDate);
      if (planType === 'monthly') {
        endDate.setMonth(endDate.getMonth() + totalInstallments);
      } else if (planType === 'quarterly') {
        endDate.setMonth(endDate.getMonth() + (totalInstallments * 3));
      } else if (planType === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + totalInstallments);
      }

      // Create subscription in Razorpay (simulated)
      const razorpaySubscription = {
        id: `sub_${Date.now()}`,
        entity: 'subscription',
        plan_id: planData.plan.id,
        customer_id: customerData.customer.id,
        status: 'created',
        current_start: Math.floor(new Date(startDate).getTime() / 1000),
        current_end: Math.floor(endDate.getTime() / 1000),
        created_at: Math.floor(Date.now() / 1000)
      };

      // Create subscription record in database
      const subscription = new Subscription({
        studentId,
        studentFeeId,
        razorpaySubscriptionId: razorpaySubscription.id,
        razorpayPlanId: planData.plan.id,
        razorpayCustomerId: customerData.customer.id,
        planType,
        totalAmount,
        installmentAmount,
        totalInstallments,
        status: 'created',
        startDate: new Date(startDate),
        endDate,
        nextChargeAt: new Date(startDate),
        notes,
        createdBy,
        academicYear: studentFee.academicYear,
        semester: studentFee.semester,
        customerDetails: {
          name: `${student.firstName} ${student.lastName}`,
          email: student.email,
          phone: student.phone
        },
        paymentMethod: 'card' // Default, will be updated when student authorizes
      });

      await subscription.save();

      return {
        success: true,
        subscription,
        authUrl: `https://checkout.razorpay.com/v1/subscription_button.js?subscription_id=${razorpaySubscription.id}`
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Handle subscription webhook events
  static async handleSubscriptionWebhook(event, payload) {
    try {
      const subscriptionEntity = payload.subscription?.entity;
      const paymentEntity = payload.payment?.entity;

      if (!subscriptionEntity) {
        throw new Error('No subscription entity in webhook payload');
      }

      const subscription = await Subscription.findOne({
        razorpaySubscriptionId: subscriptionEntity.id
      });

      if (!subscription) {
        console.log('Subscription not found for webhook:', subscriptionEntity.id);
        return { success: true, message: 'Subscription not found' };
      }

      switch (event) {
        case 'subscription.authenticated':
          await this.handleSubscriptionAuthenticated(subscription, subscriptionEntity);
          break;

        case 'subscription.activated':
          await this.handleSubscriptionActivated(subscription, subscriptionEntity);
          break;

        case 'subscription.charged':
          await this.handleSubscriptionCharged(subscription, paymentEntity);
          break;

        case 'subscription.completed':
          await this.handleSubscriptionCompleted(subscription, subscriptionEntity);
          break;

        case 'subscription.halted':
          await this.handleSubscriptionHalted(subscription, subscriptionEntity);
          break;

        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(subscription, subscriptionEntity);
          break;

        case 'subscription.paused':
          await this.handleSubscriptionPaused(subscription, subscriptionEntity);
          break;

        default:
          console.log('Unhandled subscription webhook event:', event);
      }

      // Add webhook event to subscription
      await subscription.addWebhookEvent(event, { subscriptionEntity, paymentEntity });

      return { success: true };
    } catch (error) {
      console.error('Error handling subscription webhook:', error);
      return { success: false, error: error.message };
    }
  }

  // Handle subscription authenticated
  static async handleSubscriptionAuthenticated(subscription, subscriptionEntity) {
    subscription.status = 'authenticated';
    await subscription.save();
    console.log('Subscription authenticated:', subscription.razorpaySubscriptionId);
  }

  // Handle subscription activated
  static async handleSubscriptionActivated(subscription, subscriptionEntity) {
    subscription.status = 'active';
    await subscription.save();
    console.log('Subscription activated:', subscription.razorpaySubscriptionId);
  }

  // Handle subscription charged (successful payment)
  static async handleSubscriptionCharged(subscription, paymentEntity) {
    try {
      if (!paymentEntity) {
        throw new Error('No payment entity in webhook');
      }

      // Generate receipt number
      const receiptNo = await Payment.generateReceiptNo();

      // Record the installment payment
      await subscription.recordPayment({
        razorpayPaymentId: paymentEntity.id,
        amount: paymentEntity.amount / 100, // Convert from paise
        receiptNo,
        notes: `EMI Payment - Installment ${subscription.completedInstallments + 1}`
      });

      // Create payment record
      const payment = new Payment({
        studentId: subscription.studentId,
        studentFeeId: subscription.studentFeeId,
        mode: 'online',
        method: 'subscription',
        paidAmount: paymentEntity.amount / 100,
        receiptNo,
        transactionId: paymentEntity.id,
        razorpayPaymentId: paymentEntity.id,
        subscriptionId: subscription._id,
        installmentNumber: subscription.completedInstallments,
        paymentSource: 'subscription_auto',
        status: 'verified',
        academicYear: subscription.academicYear,
        semester: subscription.semester,
        addedBy: subscription.createdBy,
        paidFor: [{
          feeItemId: subscription.studentFeeId,
          name: `EMI Payment ${subscription.completedInstallments}`,
          amount: paymentEntity.amount / 100
        }]
      });

      await payment.save();

      // Update student fee
      const studentFee = await StudentFee.findById(subscription.studentFeeId);
      if (studentFee) {
        await studentFee.recordPayment({
          paidFor: [subscription.studentFeeId],
          amount: paymentEntity.amount / 100
        });
      }

      console.log('Subscription payment recorded:', paymentEntity.id);
    } catch (error) {
      console.error('Error handling subscription charge:', error);
    }
  }

  // Handle subscription completed
  static async handleSubscriptionCompleted(subscription, subscriptionEntity) {
    subscription.status = 'completed';
    await subscription.save();
    console.log('Subscription completed:', subscription.razorpaySubscriptionId);
  }

  // Handle subscription halted
  static async handleSubscriptionHalted(subscription, subscriptionEntity) {
    subscription.status = 'halted';
    await subscription.save();
    console.log('Subscription halted:', subscription.razorpaySubscriptionId);
  }

  // Handle subscription cancelled
  static async handleSubscriptionCancelled(subscription, subscriptionEntity) {
    subscription.status = 'cancelled';
    await subscription.save();
    console.log('Subscription cancelled:', subscription.razorpaySubscriptionId);
  }

  // Handle subscription paused
  static async handleSubscriptionPaused(subscription, subscriptionEntity) {
    subscription.status = 'paused';
    await subscription.save();
    console.log('Subscription paused:', subscription.razorpaySubscriptionId);
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId, cancelledBy, reason) {
    try {
      const subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Cancel in Razorpay (would make API call)
      // await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);

      // Update local record
      await subscription.cancelSubscription(cancelledBy, reason);

      return {
        success: true,
        message: 'Subscription cancelled successfully'
      };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get subscription details
  static async getSubscriptionDetails(subscriptionId) {
    try {
      const subscription = await Subscription.findById(subscriptionId)
        .populate('studentId', 'firstName lastName studentId email phone')
        .populate('studentFeeId', 'semester academicYear totalDue totalPaid')
        .populate('createdBy', 'firstName lastName')
        .populate('approvedBy', 'firstName lastName')
        .populate('cancelledBy', 'firstName lastName');

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      return {
        success: true,
        subscription
      };
    } catch (error) {
      console.error('Error getting subscription details:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get student subscriptions
  static async getStudentSubscriptions(studentId, filters = {}) {
    try {
      const query = { studentId, ...filters };
      
      const subscriptions = await Subscription.find(query)
        .populate('studentFeeId', 'semester academicYear totalDue totalPaid')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 });

      return {
        success: true,
        subscriptions
      };
    } catch (error) {
      console.error('Error getting student subscriptions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get subscription statistics
  static async getSubscriptionStats(filters = {}) {
    try {
      const stats = await Subscription.aggregate([
        { $match: filters },
        {
          $group: {
            _id: null,
            totalSubscriptions: { $sum: 1 },
            activeSubscriptions: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            completedSubscriptions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelledSubscriptions: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            totalAmount: { $sum: '$totalAmount' },
            totalCollected: {
              $sum: { $multiply: ['$completedInstallments', '$installmentAmount'] }
            }
          }
        }
      ]);

      return {
        success: true,
        stats: stats[0] || {
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          completedSubscriptions: 0,
          cancelledSubscriptions: 0,
          totalAmount: 0,
          totalCollected: 0
        }
      };
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SubscriptionService; 