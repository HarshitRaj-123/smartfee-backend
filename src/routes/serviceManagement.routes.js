const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');

const {
  getStudentServices,
  updateStudentService,
  bulkUpdateServices,
  getServiceStatistics,
  getStudentsByService
} = require('../controllers/serviceManagement.controller');

// All routes require authentication
router.use(requireAuth);

// Get student services - Admin, Accountant, Student (own only)
router.get('/student/:studentId',
  permit('VIEW_SERVICES'),
  getStudentServices
);

// Update student service - Admin, Accountant
router.put('/student/:studentId',
  permit('MANAGE_SERVICES'),
  updateStudentService
);

// Bulk update services - Admin only
router.post('/bulk-update',
  permit('MANAGE_SERVICES'),
  bulkUpdateServices
);

// Get service statistics - Admin, Super Admin
router.get('/statistics',
  permit('VIEW_SERVICES'),
  getServiceStatistics
);

// Get students by service - Admin, Accountant
router.get('/students-by-service',
  permit('VIEW_SERVICES'),
  getStudentsByService
);

module.exports = router; 