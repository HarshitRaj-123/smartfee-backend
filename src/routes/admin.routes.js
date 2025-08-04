const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth.middleware');
const permit = require('../middleware/permission.middleware');
const User = require('../models/user.model');
const Course = require('../models/course.model');
const StudentFee = require('../models/studentFee.model');
const LoginActivity = require('../models/loginActivity.model');
const organizedCourses = require('../constants/organized_courses');

// All routes require authentication first
router.use(verifyToken);

// Get dashboard statistics
router.get('/dashboard/stats', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    // Build date filter if provided
    let dateFilter = {};
    if (fromDate && toDate) {
      dateFilter.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }

    // Get total students count
    const totalStudents = await User.countDocuments({ 
      role: 'student', 
      isActive: true,
      ...dateFilter 
    });

    // Since we don't have payment/transaction models yet, we'll return placeholder data
    // In a real implementation, you would query actual payment/transaction collections
    const totalPayments = 0; // await Payment.aggregate([...])
    const pendingDues = 0; // await Payment.aggregate([...])

    // Get department wise data (based on user department field)
    const departmentStats = await User.aggregate([
      {
        $match: {
          role: 'student',
          isActive: true,
          department: { $exists: true, $ne: null },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$department',
          students: { $sum: 1 }
        }
      },
      {
        $project: {
          name: '$_id',
          students: 1,
          fee: { $multiply: ['$students', 50000] }, // Placeholder calculation
          _id: 0
        }
      }
    ]);

    // Calculate percentages for department data
    const totalDepartmentStudents = departmentStats.reduce((sum, dept) => sum + dept.students, 0);
    const departmentWiseFee = departmentStats.map((dept, index) => ({
      id: index + 1,
      name: dept.name || 'Unknown Department',
      students: dept.students,
      fee: dept.fee,
      percentage: totalDepartmentStudents > 0 ? `${Math.round((dept.students / totalDepartmentStudents) * 100)}%` : '0%'
    }));

    // Get recent login activities as transactions placeholder (only actual logins, not admin actions)
    const recentActivities = await LoginActivity.find({
      loginStatus: 'success',
      loginTime: { $exists: true }, // Only actual login attempts have loginTime
      adminAction: { $exists: false }, // Exclude admin actions
      ...(fromDate && toDate && {
        loginTime: {
          $gte: new Date(fromDate),
          $lte: new Date(toDate)
        }
      })
    })
    .populate('userId', 'firstName lastName email')
    .sort({ loginTime: -1 })
    .limit(10);

    const recentTransactions = recentActivities.map((activity, index) => ({
      id: `TXN${String(index + 1).padStart(3, '0')}`,
      institute: 'SmartFee Institute', // Placeholder
      student: activity.userId ? `${activity.userId.firstName} ${activity.userId.lastName}` : 'Unknown User',
      date: activity.loginTime.toISOString().split('T')[0],
      amount: Math.floor(Math.random() * 5000) + 1000, // Placeholder amount
      status: Math.random() > 0.3 ? 'Completed' : 'Pending' // Random status
    }));

    res.json({
      success: true,
      data: {
        metrics: {
          totalStudents,
          totalPayments,
          pendingDues
        },
        departmentWiseFee: departmentWiseFee.length > 0 ? departmentWiseFee : [
          { id: 1, name: "No departments found", students: 0, fee: 0, percentage: "0%" }
        ],
        recentTransactions: recentTransactions.length > 0 ? recentTransactions : []
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics'
    });
  }
});

