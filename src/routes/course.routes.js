const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');

// Controllers
const {
  addCourse,
  editCourse,
  deleteCourse,
  blockCourse,
  viewCourses,
  getCoursesByCategory,
  getCoursesBySemesters,
  getCourseById,
  getCourseStats
} = require('../controllers/course.controller');

// All routes require authentication first
router.use(requireAuth);

// --- Course Management (Super Admin, Admin) ---
router.post('/', permit('COURSE_MANAGEMENT'), addCourse);
router.put('/:id', permit('COURSE_MANAGEMENT'), editCourse);
router.delete('/:id', permit('COURSE_MANAGEMENT'), deleteCourse);
router.patch('/:id/block', permit('COURSE_MANAGEMENT'), blockCourse);
router.patch('/:id/status', permit('COURSE_MANAGEMENT'), blockCourse);
router.get('/', permit('COURSE_MANAGEMENT'), viewCourses);
router.get('/stats', permit('COURSE_MANAGEMENT'), getCourseStats);
router.get('/by-category', permit('COURSE_MANAGEMENT'), getCoursesByCategory);
router.get('/by-semesters/:semesters', permit('COURSE_MANAGEMENT'), getCoursesBySemesters);
router.get('/:id', permit('COURSE_MANAGEMENT'), getCourseById);

module.exports = router; 