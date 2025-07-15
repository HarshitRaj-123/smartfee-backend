const FeeStructure = require('../models/feeStructure.model');
const User = require('../models/user.model');
const StudentFee = require('../models/studentFee.model');
const Notification = require('../models/notification.model');
const organizedCourses = require('../constants/organized_courses');

// Get all fee structures with filtering and pagination
const getFeeStructures = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      programName,
      branch,
      semester,
      academicSession,
      status,
      search
    } = req.query;

    // Build filter object
    const filter = {};
    if (programName) filter.programName = programName;
    if (branch) filter.branch = branch;
    if (semester) filter.semester = parseInt(semester);
    if (academicSession) filter.academicSession = academicSession;
    if (status) {
      filter.status = status;
    } else {
      // By default, show all except archived
      filter.status = { $ne: 'archived' };
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { programName: { $regex: search, $options: 'i' } },
        { branch: { $regex: search, $options: 'i' } },
        { templateName: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'lastModifiedBy', select: 'firstName lastName' }
      ]
    };

    const result = await FeeStructure.paginate(filter, options);

    res.json({
      success: true,
      data: result.docs,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.totalDocs,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage
      }
    });
  } catch (error) {
    console.error('Error fetching fee structures:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structures',
      error: error.message
    });
  }
};

// Get single fee structure by ID
const getFeeStructureById = async (req, res) => {
  try {
    const { id } = req.params;

    const feeStructure = await FeeStructure.findById(id)
      .populate('createdBy lastModifiedBy', 'firstName lastName')
      .populate('assignedStudents.studentId', 'firstName lastName studentId email')
      .populate('assignedStudents.assignedBy', 'firstName lastName')
      .populate('modificationHistory.modifiedBy', 'firstName lastName')
      .populate('adminComments.addedBy', 'firstName lastName');

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    // Count students with StudentFee for this structure's semester and academic year
    const studentFeeCount = await StudentFee.countDocuments({
      semester: feeStructure.semester,
      academicYear: feeStructure.academicSession
    });

    res.json({
      success: true,
      data: {
        ...feeStructure.toObject(),
        actualAssignedCount: studentFeeCount
      }
    });
  } catch (error) {
    console.error('Error fetching fee structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee structure',
      error: error.message
    });
  }
};

// Create new fee structure
const createFeeStructure = async (req, res) => {
  try {
    const {
      programName,
      branch,
      semester,
      academicSession,
      baseFees,
      serviceFees,
      isTemplate,
      templateName,
      propagationSettings,
      notes
    } = req.body;

    // Validate course exists in organized courses
    const course = organizedCourses.find(c => 
      c.program_name === programName && c.branch === branch
    );

    if (!course) {
      return res.status(400).json({
        success: false,
        message: 'Invalid program/branch combination'
      });
    }

    // Check if fee structure already exists for this combination
    const existingStructure = await FeeStructure.findByCourse(
      programName, branch, semester, academicSession
    );

    if (existingStructure) {
      return res.status(400).json({
        success: false,
        message: 'Fee structure already exists for this course/semester/session combination'
      });
    }

    // Create new fee structure
    const feeStructure = new FeeStructure({
      programName,
      branch,
      semester,
      academicSession,
      courseInfo: {
        category: course.category,
        course_name: course.course_name,
        duration: course.duration,
        totalSemesters: course.totalSemesters
      },
      baseFees: baseFees || [],
      serviceFees: serviceFees || [],
      isTemplate,
      templateName,
      propagationSettings: propagationSettings || {},
      notes,
      createdBy: req.user.id,
      status: 'draft'
    });

    await feeStructure.save();

    // Populate response
    await feeStructure.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Fee structure created successfully',
      data: feeStructure
    });
  } catch (error) {
    console.error('Error creating fee structure:', error);
    console.error('Request body:', req.body);
    if (error.stack) console.error(error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create fee structure',
      error: error.message
    });
  }
};

