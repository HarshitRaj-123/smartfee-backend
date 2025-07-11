const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { permit } = require('../middleware/permission.middleware');

const {
  recordPayment,
  getPayments,
  getPaymentById,
  getPaymentsByStudent,
  getPaymentStats,
  updatePaymentStatus,
  refundPayment,
  generatePaymentQR,
  getPaymentDashboard,
  verifyOfflinePayment,
  getPaymentReceipt
} = require('../controllers/payment.controller');

// Apply authentication middleware to all routes
router.use(authenticate);

// Routes for payment management
router.post('/', permit('FEE_PAYMENT'), recordPayment);
router.get('/', permit('FEE_PAYMENT'), getPayments);
router.get('/stats', permit('FEE_MANAGEMENT'), getPaymentStats);
router.get('/student/:studentId', permit('FEE_PAYMENT'), getPaymentsByStudent);
router.get('/:id', permit('FEE_PAYMENT'), getPaymentById);
router.patch('/:id/status', permit('FEE_MANAGEMENT'), updatePaymentStatus);
router.post('/:id/refund', permit('FEE_MANAGEMENT'), refundPayment);

// Generate QR code for payment
// Admin and Accountant can generate QR codes
router.post('/generate-qr',
  permit('FEE_PAYMENT'),
  generatePaymentQR
);

// Get payment dashboard data
// Admin and Accountant can view dashboard
router.get('/dashboard',
  permit('FEE_MANAGEMENT'),
  getPaymentDashboard
);

// Verify offline payment
// Admin and Super Admin can verify payments
router.patch('/:id/verify',
  permit('FEE_MANAGEMENT'),
  verifyOfflinePayment
);

// Get payment receipt data
// Admin, Accountant can get any receipt, Students can get their own
router.get('/:id/receipt',
  permit('FEE_PAYMENT'),
  getPaymentReceipt
);

module.exports = router; 