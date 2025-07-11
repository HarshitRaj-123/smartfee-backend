const User = require('../models/user.model');
const Course = require('../models/course.model');
const FeeTemplate = require('../models/feeTemplate.model');
const StudentFee = require('../models/studentFee.model');
const SemesterUpgradeLog = require('../models/semesterUpgradeLog.model');

// Get upgrade eligible students
const getUpgradeEligibleStudents = async (req, res) => {
  try {
    const { courseId, currentSemester, academicYear } = req.query;
    
    const query = {
      role: 'student',
      isActive: true,
      isUpgradeEligible: true,
      academicStatus: 'active'
    };
    
    if (courseId) query.courseId = courseId;
    if (currentSemester) query.currentSemester = parseInt(currentSemester);
    if (academicYear) query.academicYear = academicYear;
    
    const students = await User.find(query)
      .populate('courseId', 'name code totalSemesters category program_name branch')
      .sort({ courseId: 1, currentSemester: 1, lastName: 1 });
    
    // Filter out students who are already at max semester
    const eligibleStudents = students.filter(student => 
      student.courseId && student.currentSemester < student.courseId.totalSemesters
    );
    
    res.status(200).json({
      success: true,
      data: eligibleStudents,
      count: eligibleStudents.length
    });
  } catch (error) {
    console.error('Error fetching upgrade eligible students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upgrade eligible students',
      error: error.message
    });
  }
};

// Upgrade single student
const upgradeSingleStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { reason, notes, serviceChanges } = req.body;
    
    const student = await User.findById(studentId).populate('courseId');
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Check if student is eligible for upgrade
    if (!student.isUpgradeEligible || student.academicStatus !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Student is not eligible for upgrade'
      });
    }
    
    // Check if student has reached max semesters
    if (student.currentSemester >= student.courseId.totalSemesters) {
      return res.status(400).json({
        success: false,
        message: 'Student has already completed all semesters'
      });
    }
    
    const fromSemester = student.currentSemester;
    const toSemester = fromSemester + 1;
    
    // Start transaction
    const session = await User.startSession();
    session.startTransaction();
    
    try {
      // Update student semester
      student.currentSemester = toSemester;
      
      // Process service changes if provided
      const serviceChangeLog = [];
      if (serviceChanges && Array.isArray(serviceChanges)) {
        for (const change of serviceChanges) {
          const { serviceName, action, newData } = change;
          if (student.servicesOpted[serviceName]) {
            const previousData = { ...student.servicesOpted[serviceName] };
            
            if (action === 'opted_out') {
              await student.toggleService(serviceName, false);
            } else if (action === 'opted_in') {
              await student.toggleService(serviceName, true, newData);
            } else if (action === 'modified') {
              await student.updateService(serviceName, newData);
            }
            
            serviceChangeLog.push({
              serviceName,
              action,
              previousData,
              newData: student.servicesOpted[serviceName]
            });
          }
        }
      }
      
      await student.save({ session });
      
      // Generate new fee structure for the upgraded semester
      let feeTemplateId = null;
      let feeAmount = 0;
      
      const feeTemplate = await FeeTemplate.getTemplateByCourse(
        student.courseId._id, 
        toSemester, 
        student.academicYear
      );
      
      if (feeTemplate) {
        feeTemplateId = feeTemplate._id;
        feeAmount = feeTemplate.totalAmount;
        
        // Generate student fee record
        const studentFeeData = feeTemplate.cloneForStudent(studentId);
        studentFeeData.generatedBy = req.user.id;
        
        // Set due date (30 days from now by default)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        studentFeeData.dueDate = dueDate;
        
        const studentFee = new StudentFee(studentFeeData);
        await studentFee.save({ session });
      }
      
      // Create upgrade log
      const upgradeLog = new SemesterUpgradeLog({
        studentId,
        courseId: student.courseId._id,
        fromSemester,
        toSemester,
        academicYear: student.academicYear,
        upgradeType: 'manual',
        upgradeReason: reason || 'manual_promotion',
        upgradedBy: req.user.id,
        serviceChanges: serviceChangeLog,
        feeTemplateId,
        feeAmount,
        notes,
        status: 'completed'
      });
      
      await upgradeLog.save({ session });
      
      await session.commitTransaction();
      
      res.status(200).json({
        success: true,
        message: 'Student upgraded successfully',
        data: {
          student: {
            _id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            studentId: student.studentId,
            currentSemester: student.currentSemester,
            course: student.courseId
          },
          upgradeLog: upgradeLog._id
        }
      });
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error('Error upgrading student:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade student',
      error: error.message
    });
  }
};

