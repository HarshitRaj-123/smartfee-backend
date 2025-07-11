const Course = require('../models/course.model');
const User = require('../models/user.model');

// Add new course
const addCourse = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      category,
      program_name,
      branch,
      course_name,
      duration,
      totalSemesters,
      department,
      eligibilityCriteria,
      fees
    } = req.body;

    // Check if course code already exists
    const existingCourse = await Course.findOne({ code: code.toUpperCase() });
    if (existingCourse) {
      return res.status(400).json({
        success: false,
        message: 'Course code already exists'
      });
    }

    // Create new course
    const courseData = {
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description: description?.trim(),
      category,
      program_name: program_name.trim(),
      branch: branch.trim(),
      course_name: course_name.trim(),
      duration,
      totalSemesters: parseInt(totalSemesters),
      department: department?.trim(),
      eligibilityCriteria: eligibilityCriteria?.trim(),
      fees: {
        admissionFee: parseFloat(fees?.admissionFee) || 0,
        securityDeposit: parseFloat(fees?.securityDeposit) || 0,
        otherCharges: parseFloat(fees?.otherCharges) || 0
      },
      createdBy: req.user.id,
      isActive: true
    };

    const course = new Course(courseData);
    await course.save();

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });

  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course',
      error: error.message
    });
  }
};

// Edit existing course
const editCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if course exists
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // If code is being updated, check for uniqueness
    if (updateData.code && updateData.code.toUpperCase() !== course.code) {
      const existingCourse = await Course.findOne({ 
        code: updateData.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: 'Course code already exists'
        });
      }
      updateData.code = updateData.code.toUpperCase();
    }

    // Clean and prepare update data
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.description) updateData.description = updateData.description.trim();
    if (updateData.program_name) updateData.program_name = updateData.program_name.trim();
    if (updateData.branch) updateData.branch = updateData.branch.trim();
    if (updateData.course_name) updateData.course_name = updateData.course_name.trim();
    if (updateData.department) updateData.department = updateData.department.trim();
    if (updateData.eligibilityCriteria) updateData.eligibilityCriteria = updateData.eligibilityCriteria.trim();
    if (updateData.totalSemesters) updateData.totalSemesters = parseInt(updateData.totalSemesters);

    // Handle fees update
    if (updateData.fees) {
      updateData.fees = {
        admissionFee: parseFloat(updateData.fees.admissionFee) || 0,
        securityDeposit: parseFloat(updateData.fees.securityDeposit) || 0,
        otherCharges: parseFloat(updateData.fees.otherCharges) || 0
      };
    }

    // Update course
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: updatedCourse
    });

  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course',
      error: error.message
    });
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check if any students are enrolled in this course
    const studentsCount = await User.countDocuments({ 
      courseId: id, 
      role: 'student' 
    });

    if (studentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course. ${studentsCount} students are currently enrolled in this course.`,
        studentsCount
      });
    }

    // Delete the course
    await Course.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      error: error.message
    });
  }
};

// Block/Unblock course (toggle active status)
const blockCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Check if course exists
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Update course status
    course.isActive = isActive !== undefined ? isActive : !course.isActive;
    await course.save();

    res.status(200).json({
      success: true,
      message: `Course ${course.isActive ? 'activated' : 'deactivated'} successfully`,
      data: course
    });

  } catch (error) {
    console.error('Error updating course status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course status',
      error: error.message
    });
  }
};

// View all courses with filtering and pagination
const viewCourses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      isActive,
      search,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = {};
    
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { program_name: { $regex: search, $options: 'i' } },
        { branch: { $regex: search, $options: 'i' } },
        { course_name: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [courses, totalCourses] = await Promise.all([
      Course.find(query)
        .populate('createdBy', 'firstName lastName')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Course.countDocuments(query)
    ]);

    // Get additional statistics
    const stats = await Course.aggregate([
      {
        $group: {
          _id: null,
          totalCourses: { $sum: 1 },
          activeCourses: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveCourses: { $sum: { $cond: ['$isActive', 0, 1] } }
        }
      }
    ]);

    const courseStats = stats[0] || { totalCourses: 0, activeCourses: 0, inactiveCourses: 0 };

    res.status(200).json({
      success: true,
      data: courses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCourses / parseInt(limit)),
        totalCourses,
        limit: parseInt(limit),
        hasNext: skip + courses.length < totalCourses,
        hasPrev: parseInt(page) > 1
      },
      stats: courseStats
    });

  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
};

// Get courses by category
const getCoursesByCategory = async (req, res) => {
  try {
    const coursesByCategory = await Course.getCoursesByCategory();
    
    res.status(200).json({
      success: true,
      data: coursesByCategory
    });

  } catch (error) {
    console.error('Error fetching courses by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses by category',
      error: error.message
    });
  }
};

// Get courses by semester count
const getCoursesBySemesters = async (req, res) => {
  try {
    const { semesters } = req.params;
    
    const courses = await Course.getCoursesBySemesters(parseInt(semesters));
    
    res.status(200).json({
      success: true,
      data: courses
    });

  } catch (error) {
    console.error('Error fetching courses by semesters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses by semesters',
      error: error.message
    });
  }
};

// Get single course details
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findById(id)
      .populate('createdBy', 'firstName lastName');
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get student count for this course
    const studentCount = await User.countDocuments({ 
      courseId: id, 
      role: 'student',
      isActive: true 
    });

    res.status(200).json({
      success: true,
      data: {
        ...course.toObject(),
        studentCount
      }
    });

  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course',
      error: error.message
    });
  }
};

// Get course statistics
const getCourseStats = async (req, res) => {
  try {
    const stats = await Course.aggregate([
      {
        $group: {
          _id: null,
          totalCourses: { $sum: 1 },
          activeCourses: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveCourses: { $sum: { $cond: ['$isActive', 0, 1] } }
        }
      }
    ]);

    const categoryStats = await Course.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgTotalSemesters: { $avg: '$totalSemesters' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const durationStats = await Course.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$duration',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get student enrollment stats per course
    const enrollmentStats = await User.aggregate([
      { $match: { role: 'student', isActive: true } },
      {
        $group: {
          _id: '$courseId',
          studentCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: '_id',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      {
        $project: {
          courseName: '$course.name',
          courseCode: '$course.code',
          studentCount: 1
        }
      },
      { $sort: { studentCount: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || { totalCourses: 0, activeCourses: 0, inactiveCourses: 0 },
        categoryStats,
        durationStats,
        topEnrolledCourses: enrollmentStats
      }
    });

  } catch (error) {
    console.error('Error fetching course statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course statistics',
      error: error.message
    });
  }
};

module.exports = {
  addCourse,
  editCourse,
  deleteCourse,
  blockCourse,
  viewCourses,
  getCoursesByCategory,
  getCoursesBySemesters,
  getCourseById,
  getCourseStats
}; 