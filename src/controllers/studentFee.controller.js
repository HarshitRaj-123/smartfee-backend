const StudentFee = require('../models/studentFee.model');
const FeeTemplate = require('../models/feeTemplate.model');
const User = require('../models/user.model');
const { sendFeeSMS } = require("../utils/msg91"); // import it

// Generate student fee from template
const generateStudentFee = async (req, res) => {
  try {
    const { studentId, courseId, semester, academicYear } = req.body;
    
    // Check if student fee already exists
    const existingFee = await StudentFee.findOne({
      studentId,
      semester,
      academicYear
    });
    
    if (existingFee) {
      return res.status(400).json({
        success: false,
        message: 'Fee structure already exists for this student and semester'
      });
    }
    
    // Get the fee template
    const template = await FeeTemplate.getTemplateByCourse(courseId, semester, academicYear);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No fee template found for this course and semester'
      });
    }
    
    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Clone template for student
    const studentFeeData = template.cloneForStudent(studentId);
    studentFeeData.generatedBy = req.user.id;
    
    // Set due date (30 days from now by default)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    studentFeeData.dueDate = dueDate;
    
    const studentFee = new StudentFee(studentFeeData);
    await studentFee.save();
    
    // Populate the response
    await studentFee.populate([
      { path: 'studentId', select: 'firstName lastName studentId email' },
      { path: 'courseId', select: 'name code' },
      { path: 'feeItems.categoryId', select: 'name type' },
      { path: 'templateId', select: 'templateName' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Student fee generated successfully',
      data: studentFee
    });
  } catch (error) {
    console.error('Error generating student fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate student fee',
      error: error.message
    });
  }
};

// Get student fees
const getStudentFees = async (req, res) => {
  try {
    const { studentId, semester, academicYear, status } = req.query;
    
    const filters = {};
    if (studentId) filters.studentId = studentId;
    if (semester) filters.semester = parseInt(semester);
    if (academicYear) filters.academicYear = academicYear;
    if (status) filters.status = status;
    
    const studentFees = await StudentFee.find(filters)
      .populate('studentId', 'firstName lastName studentId email')
      .populate('courseId', 'name code department')
      .populate('feeItems.categoryId', 'name type')
      .populate('templateId', 'templateName')
      .populate('generatedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: studentFees,
      count: studentFees.length
    });
  } catch (error) {
    console.error('Error fetching student fees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student fees',
      error: error.message
    });
  }
};

// Get student fee by ID
const getStudentFeeById = async (req, res) => {
  try {
    const studentFee = await StudentFee.findById(req.params.id)
      .populate('studentId', 'firstName lastName studentId email phone')
      .populate('courseId', 'name code department')
      .populate('feeItems.categoryId', 'name type meta')
      .populate('templateId', 'templateName')
      .populate('generatedBy', 'firstName lastName')
      .populate('fines.imposedBy', 'firstName lastName')
      .populate('discounts.approvedBy', 'firstName lastName');
    
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: studentFee
    });
  } catch (error) {
    console.error('Error fetching student fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student fee',
      error: error.message
    });
  }
};

// Update student fee items
const updateStudentFeeItems = async (req, res) => {
  try {
    const { feeItems } = req.body;
    
    const studentFee = await StudentFee.findById(req.params.id);
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee not found'
      });
    }
    
    // Update fee items
    if (feeItems) {
      feeItems.forEach(updatedItem => {
        const existingItem = studentFee.feeItems.id(updatedItem._id);
        if (existingItem) {
          if (updatedItem.originalAmount !== undefined) existingItem.originalAmount = updatedItem.originalAmount;
          if (updatedItem.isIncluded !== undefined) existingItem.isIncluded = updatedItem.isIncluded;
          if (updatedItem.notes !== undefined) existingItem.notes = updatedItem.notes;
        }
      });
    }
    
    studentFee.lastModifiedBy = req.user.id;
    await studentFee.save();
    
    res.status(200).json({
      success: true,
      message: 'Student fee updated successfully',
      data: studentFee
    });
  } catch (error) {
    console.error('Error updating student fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update student fee',
      error: error.message
    });
  }
};