// Bulk upgrade students
const bulkUpgradeStudents = async (req, res) => {
  try {
    const { studentIds, reason, notes, excludeStudents = [] } = req.body;
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student IDs are required'
      });
    }
    
    // Filter out excluded students
    const finalStudentIds = studentIds.filter(id => !excludeStudents.includes(id));
    
    const students = await User.find({
      _id: { $in: finalStudentIds },
      role: 'student',
      isActive: true,
      isUpgradeEligible: true,
      academicStatus: 'active'
    }).populate('courseId');
    
    const results = {
      successful: [],
      failed: [],
      total: students.length
    };
    
    // Process each student
    for (const student of students) {
      try {
        // Check if student has reached max semesters
        if (student.currentSemester >= student.courseId.totalSemesters) {
          results.failed.push({
            studentId: student._id,
            reason: 'Already completed all semesters'
          });
          continue;
        }
        
        const fromSemester = student.currentSemester;
        const toSemester = fromSemester + 1;
        
        // Start individual transaction for each student
        const session = await User.startSession();
        session.startTransaction();
        
        try {
          // Update student semester
          student.currentSemester = toSemester;
          await student.save({ session });
          
          // Generate new fee structure
          let feeTemplateId = null;
          let feeAmount = 0;
          
          const feeTemplate = await FeeTemplate.getTemplateByCourse(
            student.courseId._id, 
            toSemester, 
            student.academicYear
          );
          
          if (feeTemplate) {
            feeTemplateId = feeTemplate._id;
            feeAmount = feeTemplate.totalAmount;
            
            // Generate student fee record
            const studentFeeData = feeTemplate.cloneForStudent(student._id);
            studentFeeData.generatedBy = req.user.id;
            
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            studentFeeData.dueDate = dueDate;
            
            const studentFee = new StudentFee(studentFeeData);
            await studentFee.save({ session });
          }
          
          // Create upgrade log
          const upgradeLog = new SemesterUpgradeLog({
            studentId: student._id,
            courseId: student.courseId._id,
            fromSemester,
            toSemester,
            academicYear: student.academicYear,
            upgradeType: 'bulk',
            upgradeReason: reason || 'bulk_upgrade',
            upgradedBy: req.user.id,
            serviceChanges: [],
            feeTemplateId,
            feeAmount,
            notes,
            status: 'completed'
          });
          
          await upgradeLog.save({ session });
          await session.commitTransaction();
          
          results.successful.push({
            studentId: student._id,
            studentName: `${student.firstName} ${student.lastName}`,
            fromSemester,
            toSemester,
            upgradeLogId: upgradeLog._id
          });
          
        } catch (error) {
          await session.abortTransaction();
          results.failed.push({
            studentId: student._id,
            reason: error.message
          });
        } finally {
          session.endSession();
        }
        
      } catch (error) {
        results.failed.push({
          studentId: student._id,
          reason: error.message
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Bulk upgrade completed. ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results
    });
    
  } catch (error) {
    console.error('Error in bulk upgrade:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk upgrade',
      error: error.message
    });
  }
};

