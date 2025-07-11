const User = require('../models/user.model');
const FeeTemplate = require('../models/feeTemplate.model');
const StudentFee = require('../models/studentFee.model');

// Get student services
const getStudentServices = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await User.findById(studentId)
      .populate('courseId', 'name code')
      .select('firstName lastName studentId servicesOpted currentSemester academicYear');
    
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        student: {
          _id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          studentId: student.studentId,
          course: student.courseId,
          currentSemester: student.currentSemester,
          academicYear: student.academicYear
        },
        services: student.servicesOpted
      }
    });
  } catch (error) {
    console.error('Error fetching student services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student services',
      error: error.message
    });
  }
};

// Update student service
const updateStudentService = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { serviceName, isOpted, serviceData } = req.body;
    
    const validServices = ['hostel', 'mess', 'transport', 'library'];
    if (!validServices.includes(serviceName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service name'
      });
    }
    
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Store previous service data for logging
    const previousServiceData = { ...student.servicesOpted[serviceName] };
    
    // Update service
    await student.toggleService(serviceName, isOpted, serviceData);
    
    // If service affects fees, update current semester fee structure
    if (['hostel', 'mess', 'transport'].includes(serviceName)) {
      await updateStudentFeeForService(student, serviceName, isOpted, serviceData);
    }
    
    res.status(200).json({
      success: true,
      message: `${serviceName} service updated successfully`,
      data: {
        studentId: student._id,
        serviceName,
        previousData: previousServiceData,
        newData: student.servicesOpted[serviceName]
      }
    });
  } catch (error) {
    console.error('Error updating student service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update student service',
      error: error.message
    });
  }
};

// Bulk update services for multiple students
const bulkUpdateServices = async (req, res) => {
  try {
    const { studentIds, serviceName, isOpted, serviceData } = req.body;
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student IDs are required'
      });
    }
    
    const validServices = ['hostel', 'mess', 'transport', 'library'];
    if (!validServices.includes(serviceName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service name'
      });
    }
    
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student',
      isActive: true
    });
    
    const results = {
      successful: [],
      failed: [],
      total: students.length
    };
    
    for (const student of students) {
      try {
        const previousServiceData = { ...student.servicesOpted[serviceName] };
        
        await student.toggleService(serviceName, isOpted, serviceData);
        
        // Update fees if applicable
        if (['hostel', 'mess', 'transport'].includes(serviceName)) {
          await updateStudentFeeForService(student, serviceName, isOpted, serviceData);
        }
        
        results.successful.push({
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          previousData: previousServiceData,
          newData: student.servicesOpted[serviceName]
        });
      } catch (error) {
        results.failed.push({
          studentId: student._id,
          reason: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Bulk service update completed. ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results
    });
  } catch (error) {
    console.error('Error in bulk service update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk service update',
      error: error.message
    });
  }
};

// Get service statistics
const getServiceStatistics = async (req, res) => {
  try {
    const { courseId, semester, academicYear } = req.query;
    
    const matchQuery = {
      role: 'student',
      isActive: true
    };
    
    if (courseId) matchQuery.courseId = courseId;
    if (semester) matchQuery.currentSemester = parseInt(semester);
    if (academicYear) matchQuery.academicYear = academicYear;
    
    const stats = await User.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          hostelOptedIn: {
            $sum: { $cond: ['$servicesOpted.hostel.isOpted', 1, 0] }
          },
          messOptedIn: {
            $sum: { $cond: ['$servicesOpted.mess.isOpted', 1, 0] }
          },
          transportOptedIn: {
            $sum: { $cond: ['$servicesOpted.transport.isOpted', 1, 0] }
          },
          libraryOptedIn: {
            $sum: { $cond: ['$servicesOpted.library.isOpted', 1, 0] }
          },
          hostelRoomTypes: {
            $push: {
              $cond: [
                '$servicesOpted.hostel.isOpted',
                '$servicesOpted.hostel.roomType',
                null
              ]
            }
          },
          messPlans: {
            $push: {
              $cond: [
                '$servicesOpted.mess.isOpted',
                '$servicesOpted.mess.planType',
                null
              ]
            }
          },
          transportRoutes: {
            $push: {
              $cond: [
                '$servicesOpted.transport.isOpted',
                '$servicesOpted.transport.route',
                null
              ]
            }
          }
        }
      }
    ]);
    
    // Get detailed breakdown by course
    const courseBreakdown = await User.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$courseId',
          totalStudents: { $sum: 1 },
          hostelOptedIn: {
            $sum: { $cond: ['$servicesOpted.hostel.isOpted', 1, 0] }
          },
          messOptedIn: {
            $sum: { $cond: ['$servicesOpted.mess.isOpted', 1, 0] }
          },
          transportOptedIn: {
            $sum: { $cond: ['$servicesOpted.transport.isOpted', 1, 0] }
          }
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
          totalStudents: 1,
          hostelOptedIn: 1,
          messOptedIn: 1,
          transportOptedIn: 1,
          hostelPercentage: {
            $multiply: [
              { $divide: ['$hostelOptedIn', '$totalStudents'] },
              100
            ]
          },
          messPercentage: {
            $multiply: [
              { $divide: ['$messOptedIn', '$totalStudents'] },
              100
            ]
          },
          transportPercentage: {
            $multiply: [
              { $divide: ['$transportOptedIn', '$totalStudents'] },
              100
            ]
          }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalStudents: 0,
          hostelOptedIn: 0,
          messOptedIn: 0,
          transportOptedIn: 0,
          libraryOptedIn: 0
        },
        courseBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching service statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service statistics',
      error: error.message
    });
  }
};