// Get revenue trends data
router.get('/dashboard/revenue-trends', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    
    // Since we don't have payment models, return placeholder structure
    // In real implementation, this would aggregate actual payment data
    let chartData = {};
    
    switch (period) {
      case 'monthly':
        chartData = {
          categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          revenue: new Array(12).fill(0), // All zeros since no payment data
          payments: new Array(12).fill(0),
          pending: new Array(12).fill(0)
        };
        break;
      case 'quarterly':
        chartData = {
          categories: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
          revenue: new Array(4).fill(0),
          payments: new Array(4).fill(0),
          pending: new Array(4).fill(0)
        };
        break;
      case 'yearly':
        chartData = {
          categories: ['2021', '2022', '2023', '2024'],
          revenue: new Array(4).fill(0),
          payments: new Array(4).fill(0),
          pending: new Array(4).fill(0)
        };
        break;
      default:
        chartData = {
          categories: ['No Data'],
          revenue: [0],
          payments: [0],
          pending: [0]
        };
    }

    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    console.error('Error fetching revenue trends:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue trends'
    });
  }
});

// ========== STUDENTS MANAGEMENT ENDPOINTS ==========

// Get all students with filters and pagination
router.get('/students', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      courseId = '',
      semester = '',
      paymentStatus = '',
      admissionYear = '',
      status = 'active',
      hostelOpted = '',
      messOpted = '',
      transportOpted = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build search query
    let query = { role: 'student' };

    // Status filter
    if (status === 'active') {
      query.isActive = true;
      query.academicStatus = 'active';
    } else if (status === 'blocked') {
      query.isActive = false;
    } else if (status === 'hold') {
      query.academicStatus = 'hold';
    }

    // Search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Course filter
    if (courseId) query.courseId = courseId;

    // Semester filter
    if (semester) query.currentSemester = parseInt(semester);

    // Admission year filter
    if (admissionYear) query.yearOfJoining = parseInt(admissionYear);

    // Service filters
    if (hostelOpted !== '') query['servicesOpted.hostel.isOpted'] = hostelOpted === 'true';
    if (messOpted !== '') query['servicesOpted.mess.isOpted'] = messOpted === 'true';
    if (transportOpted !== '') query['servicesOpted.transport.isOpted'] = transportOpted === 'true';

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [students, totalCount] = await Promise.all([
      User.find(query)
        .populate('courseId', 'name code category program_name branch totalSemesters')
        .select('-password -loginAttempts -lockUntil')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    // Get fee information for each student
    const studentsWithFees = await Promise.all(
      students.map(async (student) => {
        try {
          const currentFee = await StudentFee.findOne({
            studentId: student._id,
            semester: student.currentSemester,
            academicYear: student.academicYear
          });

          const studentObj = student.toObject();
          studentObj.feeInfo = {
            totalFee: currentFee?.netAmount || 0,
            paidAmount: currentFee?.totalPaid || 0,
            dueAmount: currentFee?.balanceDue || 0,
            status: currentFee?.status || 'not_generated',
            dueDate: currentFee?.dueDate || null
          };

          return studentObj;
        } catch (error) {
          console.error(`Error fetching fee for student ${student._id}:`, error);
          const studentObj = student.toObject();
          studentObj.feeInfo = {
            totalFee: 0,
            paidAmount: 0,
            dueAmount: 0,
            status: 'error',
            dueDate: null
          };
          return studentObj;
        }
      })
    );

    res.json({
      success: true,
      data: {
        students: studentsWithFees,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total: Math.ceil(totalCount / parseInt(limit)),
          totalRecords: totalCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students data'
    });
  }
});

// Get single student details
router.get('/students/:id', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { id } = req.params;

    const student = await User.findOne({ _id: id, role: 'student' })
      .populate('courseId', 'name code category program_name branch totalSemesters')
      .select('-password -loginAttempts -lockUntil');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get all semester fees for this student
    const allFees = await StudentFee.find({ studentId: id })
      .populate('feeItems.categoryId', 'name type')
      .sort({ semester: 1, academicYear: -1 });

    // Get semester upgrade history
    const SemesterUpgradeLog = require('../models/semesterUpgradeLog.model');
    const upgradeHistory = await SemesterUpgradeLog.find({ studentId: id })
      .populate('upgradedBy', 'firstName lastName')
      .populate('rolledBackBy', 'firstName lastName')
      .sort({ upgradeDate: -1 });

    const studentData = student.toObject();
    studentData.feeHistory = allFees;
    studentData.upgradeHistory = upgradeHistory;

    res.json({
      success: true,
      data: studentData
    });

  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student details'
    });
  }
});

