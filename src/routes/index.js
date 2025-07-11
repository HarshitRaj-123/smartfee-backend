const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/accountant', require('./accountant.routes'));
router.use('/student', require('./student.routes'));
router.use('/course', require('./course.routes'));
router.use('/fee', require('./fee.routes'));
router.use('/fee-categories', require('./feeCategory.routes'));
router.use('/fee-templates', require('./feeTemplate.routes'));
router.use('/student-fees', require('./studentFee.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/subscriptions', require('./subscription.routes'));
router.use('/razorpay', require('./razorpay.routes'));
router.use('/semester-upgrade', require('./semesterUpgrade.routes'));
router.use('/service-management', require('./serviceManagement.routes'));
router.use('/fee-structures', require('./feeStructure.routes'));

module.exports = router; 