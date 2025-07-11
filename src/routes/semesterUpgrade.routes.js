const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');

const {
  getUpgradeEligibleStudents,
  upgradeSingleStudent,
  bulkUpgradeStudents,
  getUpgradeHistory,
  rollbackUpgrade,
  getUpgradeStatistics
} = require('../controllers/semesterUpgrade.controller');

// All routes require authentication
router.use(requireAuth);

// Get upgrade eligible students - Admin, Super Admin
router.get('/eligible-students', 
  permit('SEMESTER_UPGRADE'), 
  getUpgradeEligibleStudents
);

// Upgrade single student - Admin, Super Admin
router.post('/student/:studentId', 
  permit('SEMESTER_UPGRADE'), 
  upgradeSingleStudent
);

// Bulk upgrade students - Admin, Super Admin
router.post('/bulk-upgrade', 
  permit('SEMESTER_UPGRADE'), 
  bulkUpgradeStudents
);

// Get upgrade history - Admin, Super Admin, Accountant (view only)
router.get('/history', 
  permit('SEMESTER_UPGRADE_VIEW'), 
  getUpgradeHistory
);

// Rollback upgrade - Super Admin only
router.post('/rollback/:upgradeLogId', 
  permit('SEMESTER_ROLLBACK'), 
  rollbackUpgrade
);

// Get upgrade statistics - Admin, Super Admin
router.get('/statistics', 
  permit('SEMESTER_UPGRADE_VIEW'), 
  getUpgradeStatistics
);

module.exports = router; 