// Update fee structure
const updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { reason } = req.body;

    const feeStructure = await FeeStructure.findById(id);
    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    // Store original data for change tracking
    const originalData = {
      baseFees: feeStructure.baseFees,
      serviceFees: feeStructure.serviceFees,
      totalBaseFee: feeStructure.totalBaseFee,
      totalServiceFee: feeStructure.totalServiceFee,
      grandTotal: feeStructure.grandTotal
    };

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== 'reason' && updates[key] !== undefined) {
        feeStructure[key] = updates[key];
      }
    });

    // Add modification log
    feeStructure.addModificationLog(
      { from: originalData, to: updates },
      reason || 'Updated fee structure',
      req.user.id
    );

    await feeStructure.save();

    // If structure is active and propagation is enabled, update assigned students
    if (feeStructure.status === 'active' && feeStructure.propagationSettings.autoAssignToNewStudents) {
      await propagateToStudents(feeStructure, req.user.id);
    }

    // Send notifications if enabled
    if (feeStructure.propagationSettings.notifyOnChanges) {
      await sendUpdateNotifications(feeStructure, req.user.id);
    }

    await feeStructure.populate('createdBy lastModifiedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Fee structure updated successfully',
      data: feeStructure
    });
  } catch (error) {
    console.error('Error updating fee structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fee structure',
      error: error.message
    });
  }
};

// Clone fee structure
const cloneFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { academicSession, semester, templateName } = req.body;

    const originalStructure = await FeeStructure.findById(id);
    if (!originalStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    // Check if target structure already exists
    const existingStructure = await FeeStructure.findByCourse(
      originalStructure.programName,
      originalStructure.branch,
      semester || originalStructure.semester,
      academicSession || originalStructure.academicSession
    );

    if (existingStructure) {
      return res.status(400).json({
        success: false,
        message: 'Fee structure already exists for target session/semester'
      });
    }

    // Clone the structure
    const clonedStructure = originalStructure.clone(academicSession, semester);
    clonedStructure.createdBy = req.user.id;
    clonedStructure.templateName = templateName;

    await clonedStructure.save();
    await clonedStructure.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Fee structure cloned successfully',
      data: clonedStructure
    });
  } catch (error) {
    console.error('Error cloning fee structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clone fee structure',
      error: error.message
    });
  }
};

// Assign fee structure to students
const assignToStudents = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentIds, assignmentType = 'manual' } = req.body;

    const feeStructure = await FeeStructure.findById(id);
    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    // Validate students exist and match the course criteria
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student',
      'courseInfo.program_name': feeStructure.programName,
      'courseInfo.branch': feeStructure.branch,
      currentSemester: feeStructure.semester
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some students do not match the course criteria or do not exist'
      });
    }

    // Assign to students
    await feeStructure.assignToStudents(studentIds, req.user.id);

    // Create StudentFee records for each student
    const studentFeePromises = students.map(student => 
      createStudentFeeRecord(student._id, feeStructure, req.user.id)
    );

    await Promise.all(studentFeePromises);

    // Send notifications to students
    await sendAssignmentNotifications(students, feeStructure, req.user.id);

    res.json({
      success: true,
      message: `Fee structure assigned to ${students.length} students successfully`,
      data: {
        assignedCount: students.length,
        students: students.map(s => ({
          id: s._id,
          name: `${s.firstName} ${s.lastName}`,
          studentId: s.studentId
        }))
      }
    });
  } catch (error) {
    console.error('Error assigning fee structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign fee structure',
      error: error.message
    });
  }
};

// Get assignment history
const getAssignmentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const feeStructure = await FeeStructure.findById(id)
      .populate('assignedStudents.studentId', 'firstName lastName studentId email')
      .populate('assignedStudents.assignedBy', 'firstName lastName')
      .populate('modificationHistory.modifiedBy', 'firstName lastName');

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    res.json({
      success: true,
      data: {
        assignedStudents: feeStructure.assignedStudents,
        modificationHistory: feeStructure.modificationHistory,
        totalAssigned: feeStructure.assignedStudents.length
      }
    });
  } catch (error) {
    console.error('Error fetching assignment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignment history',
      error: error.message
    });
  }
};

