const RazorpayService = require('../services/razorpay.service');
const Payment = require('../models/payment.model');
const StudentFee = require('../models/studentFee.model');
const User = require('../models/user.model');

// Create Razorpay order
const createOrder = async (req, res) => {
  try {
    const { studentId, studentFeeId, amount, notes } = req.body;

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
    const receipt = RazorpayService.generateReceiptNumber();

    // Create order with Razorpay
    const orderData = await RazorpayService.createOrder(
      amount,
      'INR',
      receipt,
      {
        studentId: studentId,
        studentFeeId: studentFeeId,
        ...notes
      }
    );

    if (!orderData.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Razorpay order',
        error: orderData.error
      });
    }

    // Store order details in database (you might want to create an Order model)
    // For now, we'll return the order details
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: orderData.order.id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        receipt: orderData.order.receipt,
        status: orderData.order.status,
        key: process.env.RAZORPAY_KEY,
        studentName: `${student.firstName} ${student.lastName}`,
        studentEmail: student.email,
        studentPhone: student.phone
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Verify payment and record in database
const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      studentId,
      studentFeeId,
      paidFor,
      notes
    } = req.body;

    // Verify payment signature
    const isValidSignature = RazorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Fetch payment details from Razorpay
    const paymentData = await RazorpayService.getPayment(razorpay_payment_id);
    if (!paymentData.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment details',
        error: paymentData.error
      });
    }

    const razorpayPayment = paymentData.payment;

    // Validate student fee exists
    const studentFee = await StudentFee.findById(studentFeeId);
    if (!studentFee) {
      return res.status(404).json({
        success: false,
        message: 'Student fee record not found'
      });
    }

    // Generate receipt number
    const receiptNo = await Payment.generateReceiptNo();

    // Create payment record in database
    const payment = new Payment({
      studentId,
      studentFeeId,
      mode: 'online',
      method: 'razorpay',
      paidAmount: razorpayPayment.amount / 100, // Convert from paise to rupees
      paidFor,
      receiptNo,
      transactionId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentStatus: razorpayPayment.status,
      notes,
      academicYear: studentFee.academicYear,
      semester: studentFee.semester,
      addedBy: req.user ? req.user.id : studentId, // If student is making payment directly
      status: 'verified'
    });

    // Record payment in student fee
    await studentFee.recordPayment({
      paidFor: paidFor.map(item => item.feeItemId),
      amount: razorpayPayment.amount / 100
    });

    await payment.save();

    // Populate the response
    await payment.populate([
      { path: 'studentId', select: 'firstName lastName studentId email' },
      { path: 'studentFeeId', select: 'semester academicYear totalDue totalPaid' },
      { path: 'addedBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Payment verified and recorded successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

// Handle Razorpay webhooks
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    // Validate webhook signature (you should set RAZORPAY_WEBHOOK_SECRET in .env)
    const isValidSignature = RazorpayService.validateWebhookSignature(
      body,
      signature,
      process.env.RAZORPAY_WEBHOOK_SECRET
    );

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    const event = body.event;
    const paymentEntity = body.payload.payment ? body.payload.payment.entity : null;
    const orderEntity = body.payload.order ? body.payload.order.entity : null;

    console.log('Razorpay webhook received:', event);

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(paymentEntity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(paymentEntity);
        break;
      case 'order.paid':
        await handleOrderPaid(orderEntity);
        break;
      default:
        console.log('Unhandled webhook event:', event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle webhook',
      error: error.message
    });
  }
};

// Helper function to handle payment captured webhook
const handlePaymentCaptured = async (paymentEntity) => {
  try {
    // Find payment record by Razorpay payment ID
    const payment = await Payment.findOne({
      razorpayPaymentId: paymentEntity.id
    });

    if (payment) {
      payment.paymentStatus = 'captured';
      payment.status = 'verified';
      await payment.save();
      console.log('Payment status updated to captured:', paymentEntity.id);
    }
  } catch (error) {
    console.error('Error handling payment captured webhook:', error);
  }
};

// Helper function to handle payment failed webhook
const handlePaymentFailed = async (paymentEntity) => {
  try {
    // Find payment record by Razorpay payment ID
    const payment = await Payment.findOne({
      razorpayPaymentId: paymentEntity.id
    });

    if (payment) {
      payment.paymentStatus = 'failed';
      payment.status = 'failed';
      await payment.save();
      console.log('Payment status updated to failed:', paymentEntity.id);
    }
  } catch (error) {
    console.error('Error handling payment failed webhook:', error);
  }
};

// Helper function to handle order paid webhook
const handleOrderPaid = async (orderEntity) => {
  try {
    console.log('Order paid webhook received:', orderEntity.id);
    // Handle order paid logic if needed
  } catch (error) {
    console.error('Error handling order paid webhook:', error);
  }
};

// Get payment status
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const paymentData = await RazorpayService.getPayment(paymentId);
    if (!paymentData.success) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
        error: paymentData.error
      });
    }

    res.status(200).json({
      success: true,
      data: paymentData.payment
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment status',
      error: error.message
    });
  }
};

// Create refund
const createRefund = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason } = req.body;

    // Find payment record
    const payment = await Payment.findOne({
      razorpayPaymentId: paymentId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    // Create refund with Razorpay
    const refundData = await RazorpayService.createRefund(
      paymentId,
      amount,
      { reason }
    );

    if (!refundData.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create refund',
        error: refundData.error
      });
    }

    // Update payment record
    payment.refundAmount = (payment.refundAmount || 0) + amount;
    payment.refundStatus = 'partial';
    if (payment.refundAmount >= payment.paidAmount) {
      payment.refundStatus = 'full';
    }
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Refund created successfully',
      data: refundData.refund
    });
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create refund',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
  getPaymentStatus,
  createRefund
}; 