// Get upgrade history
const getUpgradeHistory = async (req, res) => {
  try {
    const { studentId, courseId, academicYear, upgradeType, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (studentId) query.studentId = studentId;
    if (courseId) query.courseId = courseId;
    if (academicYear) query.academicYear = academicYear;
    if (upgradeType) query.upgradeType = upgradeType;
    
    const skip = (page - 1) * limit;
    
    const [upgradeLogs, total] = await Promise.all([
      SemesterUpgradeLog.find(query)
        .populate('studentId', 'firstName lastName studentId')
        .populate('courseId', 'name code')
        .populate('upgradedBy', 'firstName lastName role')
        .populate('rolledBackBy', 'firstName lastName role')
        .sort({ upgradeDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SemesterUpgradeLog.countDocuments(query)
    ]);
    
    res.status(200).json({
      success: true,
      data: upgradeLogs,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: upgradeLogs.length,
        totalRecords: total
      }
    });
  } catch (error) {
    console.error('Error fetching upgrade history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upgrade history',
      error: error.message
    });
  }
};

// Rollback upgrade
const rollbackUpgrade = async (req, res) => {
  try {
    const { upgradeLogId } = req.params;
    const { reason } = req.body;
    
    const upgradeLog = await SemesterUpgradeLog.findById(upgradeLogId)
      .populate('studentId')
      .populate('courseId');
    
    if (!upgradeLog) {
      return res.status(404).json({
        success: false,
        message: 'Upgrade log not found'
      });
    }
    
    if (upgradeLog.isRolledBack) {
      return res.status(400).json({
        success: false,
        message: 'Upgrade has already been rolled back'
      });
    }
    
    const session = await User.startSession();
    session.startTransaction();
    
    try {
      // Revert student semester
      const student = upgradeLog.studentId;
      student.currentSemester = upgradeLog.fromSemester;
      
      // Revert service changes
      if (upgradeLog.serviceChanges && upgradeLog.serviceChanges.length > 0) {
        for (const change of upgradeLog.serviceChanges) {
          if (change.previousData && student.servicesOpted[change.serviceName]) {
            Object.assign(student.servicesOpted[change.serviceName], change.previousData);
            student.markModified(`servicesOpted.${change.serviceName}`);
          }
        }
      }
      
      await student.save({ session });
      
      // Remove the generated fee record for the upgraded semester
      await StudentFee.deleteOne({
        studentId: student._id,
        semester: upgradeLog.toSemester,
        academicYear: upgradeLog.academicYear
      }, { session });
      
      // Update upgrade log
      await upgradeLog.rollback(req.user.id, reason);
      
      await session.commitTransaction();
      
      res.status(200).json({
        success: true,
        message: 'Upgrade rolled back successfully',
        data: {
          upgradeLogId: upgradeLog._id,
          studentId: student._id,
          revertedToSemester: upgradeLog.fromSemester
        }
      });
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error('Error rolling back upgrade:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rollback upgrade',
      error: error.message
    });
  }
};

// Get upgrade statistics
const getUpgradeStatistics = async (req, res) => {
  try {
    const { academicYear } = req.query;
    
    const stats = await SemesterUpgradeLog.getUpgradeStats(academicYear);
    
    // Get additional statistics
    const [totalStudents, totalUpgrades, recentUpgrades] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      SemesterUpgradeLog.countDocuments(academicYear ? { academicYear } : {}),
      SemesterUpgradeLog.find(academicYear ? { academicYear } : {})
        .populate('studentId', 'firstName lastName studentId')
        .populate('courseId', 'name code')
        .sort({ upgradeDate: -1 })
        .limit(10)
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalUpgrades,
          upgradesByType: stats
        },
        recentUpgrades
      }
    });
  } catch (error) {
    console.error('Error fetching upgrade statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upgrade statistics',
      error: error.message
    });
  }
};

module.exports = {
  getUpgradeEligibleStudents,
  upgradeSingleStudent,
  bulkUpgradeStudents,
  getUpgradeHistory,
  rollbackUpgrade,
  getUpgradeStatistics
}; 