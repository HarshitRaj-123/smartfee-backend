const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');

// Controllers (replace with your actual controller functions)
const {
  addFeeTemplate,
  editFeeTemplate,
  deleteFeeTemplate,
  assignFee,
  addCharge,
  viewFeeAssignments,
  addAdvanceRefund,
  viewPaymentHistory,
  viewReports,
} = require('../controllers/fee.controller');

// All routes require authentication first
router.use(requireAuth);

// --- Fee Template Management (Super Admin) ---
// router.post('/templates', permit('FEE_TEMPLATE_MANAGEMENT'), addFeeTemplate);
// router.put('/templates/:id', permit('FEE_TEMPLATE_MANAGEMENT'), editFeeTemplate);
// router.delete('/templates/:id', permit('FEE_TEMPLATE_MANAGEMENT'), deleteFeeTemplate);

// --- Fee Assignment (Super Admin, Admin) ---
// router.post('/assign', permit('FEE_ASSIGNMENT'), assignFee);

// --- Add/Edit Charges (Super Admin) ---
// router.post('/charges', permit('CHARGES_MANAGEMENT'), addCharge);

// --- Advance/Refund Handling (Super Admin) ---
// router.post('/advance-refund', permit('ADVANCE_REFUND'), addAdvanceRefund);

// --- View Fee Assignments (Super Admin, Admin) ---
// router.get('/assignments', permit('FEE_ASSIGNMENT'), viewFeeAssignments);

// --- Payment History (Super Admin, Admin) ---
// router.get('/payments/history', permit('PAYMENT_HISTORY'), viewPaymentHistory);

// --- Reports & Analytics (Super Admin, Admin, Accountant) ---
// router.get('/reports', permit('REPORTS_ANALYTICS'), viewReports);

module.exports = router; 