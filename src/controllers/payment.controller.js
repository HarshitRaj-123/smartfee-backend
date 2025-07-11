const Payment = require('../models/payment.model');
const StudentFee = require('../models/studentFee.model');
const User = require('../models/user.model');

// Record a new payment (supports offline, online, and partial payments)
const recordPayment = async (req, res) => {
  try {
    const {
      studentId,
      studentFeeId,
      mode,
      method,
      paidAmount,
      paidFor,
      transactionId,
      chequeDetails,
      notes,
      paymentSource,
      qrCodeId,
      isPartialPayment,
      partialPaymentGroup,
      requiresVerification
    } = req.body;
    
    // Validate student fee exists
    const studentFee = await StudentFee.findById(studentFeeId);
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee record not found'
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
    
    // Generate receipt number
    const receiptNo = await Payment.generateReceiptNo();
    
    // Create payment record
    const payment = new Payment({
      studentId,
      studentFeeId,
      mode,
      method,
      paidAmount,
      paidFor,
      receiptNo,
      transactionId,
      chequeDetails,
      notes,
      academicYear: studentFee.academicYear,
      semester: studentFee.semester,
      addedBy: req.user.id,
      paymentSource: paymentSource || (mode === 'offline' ? 'admin_entry' : 'student_portal'),
      qrCodeId,
      qrCodeGeneratedBy: qrCodeId ? req.user.id : undefined,
      isPartialPayment: isPartialPayment || false,
      partialPaymentGroup,
      requiresVerification: requiresVerification || (mode === 'offline' && method === 'cheque')
    });
    
    // Record payment in student fee
    await studentFee.recordPayment({
      paidFor: paidFor.map(item => item.feeItemId),
      amount: paidAmount
    });
    
    await payment.save();
    
    // Populate the response
    await payment.populate([
      { path: 'studentId', select: 'firstName lastName studentId email' },
      { path: 'studentFeeId', select: 'semester academicYear totalDue totalPaid' },
      { path: 'addedBy', select: 'firstName lastName' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  }
};

// Get payments
const getPayments = async (req, res) => {
  try {
    const { studentId, studentFeeId, mode, method, status, startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filters = {};
    if (studentId) filters.studentId = studentId;
    if (studentFeeId) filters.studentFeeId = studentFeeId;
    if (mode) filters.mode = mode;
    if (method) filters.method = method;
    if (status) filters.status = status;
    
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.$gte = new Date(startDate);
      if (endDate) filters.date.$lte = new Date(endDate);
    }
    
    const payments = await Payment.find(filters)
      .populate('studentId', 'firstName lastName studentId email')
      .populate('studentFeeId', 'semester academicYear')
      .populate('addedBy', 'firstName lastName')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Payment.countDocuments(filters);
    
    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

// Get payment by ID
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('studentId', 'firstName lastName studentId email phone')
      .populate('studentFeeId', 'semester academicYear totalDue totalPaid')
      .populate('addedBy', 'firstName lastName')
      .populate('verifiedBy', 'firstName lastName');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
      error: error.message
    });
  }
};

// Get payments by student
const getPaymentsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear, semester } = req.query;
    
    const filters = {};
    if (academicYear) filters.academicYear = academicYear;
    if (semester) filters.semester = parseInt(semester);
    
    const payments = await Payment.getPaymentsByStudent(studentId, filters);
    
    res.status(200).json({
      success: true,
      data: payments,
      count: payments.length
    });
  } catch (error) {
    console.error('Error fetching payments by student:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments by student',
      error: error.message
    });
  }
};

// Get payment statistics
const getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate, mode, method } = req.query;
    
    const filters = {};
    if (mode) filters.mode = mode;
    if (method) filters.method = method;
    
    if (startDate || endDate) {
      filters.date = {};
      if (startDate) filters.date.$gte = new Date(startDate);
      if (endDate) filters.date.$lte = new Date(endDate);
    }
    
    const stats = await Payment.getPaymentStats(filters);
    
    // Get method-wise breakdown
    const methodBreakdown = await Payment.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$paidAmount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);
    
    // Get daily payments for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyPayments = await Payment.aggregate([
      {
        $match: {
          date: { $gte: thirtyDaysAgo },
          ...filters
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$paidAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        overall: stats,
        methodBreakdown,
        dailyPayments
      }
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
      error: error.message
    });
  }
};

// Update payment status
const updatePaymentStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    payment.status = status;
    if (notes) payment.notes = notes;
    
    if (status === 'confirmed') {
      payment.verifiedBy = req.user.id;
    }
    
    await payment.save();
    
    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
};

// Refund payment
const refundPayment = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    if (payment.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Payment is already refunded'
      });
    }
    
    await payment.refund(reason);
    
    res.status(200).json({
      success: true,
      message: 'Payment refunded successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error refunding payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refund payment',
      error: error.message
    });
  }
};