// Get students by service
const getStudentsByService = async (req, res) => {
  try {
    const { serviceName, isOpted = 'true', courseId, semester } = req.query;
    const { page = 1, limit = 20 } = req.query;
    
    const validServices = ['hostel', 'mess', 'transport', 'library'];
    if (!validServices.includes(serviceName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service name'
      });
    }
    
    const query = {
      role: 'student',
      isActive: true,
      [`servicesOpted.${serviceName}.isOpted`]: isOpted === 'true'
    };
    
    if (courseId) query.courseId = courseId;
    if (semester) query.currentSemester = parseInt(semester);
    
    const skip = (page - 1) * limit;
    
    const [students, total] = await Promise.all([
      User.find(query)
        .populate('courseId', 'name code')
        .select(`firstName lastName studentId servicesOpted.${serviceName} currentSemester academicYear`)
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    res.status(200).json({
      success: true,
      data: students,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: students.length,
        totalRecords: total
      }
    });
  } catch (error) {
    console.error('Error fetching students by service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students by service',
      error: error.message
    });
  }
};

// Helper function to update student fee when service changes
const updateStudentFeeForService = async (student, serviceName, isOpted, serviceData) => {
  try {
    // Find current semester fee record
    const currentFee = await StudentFee.findOne({
      studentId: student._id,
      semester: student.currentSemester,
      academicYear: student.academicYear
    });
    
    if (!currentFee) return;
    
    // Find fee template to get service fee amounts
    const feeTemplate = await FeeTemplate.getTemplateByCourse(
      student.courseId,
      student.currentSemester,
      student.academicYear
    );
    
    if (!feeTemplate) return;
    
    // Find service-related fee items in template
    const serviceFeeItems = feeTemplate.feeItems.filter(item => 
      item.name.toLowerCase().includes(serviceName.toLowerCase())
    );
    
    if (serviceFeeItems.length === 0) return;
    
    // Update fee items based on service opt-in/out
    for (const templateItem of serviceFeeItems) {
      const existingFeeItem = currentFee.feeItems.find(item => 
        item.categoryId.toString() === templateItem.categoryId.toString()
      );
      
      if (existingFeeItem) {
        if (isOpted) {
          // Add or update service fee
          existingFeeItem.originalAmount = templateItem.amount;
          if (existingFeeItem.paid === 0) {
            existingFeeItem.status = 'unpaid';
          }
        } else {
          // Remove service fee if not paid
          if (existingFeeItem.paid === 0) {
            currentFee.feeItems.pull(existingFeeItem._id);
          }
        }
      } else if (isOpted) {
        // Add new service fee item
        currentFee.feeItems.push({
          categoryId: templateItem.categoryId,
          name: templateItem.name,
          originalAmount: templateItem.amount,
          paid: 0,
          status: 'unpaid',
          meta: templateItem.meta,
          isOptional: templateItem.isOptional,
          description: templateItem.description
        });
      }
    }
    
    await currentFee.save();
  } catch (error) {
    console.error('Error updating student fee for service:', error);
    // Don't throw error to avoid breaking the main service update
  }
};

module.exports = {
  getStudentServices,
  updateStudentService,
  bulkUpdateServices,
  getServiceStatistics,
  getStudentsByService
}; 