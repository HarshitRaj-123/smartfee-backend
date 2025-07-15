const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');

const {
  generateStudentFee,
  getStudentFees,
  getStudentFeeById,
  getStudentFeeByStudentId,
  updateStudentFeeItems,
  addFine,
  addDiscount,
  addCustomFee,
  createStudentFeeForCustomFees,
  getOverdueFees,
  getStudentFeeSummary
} = require('../controllers/studentFee.controller');

// Apply authentication middleware to all routes
router.use(verifyToken);

// Routes for student fee management
router.post('/generate', permit('FEE_MANAGEMENT'), generateStudentFee);
router.post('/create-for-custom-fees', permit('FEE_PAYMENT'), createStudentFeeForCustomFees);
router.get('/', permit('FEE_MANAGEMENT'), getStudentFees);
router.get('/overdue', permit('FEE_MANAGEMENT'), getOverdueFees);
router.get('/by-student/:studentId', permit('FEE_PAYMENT'), getStudentFeeByStudentId);
router.get('/student/:studentId/summary', permit('FEE_MANAGEMENT'), getStudentFeeSummary);
router.get('/:id', permit('FEE_MANAGEMENT'), getStudentFeeById);
router.put('/:id', permit('FEE_MANAGEMENT'), updateStudentFeeItems);
router.post('/:id/fine', permit('FEE_MANAGEMENT'), addFine);
router.post('/:id/discount', permit('FEE_MANAGEMENT'), addDiscount);
router.post('/:id/add-custom-fee', permit('FEE_PAYMENT'), addCustomFee);

module.exports = router; 