const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');

// Controllers (replace with your actual controller functions)
const {
  viewPersonalOverview,
  viewFeeDetails,
  payOnline,
  downloadReceipt,
  viewServices,
  updateProfile,
  viewAdvancePayment,
  viewSemesterInfo,
} = require('../controllers/student.controller');

// All routes require authentication first
router.use(requireAuth);

// --- Dashboard (Student) ---
router.get('/dashboard', permit('VIEW_FEE_DETAILS'), viewPersonalOverview);

// --- View Fee Details (Student) ---
router.get('/fees', permit('VIEW_FEE_DETAILS'), viewFeeDetails);

// --- Pay Online (Student) ---
router.post('/fees/pay', permit('PAY_ONLINE'), payOnline);

// --- Download Receipts (Student) ---
router.get('/receipts/:id', permit('DOWNLOAD_RECEIPTS'), downloadReceipt);

// --- View Services (Student) ---
router.get('/services', permit('VIEW_SERVICES'), viewServices);

// --- Profile Update (Student) ---
router.put('/profile', permit('PROFILE_UPDATE'), updateProfile);

// --- Advance Payment View (Student) ---
router.get('/advance', permit('VIEW_FEE_DETAILS'), viewAdvancePayment);

// --- Semester Info View (Student) ---
router.get('/semester', permit('SEMESTER_INFO_VIEW'), viewSemesterInfo);

module.exports = router; 