// Add fine to student fee
const addFine = async (req, res) => {
  try {
    const { name, amount, reason } = req.body;
    
    const studentFee = await StudentFee.findById(req.params.id);
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee not found'
      });
    }
    
    const fineData = {
      name,
      amount,
      reason,
      imposedBy: req.user.id
    };
    
    await studentFee.addFine(fineData);
    
    res.status(200).json({
      success: true,
      message: 'Fine added successfully',
      data: studentFee
    });
  } catch (error) {
    console.error('Error adding fine:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add fine',
      error: error.message
    });
  }
};

// Add discount to student fee
const addDiscount = async (req, res) => {
  try {
    const { name, amount, type, reason } = req.body;
    
    const studentFee = await StudentFee.findById(req.params.id);
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee not found'
      });
    }
    
    const discountData = {
      name,
      amount,
      type: type || 'fixed',
      reason,
      approvedBy: req.user.id
    };
    
    await studentFee.addDiscount(discountData);
    
    res.status(200).json({
      success: true,
      message: 'Discount added successfully',
      data: studentFee
    });
  } catch (error) {
    console.error('Error adding discount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add discount',
      error: error.message
    });
  }
};

// Add custom fee to student
const addCustomFee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, description, isOptional } = req.body;
    
    const studentFee = await StudentFee.findById(id);
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee record not found'
      });
    }
    
    // Find or create a default fee category for custom fees
    const FeeCategory = require('../models/feeCategory.model');
    let customCategory = await FeeCategory.findOne({ name: 'Custom Fees' });
    
    if (!customCategory) {
      customCategory = new FeeCategory({
        name: 'Custom Fees',
        type: 'custom',
        description: 'Custom fees added by administrators',
        meta: { mandatory: false, refundable: true },
        createdBy: req.user.id
      });
      await customCategory.save();
    }
    
    // Create new fee item
    const newFeeItem = {
      categoryId: customCategory._id,
      name: name,
      originalAmount: amount,
      paid: 0,
      status: 'unpaid',
      notes: description || '',
      meta: { isCustom: true, addedBy: req.user.id, addedAt: new Date() },
      isOptional: isOptional || false,
      isIncluded: true
    };
    
    // Add to student fee
    studentFee.feeItems.push(newFeeItem);
    studentFee.lastModifiedBy = req.user.id;
    
    // Recalculate totals
    studentFee.totalDue = studentFee.feeItems
      .filter(item => item.isIncluded)
      .reduce((total, item) => total + item.originalAmount, 0);
    
    await studentFee.save();
    
    // Populate the response
    await studentFee.populate([
      { path: 'studentId', select: 'firstName lastName studentId email' },
      { path: 'feeItems.categoryId', select: 'name type' }
    ]);
    
    res.status(200).json({
      success: true,
      message: 'Custom fee added successfully',
      data: studentFee
    });
  } catch (error) {
    console.error('Error adding custom fee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add custom fee',
      error: error.message
    });
  }
};

// Create student fee record for custom fees (without template requirement)
const createStudentFeeForCustomFees = async (req, res) => {
  try {
    const { studentId, courseId, semester, academicYear } = req.body;
    console.log('Incoming custom fee creation:', req.body);

    // Remove strict check for courseId and semester
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: studentId.'
      });
    }
    // Fallbacks
    const safeCourseId = courseId || null;
    const safeSemester = semester || 1;

    // Check if student fee already exists
    const existingFee = await StudentFee.findOne({
      studentId,
      semester: safeSemester,
      academicYear
    });
    if (existingFee) {
      return res.status(400).json({
        success: false,
        message: 'Fee structure already exists for this student and semester'
      });
    }

    // Validate student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Create a basic student fee record without template
    const studentFeeData = {
      studentId,
      courseId: safeCourseId,
      semester: safeSemester,
      academicYear: academicYear || new Date().getFullYear().toString(),
      feeItems: [],
      totalAmount: 0,
      paidAmount: 0,
      balanceDue: 0,
      status: 'active',
      generatedBy: req.user.id,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      fines: [],
      discounts: [],
      paymentHistory: []
    };

    const studentFee = new StudentFee(studentFeeData);
    await studentFee.save();

    // Populate the response
    await studentFee.populate([
      { path: 'studentId', select: 'firstName lastName studentId email' },
      { path: 'courseId', select: 'name code' },
      { path: 'generatedBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Student fee record created successfully for custom fees',
      data: studentFee
    });
  } catch (error) {
    console.error('Error creating student fee for custom fees:', error, error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create student fee record',
      error: error.message,
      stack: error.stack
    });
  }
};

