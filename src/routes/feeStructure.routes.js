const express = require('express');
const router = express.Router();
const feeStructureController = require('../controllers/feeStructure.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');

// All routes require authentication and FEE_MANAGEMENT permission
router.use(verifyToken);
router.use(permit('FEE_MANAGEMENT'));

// GET /api/fee-structures - Get all fee structures with filtering
router.get('/', feeStructureController.getFeeStructures);

// GET /api/fee-structures/stats - Get dashboard statistics
router.get('/stats', feeStructureController.getDashboardStats);

// GET /api/fee-structures/:id - Get single fee structure
router.get('/:id', feeStructureController.getFeeStructureById);

// POST /api/fee-structures - Create new fee structure
router.post('/', feeStructureController.createFeeStructure);

// PUT /api/fee-structures/:id - Update fee structure
router.put('/:id', feeStructureController.updateFeeStructure);

// POST /api/fee-structures/:id/clone - Clone fee structure
router.post('/:id/clone', feeStructureController.cloneFeeStructure);

// POST /api/fee-structures/:id/assign - Assign to students
router.post('/:id/assign', feeStructureController.assignToStudents);

// GET /api/fee-structures/:id/history - Get assignment history
router.get('/:id/history', feeStructureController.getAssignmentHistory);

// PUT /api/fee-structures/:id/activate - Activate fee structure
router.put('/:id/activate', feeStructureController.activateFeeStructure);

// PUT /api/fee-structures/:id/archive - Archive fee structure
router.put('/:id/archive', feeStructureController.archiveFeeStructure);

// Add this route after authentication and permission middleware
router.post('/assign-all', feeStructureController.assignAllFeeStructuresEndpoint);

module.exports = router; 