// Activate fee structure
const activateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;

    const feeStructure = await FeeStructure.findById(id);
    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    feeStructure.status = 'active';
    feeStructure.lastModifiedBy = req.user.id;
    feeStructure.addModificationLog(
      { status: { from: feeStructure.status, to: 'active' } },
      'Fee structure activated',
      req.user.id
    );

    await feeStructure.save();

    // Auto-assign to eligible students if enabled
    if (feeStructure.propagationSettings.autoAssignToNewStudents) {
      await autoAssignToEligibleStudents(feeStructure, req.user.id);
    }

    res.json({
      success: true,
      message: 'Fee structure activated successfully',
      data: feeStructure
    });
  } catch (error) {
    console.error('Error activating fee structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate fee structure',
      error: error.message
    });
  }
};

// Archive fee structure
const archiveFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const feeStructure = await FeeStructure.findById(id);
    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    feeStructure.status = 'archived';
    feeStructure.lastModifiedBy = req.user.id;
    feeStructure.addModificationLog(
      { status: { from: feeStructure.status, to: 'archived' } },
      reason || 'Fee structure archived',
      req.user.id
    );

    await feeStructure.save();

    res.json({
      success: true,
      message: 'Fee structure archived successfully'
    });
  } catch (error) {
    console.error('Error archiving fee structure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive fee structure',
      error: error.message
    });
  }
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      FeeStructure.countDocuments({ status: 'active' }),
      FeeStructure.countDocuments({ status: 'draft' }),
      FeeStructure.countDocuments({ status: 'archived' }),
      FeeStructure.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, totalAmount: { $sum: '$grandTotal' } } }
      ])
    ]);

    const recentStructures = await FeeStructure.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      data: {
        counts: {
          active: stats[0],
          draft: stats[1],
          archived: stats[2],
          total: stats[0] + stats[1] + stats[2]
        },
        totalActiveAmount: stats[3][0]?.totalAmount || 0,
        recentStructures
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Helper functions
const createStudentFeeRecord = async (studentId, feeStructure, createdBy) => {
  try {
    // Check if StudentFee already exists
    const existingFee = await StudentFee.findOne({
      studentId,
      semester: feeStructure.semester,
      academicYear: feeStructure.academicSession
    });

    if (existingFee) {
      return existingFee;
    }

    // Create fee items from structure
    const feeItems = [
      ...feeStructure.baseFees.map(fee => ({
        categoryId: null, // You might want to create categories for these
        name: fee.name,
        originalAmount: fee.amount,
        paid: 0,
        status: 'unpaid',
        meta: fee.metadata
      })),
      ...feeStructure.serviceFees.map(fee => ({
        categoryId: null,
        name: fee.name,
        originalAmount: fee.amount,
        paid: 0,
        status: 'unpaid',
        isOptional: fee.isOptional,
        meta: fee.configuration
      }))
    ];

    const studentFee = new StudentFee({
      studentId,
      courseId: null, // Will be populated if you have Course records
      semester: feeStructure.semester,
      academicYear: feeStructure.academicSession,
      templateId: null, // You might want to create FeeTemplate records
      feeItems,
      totalDue: feeStructure.grandTotal,
      generatedBy: createdBy
    });

    return await studentFee.save();
  } catch (error) {
    console.error('Error creating student fee record:', error);
    throw error;
  }
};

const propagateToStudents = async (feeStructure, updatedBy) => {
  try {
    const assignedStudentIds = feeStructure.assignedStudents.map(a => a.studentId);
    
    // Update existing StudentFee records
    await StudentFee.updateMany(
      {
        studentId: { $in: assignedStudentIds },
        semester: feeStructure.semester,
        academicYear: feeStructure.academicSession
      },
      {
        $set: {
          totalDue: feeStructure.grandTotal,
          lastModifiedBy: updatedBy
        }
      }
    );
  } catch (error) {
    console.error('Error propagating to students:', error);
  }
};

const autoAssignToEligibleStudents = async (feeStructure, assignedBy) => {
  try {
    // Find eligible students
    const eligibleStudents = await User.find({
      role: 'student',
      'courseInfo.program_name': feeStructure.programName,
      'courseInfo.branch': feeStructure.branch,
      currentSemester: feeStructure.semester,
      academicYear: feeStructure.academicSession,
      isActive: true
    });

    const studentIds = eligibleStudents.map(s => s._id);
    
    if (studentIds.length > 0) {
      await feeStructure.assignToStudents(studentIds, assignedBy);
      
      // Create StudentFee records
      const promises = eligibleStudents.map(student => 
        createStudentFeeRecord(student._id, feeStructure, assignedBy)
      );
      
      await Promise.all(promises);
    }
  } catch (error) {
    console.error('Error auto-assigning to students:', error);
  }
};

const sendAssignmentNotifications = async (students, feeStructure, assignedBy) => {
  try {
    const notifications = students.map(student => ({
      recipientId: student._id,
      recipientRole: 'student',
      title: 'New Fee Structure Assigned',
      message: `A new fee structure for ${feeStructure.programName} - ${feeStructure.branch} (Semester ${feeStructure.semester}) has been assigned to you. Total amount: ₹${feeStructure.grandTotal}`,
      type: 'fee_assigned',
      sentBy: assignedBy,
      relatedEntity: {
        entityType: 'fee_structure',
        entityId: feeStructure._id
      }
    }));

    await Notification.insertMany(notifications);
  } catch (error) {
    console.error('Error sending assignment notifications:', error);
  }
};

const sendUpdateNotifications = async (feeStructure, updatedBy) => {
  try {
    const assignedStudentIds = feeStructure.assignedStudents.map(a => a.studentId);
    
    const notifications = assignedStudentIds.map(studentId => ({
      recipientId: studentId,
      recipientRole: 'student',
      title: 'Fee Structure Updated',
      message: `Your fee structure for ${feeStructure.programName} - ${feeStructure.branch} (Semester ${feeStructure.semester}) has been updated. New total: ₹${feeStructure.grandTotal}`,
      type: 'fee_updated',
      sentBy: updatedBy,
      relatedEntity: {
        entityType: 'fee_structure',
        entityId: feeStructure._id
      }
    }));

    await Notification.insertMany(notifications);
  } catch (error) {
    console.error('Error sending update notifications:', error);
  }
};

// Assign all fee structures to all eligible students (for script and endpoint)
const assignFeeStructuresToAllEligibleStudents = async (adminUserId = null) => {
  const FeeStructure = require('../models/feeStructure.model');
  const User = require('../models/user.model');
  const StudentFee = require('../models/studentFee.model');
  let totalAssigned = 0;
  let totalSkipped = 0;
  const allStructures = await FeeStructure.find({ status: 'active' });
  for (const feeStructure of allStructures) {
    const effectiveFrom = feeStructure.propagationSettings?.effectiveFrom || feeStructure.createdAt;
    const students = await User.find({
      role: 'student',
      'courseInfo.program_name': feeStructure.programName,
      'courseInfo.branch': feeStructure.branch,
      currentSemester: feeStructure.semester,
      academicYear: feeStructure.academicSession,
      isActive: true
    });
    for (const student of students) {
      const existingFee = await StudentFee.findOne({
        studentId: student._id,
        semester: feeStructure.semester,
        academicYear: feeStructure.academicSession
      });
      if (!existingFee) {
        await feeStructure.assignToStudents([student._id], adminUserId || feeStructure.createdBy);
        await createStudentFeeRecord(student._id, feeStructure, adminUserId || feeStructure.createdBy);
        totalAssigned++;
      } else {
        totalSkipped++;
      }
    }
  }
  return { totalAssigned, totalSkipped };
};

// API endpoint for admin to trigger assignment
const assignAllFeeStructuresEndpoint = async (req, res) => {
  try {
    const adminUserId = req.user.id;
    const result = await assignFeeStructuresToAllEligibleStudents(adminUserId);
    res.json({ success: true, message: 'Fee structures assigned to all eligible students.', ...result });
  } catch (error) {
    console.error('Error assigning all fee structures:', error);
    res.status(500).json({ success: false, message: 'Failed to assign fee structures', error: error.message });
  }
};

module.exports = {
  getFeeStructures,
  getFeeStructureById,
  createFeeStructure,
  updateFeeStructure,
  cloneFeeStructure,
  assignToStudents,
  getAssignmentHistory,
  activateFeeStructure,
  archiveFeeStructure,
  getDashboardStats,
  assignFeeStructuresToAllEligibleStudents,
  assignAllFeeStructuresEndpoint
};