// Update student information
router.put('/students/:id', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.password;
    delete updateData.role;
    delete updateData._id;

    const student = await User.findOneAndUpdate(
      { _id: id, role: 'student' },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('courseId', 'name code category program_name branch totalSemesters');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      message: 'Student information updated successfully',
      data: student
    });

  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating student information'
    });
  }
});

// Block/Unblock student
router.patch('/students/:id/status', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'block' | 'unblock' | 'hold' | 'activate'

    const updateData = {};
    
    switch (action) {
      case 'block':
        updateData.isActive = false;
        updateData.academicStatus = 'blocked';
        updateData.statusReason = reason || 'Blocked by admin';
        break;
      case 'unblock':
        updateData.isActive = true;
        updateData.academicStatus = 'active';
        updateData.statusReason = null;
        break;
      case 'hold':
        updateData.academicStatus = 'hold';
        updateData.isUpgradeEligible = false;
        updateData.upgradeHoldReason = reason || 'Academic hold';
        break;
      case 'activate':
        updateData.academicStatus = 'active';
        updateData.isUpgradeEligible = true;
        updateData.upgradeHoldReason = null;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    const student = await User.findOneAndUpdate(
      { _id: id, role: 'student' },
      updateData,
      { new: true }
    ).populate('courseId', 'name code');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      message: `Student ${action}ed successfully`,
      data: student
    });

  } catch (error) {
    console.error('Error updating student status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating student status'
    });
  }
});

// Delete student
router.delete('/students/:id', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { id } = req.params;
    const student = await User.findOneAndDelete({ _id: id, role: 'student' });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    // Optionally, delete related fee/payment records here
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ success: false, message: 'Error deleting student' });
  }
});

// Get students statistics
router.get('/students/stats/overview', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { role: 'student' } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          activeStudents: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          blockedStudents: {
            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
          },
          onHoldStudents: {
            $sum: { $cond: [{ $eq: ['$academicStatus', 'hold'] }, 1, 0] }
          }
        }
      }
    ]);

    const serviceStats = await User.aggregate([
      { $match: { role: 'student', isActive: true } },
      {
        $group: {
          _id: null,
          hostelOptedCount: {
            $sum: { $cond: [{ $eq: ['$servicesOpted.hostel.isOpted', true] }, 1, 0] }
          },
          messOptedCount: {
            $sum: { $cond: [{ $eq: ['$servicesOpted.mess.isOpted', true] }, 1, 0] }
          },
          transportOptedCount: {
            $sum: { $cond: [{ $eq: ['$servicesOpted.transport.isOpted', true] }, 1, 0] }
          },
          libraryOptedCount: {
            $sum: { $cond: [{ $eq: ['$servicesOpted.library.isOpted', true] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        general: stats[0] || {
          totalStudents: 0,
          activeStudents: 0,
          blockedStudents: 0,
          onHoldStudents: 0
        },
        services: serviceStats[0] || {
          hostelOptedCount: 0,
          messOptedCount: 0,
          transportOptedCount: 0,
          libraryOptedCount: 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching student statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student statistics'
    });
  }
});

// Get student by admission number
router.get('/students/by-admission/:admissionNo', permit('FEE_PAYMENT'), async (req, res) => {
  try {
    const { admissionNo } = req.params;
    const student = await User.findOne({ studentId: admissionNo, role: 'student' })
      .populate('courseId', 'name code category program_name branch totalSemesters')
      .select('-password -loginAttempts -lockUntil');
    if (!student) {
      // Student not found
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    // Always include guardianName (father's name) and currentSemester in the response
    const studentObj = student.toObject();
    studentObj.guardianName = student.guardianName || '';
    studentObj.fathersName = student.guardianName || '';
    studentObj.currentSemester = student.currentSemester || '';
    res.json({ success: true, data: studentObj });
  } catch (error) {
    if (error.status === 403) {
      // Forbidden error from permit middleware
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
    }
    console.error('Error fetching student by admission number:', error);
    res.status(500).json({ success: false, message: 'Error fetching student' });
  }
});

// Get courses for filters
router.get('/courses/list', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    // First try to get courses from database
    let courses = await Course.find({ isActive: true })
      .select('name code category program_name branch totalSemesters duration')
      .sort({ name: 1 });

    // If no courses in database, use organized courses as fallback
    if (!courses || courses.length === 0) {
      const organizedCourses = require('../constants/organized_courses');
      
      courses = organizedCourses.map((course, index) => ({
        _id: `${course.program_name}-${course.branch}`.replace(/\s+/g, '_').toLowerCase(),
        name: course.course_name,
        code: course.program_name ? course.program_name.replace(/\s+/g, '').toUpperCase() + (index + 1).toString().padStart(2, '0') : `COURSE${index+1}`,
        category: course.category,
        program_name: course.program_name,
        branch: course.branch,
        totalSemesters: course.totalSemesters,
        duration: course.duration
      }));
    }

    res.json({
      success: true,
      data: courses
    });

  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching courses'
    });
  }
});

// Bulk operations for students
router.post('/students/bulk-update', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const { studentIds, updateData } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student IDs array is required'
      });
    }

    // Remove sensitive fields
    delete updateData.password;
    delete updateData.role;

    const result = await User.updateMany(
      { _id: { $in: studentIds }, role: 'student' },
      { ...updateData, updatedAt: new Date() }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} students updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Error bulk updating students:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk update'
    });
  }
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

