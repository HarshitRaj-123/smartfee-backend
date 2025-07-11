const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { permit } = require('../middleware/permission.middleware');

const {
  createFeeTemplate,
  getFeeTemplates,
  getFeeTemplateById,
  updateFeeTemplate,
  deleteFeeTemplate,
  getTemplateByCourse,
  cloneTemplate
} = require('../controllers/feeTemplate.controller');

// Apply authentication middleware to all routes
router.use(authenticate);

// Routes for fee template management
router.post('/', permit('FEE_MANAGEMENT'), createFeeTemplate);
router.get('/', permit('FEE_MANAGEMENT'), getFeeTemplates);
router.get('/course/:courseId/semester/:semester/year/:academicYear', permit('FEE_MANAGEMENT'), getTemplateByCourse);
router.get('/:id', permit('FEE_MANAGEMENT'), getFeeTemplateById);
router.put('/:id', permit('FEE_MANAGEMENT'), updateFeeTemplate);
router.delete('/:id', permit('FEE_MANAGEMENT'), deleteFeeTemplate);
router.post('/:id/clone', permit('FEE_MANAGEMENT'), cloneTemplate);

module.exports = router; 