// Generate QR code for payment
const generatePaymentQR = async (req, res) => {
  try {
    const { studentId, studentFeeId, amount, description } = req.body;

    // Validate student fee exists
    const studentFee = await StudentFee.findById(studentFeeId);
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee record not found'
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

    // Generate unique QR code ID
    const qrCodeId = `QR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create Razorpay order for QR payment
    const RazorpayService = require('../services/razorpay.service');
    const orderResult = await RazorpayService.createOrder({
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: qrCodeId,
      notes: {
        studentId,
        studentFeeId,
        qrCodeId,
        generatedBy: req.user.id,
        description: description || 'Fee Payment'
      }
    });

    if (!orderResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create payment order',
        error: orderResult.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'QR code generated successfully',
      data: {
        qrCodeId,
        orderId: orderResult.order.id,
        amount,
        studentName: `${student.firstName} ${student.lastName}`,
        description: description || 'Fee Payment',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        qrString: `upi://pay?pa=merchant@upi&pn=SmartFee&am=${amount}&cu=INR&tn=${description || 'Fee Payment'}&tr=${qrCodeId}`
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get payment dashboard data
const getPaymentDashboard = async (req, res) => {
  try {
    const { academicYear, semester, dateFrom, dateTo } = req.query;

    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);

    const filters = {};
    if (academicYear) filters.academicYear = academicYear;
    if (semester) filters.semester = parseInt(semester);
    if (dateFrom || dateTo) filters.date = dateFilter;

    // Get payment statistics
    const stats = await Payment.getPaymentStats(filters);

    // Get recent payments
    const recentPayments = await Payment.find(filters)
      .populate('studentId', 'firstName lastName studentId')
      .populate('addedBy', 'firstName lastName')
      .sort({ date: -1 })
      .limit(10);

    // Get payment method breakdown
    const methodBreakdown = await Payment.aggregate([
      { $match: filters },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$paidAmount' }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Get pending verifications (for offline payments)
    const pendingVerifications = await Payment.countDocuments({
      requiresVerification: true,
      status: 'pending',
      ...filters
    });

    res.json({
      success: true,
      data: {
        stats,
        recentPayments,
        methodBreakdown,
        pendingVerifications
      }
    });
  } catch (error) {
    console.error('Error getting payment dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Verify offline payment
const verifyOfflinePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationNotes, approved } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (!payment.requiresVerification) {
      return res.status(400).json({
        success: false,
        message: 'Payment does not require verification'
      });
    }

    // Update payment verification status
    payment.verifiedBy = req.user.id;
    payment.verificationNotes = verificationNotes;
    payment.status = approved ? 'verified' : 'failed';
    payment.requiresVerification = false;

    await payment.save();

    // Populate the response
    await payment.populate([
      { path: 'studentId', select: 'firstName lastName studentId email' },
      { path: 'verifiedBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: `Payment ${approved ? 'verified' : 'rejected'} successfully`,
      data: payment
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get payment receipt data
const getPaymentReceipt = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate('studentId', 'firstName lastName studentId email phone')
      .populate('studentFeeId', 'semester academicYear totalDue totalPaid')
      .populate('addedBy', 'firstName lastName')
      .populate('verifiedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Calculate remaining balance
    const studentFee = payment.studentFeeId;
    const remainingBalance = studentFee.netAmount - studentFee.totalPaid;

    const receiptData = {
      receiptNo: payment.formattedReceiptNo,
      paymentId: payment._id,
      date: payment.date,
      student: {
        name: `${payment.studentId.firstName} ${payment.studentId.lastName}`,
        studentId: payment.studentId.studentId,
        email: payment.studentId.email,
        phone: payment.studentId.phone
      },
      payment: {
        amount: payment.paidAmount,
        mode: payment.mode,
        method: payment.method,
        transactionId: payment.transactionId,
        status: payment.status
      },
      feeDetails: {
        semester: studentFee.semester,
        academicYear: studentFee.academicYear,
        totalDue: studentFee.totalDue,
        totalPaid: studentFee.totalPaid,
        remainingBalance
      },
      paidFor: payment.paidFor,
      notes: payment.notes,
      addedBy: payment.addedBy ? `${payment.addedBy.firstName} ${payment.addedBy.lastName}` : 'System',
      verifiedBy: payment.verifiedBy ? `${payment.verifiedBy.firstName} ${payment.verifiedBy.lastName}` : null,
      chequeDetails: payment.chequeDetails,
      isPartialPayment: payment.isPartialPayment,
      partialPaymentGroup: payment.partialPaymentGroup
    };

    res.json({
      success: true,
      data: receiptData
    });
  } catch (error) {
    console.error('Error getting payment receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  recordPayment,
  getPayments,
  getPaymentById,
  getPaymentsByStudent,
  getPaymentStats,
  updatePaymentStatus,
  refundPayment,
  generatePaymentQR,
  getPaymentDashboard,
  verifyOfflinePayment,
  getPaymentReceipt
}; 