// Common function to parse and validate student data
const parseStudentData = async (filePath, fileExtension, serviceConfig = {}, isPreview = false) => {
  let studentsData = [];

  // Parse CSV file
  if (fileExtension === '.csv' || path.extname(filePath).includes('csv')) {
    const results = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });
    studentsData = results;
  }
  // Parse Excel file
  else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    studentsData = XLSX.utils.sheet_to_json(worksheet);
  }
  else {
    throw new Error('Unsupported file format');
  }

  // Validate and process student data
  const processedStudents = [];
  const errors = [];
  const duplicates = [];
  let validCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < studentsData.length; i++) {
    const row = studentsData[i];
    const rowNumber = i + 2; // +2 because arrays are 0-indexed and CSV has header row

    try {
      // Validate required fields - updated field names
      const requiredFields = ['studentName', 'email', 'phoneNumber', 'gender', 'dateOfBirth', 'programName', 'branch', 'currentSemester', 'admissionNumber', 'batchYear', 'fatherName', 'motherName'];
      const missingFields = requiredFields.filter(field => !row[field] || row[field].toString().trim() === '');
      
      if (missingFields.length > 0) {
        errors.push(`Row ${rowNumber}: Missing required fields: ${missingFields.join(', ')}`);
        errorCount++;
        continue;
      }

      // Check if student already exists (only if not preview)
      if (!isPreview) {
        const existingStudent = await User.findOne({
          $or: [
            { email: row.email.trim().toLowerCase() },
            { studentId: row.admissionNumber.trim() }
          ]
        });

        if (existingStudent) {
          duplicates.push(`Row ${rowNumber}: Student already exists with email ${row.email} or admission number ${row.admissionNumber}`);
          duplicateCount++;
          continue;
        }
      }

      // Validate course exists using programName and branch
      const programName = row.programName?.trim();
      const branch = row.branch?.trim();
      
      if (!programName || !branch) {
        errors.push(`Row ${rowNumber}: Missing programName or branch`);
        errorCount++;
        continue;
      }
      
      // Find course in organized courses
      const course = organizedCourses.find(c => 
        c.program_name === programName && 
        c.branch === branch
      );
      
      if (!course) {
        errors.push(`Row ${rowNumber}: Invalid program/branch combination: ${programName} - ${branch}`);
        errorCount++;
        continue;
      }

      // Parse student name
      const fullName = row.studentName.trim();
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      // Prepare student data with new field structure
      const studentData = {
        firstName: firstName,
        lastName: lastName,
        email: row.email.trim().toLowerCase(),
        studentId: row.admissionNumber.trim(),
        rollNumber: row.admissionNumber.trim(), // Using admission number as roll number
        phone: row.phoneNumber.trim(),
        
        // Store course information
        courseInfo: {
          category: course.category,
          program_name: course.program_name,
          branch: course.branch,
          course_name: course.course_name,
          duration: course.duration,
          totalSemesters: course.totalSemesters
        },
        
        currentSemester: parseInt(row.currentSemester),
        academicYear: '2024-25',
        yearOfJoining: parseInt(row.batchYear) || new Date().getFullYear(),
        role: 'student',
        isActive: true,
        academicStatus: 'active',
        password: 'defaultPassword123', // Default password - should be changed on first login
        
        // Personal information
        gender: row.gender?.trim() || '',
        dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
        address: row.address?.trim() || '',
        aadhaarNumber: row.aadhaarNumber?.trim() || '',
        
        // Guardian information
        guardianName: row.fatherName?.trim() || '',
        guardianPhone: row.guardianPhone?.trim() || '',
        motherName: row.motherName?.trim() || '',
        
        // Service preferences based on configuration
        servicesOpted: {
          hostel: {
            isOpted: serviceConfig.hostel?.enabled || false,
            roomType: row.hostelRoomType || serviceConfig.hostel?.roomType || 'shared',
            blockName: ''
          },
          mess: {
            isOpted: serviceConfig.mess?.enabled || false,
            mealType: 'vegetarian'
          },
          transport: {
            isOpted: serviceConfig.transport?.enabled || false,
            route: row.transportRoute || '',
            distance: row.transportDistance || 0
          },
          library: {
            isOpted: true, // Default to true
            cardNumber: ''
          }
        },
        
        // Scholarship information
        scholarshipInfo: {
          isApplicable: serviceConfig.scholarship?.enabled || false,
          percentage: serviceConfig.scholarship?.percentage || 0,
          type: 'merit'
        }
      };

      processedStudents.push(studentData);
      validCount++;

    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error.message}`);
      errorCount++;
    }
  }

  return {
    processedStudents,
    errors: [...errors, ...duplicates],
    stats: {
      valid: validCount,
      errors: errorCount,
      duplicates: duplicateCount,
      total: studentsData.length
    },
    errorDetails: errors,
    duplicateDetails: duplicates
  };
};

// Preview student import
router.post('/students/import/preview', permit('ADMIN_MANAGEMENT'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const serviceConfig = req.body.serviceConfig ? JSON.parse(req.body.serviceConfig) : {};

    try {
      const result = await parseStudentData(filePath, fileExtension, serviceConfig, true);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: 'Preview generated successfully',
        data: {
          valid: result.stats.valid,
          errors: result.stats.errors,
          duplicates: result.stats.duplicates,
          total: result.stats.total,
          errorDetails: result.errorDetails.slice(0, 20) // Return first 20 errors
        }
      });

    } catch (parseError) {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw parseError;
    }

  } catch (error) {
    console.error('Error previewing student import:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error previewing import: ' + error.message
    });
  }
});

// Import students from CSV/Excel
router.post('/students/import', permit('ADMIN_MANAGEMENT'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const serviceConfig = req.body.serviceConfig ? JSON.parse(req.body.serviceConfig) : {};

    try {
      const result = await parseStudentData(filePath, fileExtension, serviceConfig, false);
      
      // Filter out students whose email or studentId already exists
      const emails = result.processedStudents.map(s => s.email);
      const studentIds = result.processedStudents.map(s => s.studentId);
      const existingUsers = await User.find({
        $or: [
          { email: { $in: emails } },
          { studentId: { $in: studentIds } }
        ]
      });
      const existingEmails = new Set(existingUsers.map(u => u.email));
      const existingStudentIds = new Set(existingUsers.map(u => u.studentId));
      const toInsert = result.processedStudents.filter(s => !existingEmails.has(s.email) && !existingStudentIds.has(s.studentId));
      const skipped = result.processedStudents.length - toInsert.length;
      let imported = 0;
      // Fix invalid enum values and dates before insert
      toInsert.forEach(s => {
        // Fix dateOfBirth
        if (!s.dateOfBirth || isNaN(new Date(s.dateOfBirth).getTime())) {
          s.dateOfBirth = new Date('2000-01-01'); // fallback default
        }
        // Fix hostel.roomType
        if (s.servicesOpted && s.servicesOpted.hostel) {
          const validRoomTypes = ['single', 'double', 'triple', 'ac', 'non-ac'];
          if (!validRoomTypes.includes(s.servicesOpted.hostel.roomType)) {
            s.servicesOpted.hostel.roomType = 'double';
          }
        }
        // Fix mess.mealType
        if (s.servicesOpted && s.servicesOpted.mess) {
          const validMealTypes = ['veg', 'non-veg', 'both'];
          if (!validMealTypes.includes(s.servicesOpted.mess.mealType)) {
            s.servicesOpted.mess.mealType = 'veg';
          }
        }
      });
      if (toInsert.length > 0) {
        await User.insertMany(toInsert);
        imported = toInsert.length;
      }
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      res.json({
        success: true,
        message: `Import completed. ${imported} students imported, ${skipped} skipped due to duplicates, ${result.stats.errors + result.stats.duplicates} skipped due to errors.`,
        data: {
          imported,
          skipped: skipped + result.stats.errors + result.stats.duplicates,
          errors: result.errorDetails.slice(0, 10) // Return first 10 errors only
        }
      });

    } catch (parseError) {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw parseError;
    }

  } catch (error) {
    console.error('Error importing students:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error importing students'
    });
  }
});

// Get organized courses for reference
router.get('/courses/organized', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    // Return organized courses with courseKey for easy reference
    const coursesWithKeys = organizedCourses.map(course => ({
      ...course,
      courseKey: `${course.category}|${course.program_name}|${course.branch}`
    }));

    res.json({
      success: true,
      data: coursesWithKeys
    });

  } catch (error) {
    console.error('Error fetching organized courses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching organized courses'
    });
  }
});

// Export students data
router.get('/students/export', permit('ADMIN_MANAGEMENT'), async (req, res) => {
  try {
    const {
      format = 'csv',
      courseId = '',
      semester = '',
      status = 'active'
    } = req.query;

    // Build query
    let query = { role: 'student' };
    if (status === 'active') {
      query.isActive = true;
      query.academicStatus = 'active';
    } else if (status === 'blocked') {
      query.isActive = false;
    }
    if (courseId) query.courseId = courseId;
    if (semester) query.currentSemester = parseInt(semester);

    const students = await User.find(query)
      .populate('courseId', 'name code category program_name branch')
      .select('-password -loginAttempts -lockUntil')
      .sort({ lastName: 1, firstName: 1 });

    if (format === 'csv') {
      const csvHeaders = [
        'Student ID',
        'Roll Number', 
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Course Code',
        'Course Name',
        'Current Semester',
        'Academic Year',
        'Enrollment Date',
        'Status',
        'Hostel Opted',
        'Mess Opted',
        'Transport Opted'
      ];

      const csvData = students.map(student => [
        student.studentId || '',
        student.rollNumber || '',
        student.firstName || '',
        student.lastName || '',
        student.email || '',
        student.phone || '',
        student.courseId?.code || '',
        student.courseId?.name || '',
        student.currentSemester || '',
        student.academicYear || '',
        student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : '',
        student.isActive ? 'Active' : 'Blocked',
        student.servicesOpted?.hostel?.isOpted ? 'Yes' : 'No',
        student.servicesOpted?.mess?.isOpted ? 'Yes' : 'No',
        student.servicesOpted?.transport?.isOpted ? 'Yes' : 'No'
      ]);

      const csvContent = [csvHeaders, ...csvData]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=students_export.csv');
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: students
      });
    }

  } catch (error) {
    console.error('Error exporting students:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting students data'
    });
  }
});

module.exports = router;

