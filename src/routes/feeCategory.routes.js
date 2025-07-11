const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { permit } = require('../middleware/permission.middleware');

const {
  createFeeCategory,
  getFeeCategories,
  getFeeCategoryById,
  updateFeeCategory,
  deleteFeeCategory,
  getCategoriesByType
} = require('../controllers/feeCategory.controller');

// Apply authentication middleware to all routes
router.use(authenticate);

// Routes for fee category management
router.post('/', permit('FEE_MANAGEMENT'), createFeeCategory);
router.get('/', permit('FEE_MANAGEMENT'), getFeeCategories);
router.get('/by-type', permit('FEE_MANAGEMENT'), getCategoriesByType);
router.get('/:id', permit('FEE_MANAGEMENT'), getFeeCategoryById);
router.put('/:id', permit('FEE_MANAGEMENT'), updateFeeCategory);
router.delete('/:id', permit('FEE_MANAGEMENT'), deleteFeeCategory);

module.exports = router; 