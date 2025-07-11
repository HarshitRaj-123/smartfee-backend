const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { permit } = require('../middleware/permission.middleware');

const {
  generateStudentFee,
  getStudentFees,
  getStudentFeeById,
  updateStudentFeeItems,
  addFine,
  addDiscount,
  getOverdueFees,
  getStudentFeeSummary
} = require('../controllers/studentFee.controller');

// Apply authentication middleware to all routes
router.use(authenticate);

// Routes for student fee management
router.post('/generate', permit('FEE_MANAGEMENT'), generateStudentFee);
router.get('/', permit('FEE_MANAGEMENT'), getStudentFees);
router.get('/overdue', permit('FEE_MANAGEMENT'), getOverdueFees);
router.get('/student/:studentId/summary', permit('FEE_MANAGEMENT'), getStudentFeeSummary);
router.get('/:id', permit('FEE_MANAGEMENT'), getStudentFeeById);
router.put('/:id', permit('FEE_MANAGEMENT'), updateStudentFeeItems);
router.post('/:id/fine', permit('FEE_MANAGEMENT'), addFine);
router.post('/:id/discount', permit('FEE_MANAGEMENT'), addDiscount);

module.exports = router; 