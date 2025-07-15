const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const StudentFee = require('../models/studentFee.model');
const User = require('../models/user.model');
const FeeCategory = require('../models/feeCategory.model');

const testCustomFee = async () => {
  try {
    console.log('🧪 Testing Custom Fee Functionality');
    console.log('===================================');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find a student with fee records
    const studentFee = await StudentFee.findOne({ 
      totalDue: { $gt: 0 },
      feeItems: { $exists: true, $ne: [] }
    }).populate('studentId', 'firstName lastName studentId');
    
    if (!studentFee) {
      console.log('❌ No student fee records found. Please run fee assignment first.');
      return;
    }
    
    if (!studentFee.studentId) {
      console.log('❌ Student fee record found but studentId is null. Skipping...');
      return;
    }
    
    console.log(`👤 Testing with: ${studentFee.studentId.firstName} ${studentFee.studentId.lastName}`);
    console.log(`📊 Current fee items: ${studentFee.feeItems.length}`);
    console.log(`💰 Current total due: ₹${studentFee.totalDue?.toLocaleString()}`);
    
    // Find or create custom fee category
    let customCategory = await FeeCategory.findOne({ name: 'Custom Fees' });
    
    if (!customCategory) {
      console.log('📝 Creating Custom Fees category...');
      customCategory = new FeeCategory({
        name: 'Custom Fees',
        type: 'custom',
        description: 'Custom fees added by administrators',
        meta: { mandatory: false, refundable: true },
        createdBy: studentFee.generatedBy
      });
      await customCategory.save();
      console.log('✅ Custom Fees category created');
    }
    
    // Add a test custom fee
    const testCustomFee = {
      categoryId: customCategory._id,
      name: 'Test Custom Fee',
      originalAmount: 2500,
      paid: 0,
      status: 'unpaid',
      notes: 'This is a test custom fee added via script',
      meta: { isCustom: true, addedBy: studentFee.generatedBy, addedAt: new Date() },
      isOptional: false,
      isIncluded: true
    };
    
    console.log('➕ Adding test custom fee...');
    studentFee.feeItems.push(testCustomFee);
    studentFee.lastModifiedBy = studentFee.generatedBy;
    
    // Recalculate totals
    studentFee.totalDue = studentFee.feeItems
      .filter(item => item.isIncluded)
      .reduce((total, item) => total + item.originalAmount, 0);
    
    await studentFee.save();
    
    console.log('✅ Test custom fee added successfully!');
    console.log(`📊 New fee items count: ${studentFee.feeItems.length}`);
    console.log(`💰 New total due: ₹${studentFee.totalDue?.toLocaleString()}`);
    
    // Show the new fee item
    const newFeeItem = studentFee.feeItems[studentFee.feeItems.length - 1];
    console.log(`🎯 New fee item: ${newFeeItem.name} - ₹${newFeeItem.originalAmount?.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error testing custom fee:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run if this file is executed directly
if (require.main === module) {
  testCustomFee();
}

module.exports = { testCustomFee }; 