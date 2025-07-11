const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');

// Controllers (replace with your actual controller functions)
const {
  addOfflinePayment,
  editOfflinePayment,
  viewFeeStructure,
  viewServiceInfo,
  generateReceipt,
  viewReports,
  updateProfile,
  sendPaymentReminder,
} = require('../controllers/accountant.controller');

// All routes require authentication first
router.use(requireAuth);

// --- Offline Fee Entry (Super Admin, Admin, Accountant) ---
router.post('/payments/offline', permit('OFFLINE_FEE_ENTRY'), addOfflinePayment);
router.put('/payments/offline/:id', permit('OFFLINE_FEE_ENTRY'), editOfflinePayment);

// --- View Fee Structure (Accountant, Student) ---
router.get('/students/:id/fee-structure', permit('VIEW_FEE_DETAILS'), viewFeeStructure);

// --- View Service Info (Accountant, Student) ---
router.get('/students/:id/services', permit('VIEW_SERVICES'), viewServiceInfo);

// --- Generate Receipt (Accountant, Student) ---
router.post('/payments/:id/receipt', permit('RECEIPT_GENERATION'), generateReceipt);

// --- Reports (Accountant, Super Admin, Admin) ---
router.get('/reports', permit('REPORTS_ANALYTICS'), viewReports);

// --- Profile Settings (Accountant, Student) ---
router.put('/profile', permit('PROFILE_SETTINGS'), updateProfile);

// --- Send Payment Reminder (Accountant) ---
router.post('/students/:id/reminder', permit('SEND_NOTIFICATIONS'), sendPaymentReminder);

module.exports = router; 