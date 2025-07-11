const express = require('express');
const router = express.Router();
const razorpayController = require('../controllers/razorpay.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Create Razorpay order
router.post('/create-order', authMiddleware, razorpayController.createOrder);

// Verify payment
router.post('/verify-payment', authMiddleware, razorpayController.verifyPayment);

// Handle webhooks (no auth required)
router.post('/webhook', razorpayController.handleWebhook);

// Get payment status
router.get('/payment-status/:paymentId', authMiddleware, razorpayController.getPaymentStatus);

// Create refund
router.post('/refund/:paymentId', authMiddleware, razorpayController.createRefund);

module.exports = router; 