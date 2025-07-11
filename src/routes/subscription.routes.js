const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Create new subscription (EMI plan)
// Admin and Accountant can create subscriptions
router.post('/',
  permissionMiddleware(['admin', 'super_admin', 'accountant']),
  subscriptionController.createSubscription
);

// Get all subscriptions with pagination and filters
// Admin and Accountant can view all subscriptions
router.get('/',
  permissionMiddleware(['admin', 'super_admin', 'accountant']),
  subscriptionController.getSubscriptions
);

// Get subscription statistics
// Admin and Accountant can view stats
router.get('/stats',
  permissionMiddleware(['admin', 'super_admin', 'accountant']),
  subscriptionController.getSubscriptionStats
);

// Get subscriptions due for charge (for cron jobs)
// Only Super Admin can access this
router.get('/due-for-charge',
  permissionMiddleware(['super_admin']),
  subscriptionController.getSubscriptionsDueForCharge
);

// Get subscription by ID
// Admin, Accountant can view any subscription, Students can view their own
router.get('/:id',
  subscriptionController.getSubscriptionById
);

// Get student subscriptions
// Admin, Accountant can view any student's subscriptions, Students can view their own
router.get('/student/:studentId',
  subscriptionController.getStudentSubscriptions
);

// Approve subscription (for admin approval workflow)
// Only Admin and Super Admin can approve
router.patch('/:id/approve',
  permissionMiddleware(['admin', 'super_admin']),
  subscriptionController.approveSubscription
);

// Cancel subscription
// Admin and Super Admin can cancel any subscription
router.patch('/:id/cancel',
  permissionMiddleware(['admin', 'super_admin']),
  subscriptionController.cancelSubscription
);

// Retry failed payment
// Admin and Super Admin can retry failed payments
router.post('/:id/retry-payment',
  permissionMiddleware(['admin', 'super_admin']),
  subscriptionController.retryFailedPayment
);

// Handle subscription webhook (no auth required for webhook)
router.post('/webhook', (req, res, next) => {
  // Skip auth middleware for webhook
  subscriptionController.handleSubscriptionWebhook(req, res);
});

module.exports = router; 