// Get overdue fees
const getOverdueFees = async (req, res) => {
  try {
    const { courseId, semester } = req.query;
    
    const filters = {};
    if (courseId) filters.courseId = courseId;
    if (semester) filters.semester = parseInt(semester);
    
    const overdueFees = await StudentFee.getOverdueFees(filters);
    
    res.status(200).json({
      success: true,
      data: overdueFees,
      count: overdueFees.length
    });
  } catch (error) {
    console.error('Error fetching overdue fees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue fees',
      error: error.message
    });
  }
};

// Get student fee by student ID (for fee payment page)
const getStudentFeeByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semester, academicYear } = req.query;
    
    const filters = { studentId };
    if (semester) filters.semester = parseInt(semester);
    if (academicYear) filters.academicYear = academicYear;
    
    // Get the most recent fee record if no specific semester/year
    const studentFee = await StudentFee.findOne(filters)
      .populate('studentId', 'firstName lastName studentId email phone courseInfo')
      .populate('courseId', 'name code department')
      .populate('feeItems.categoryId', 'name type meta')
      .populate('templateId', 'templateName')
      .populate('generatedBy', 'firstName lastName')
      .sort({ semester: -1, academicYear: -1, createdAt: -1 });
    
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'No fee record found for this student'
      });
    }
    
    res.status(200).json({
      success: true,
      data: studentFee
    });
  } catch (error) {
    console.error('Error fetching student fee by student ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student fee',
      error: error.message
    });
  }
};

// Get student fee summary
const getStudentFeeSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const fees = await StudentFee.find({ studentId })
      .populate('courseId', 'name code')
      .sort({ semester: 1, academicYear: -1 });
    
    const summary = {
      totalSemesters: fees.length,
      totalDue: fees.reduce((sum, fee) => sum + fee.netAmount, 0),
      totalPaid: fees.reduce((sum, fee) => sum + fee.totalPaid, 0),
      balanceDue: 0,
      fees: fees.map(fee => ({
        _id: fee._id,
        semester: fee.semester,
        academicYear: fee.academicYear,
        course: fee.courseId,
        totalDue: fee.netAmount,
        totalPaid: fee.totalPaid,
        balanceDue: fee.balanceDue,
        status: fee.status,
        paymentPercentage: fee.paymentPercentage
      }))
    };
    
    summary.balanceDue = summary.totalDue - summary.totalPaid;
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching student fee summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch student fee summary',
      error: error.message
    });
  }
};



const recordStudentFee = async (req, res) => {
  try {
    const { studentId, amount } = req.body;

    // Step 1: Save payment to DB (your existing logic)
    const student = await StudentModel.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Save fee (assuming you already have this logic)
    // await StudentFeeModel.create({ ... });

    // Step 2: Trigger SMS (you can also check a "notificationsEnabled" flag)
    await sendFeeSMS(student.name, student.phone, amount);

    return res.status(200).json({ message: "Fee paid and SMS sent" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};


module.exports = {
  generateStudentFee,
  getStudentFees,
  getStudentFeeById,
  getStudentFeeByStudentId,
  updateStudentFeeItems,
  addFine,
  addDiscount,
  addCustomFee,
  createStudentFeeForCustomFees,
  getOverdueFees,
  getStudentFeeSummary,
  recordStudentFee
}; 