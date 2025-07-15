const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const StudentFee = require('../models/studentFee.model');
const User = require('../models/user.model');
const FeeCategory = require('../models/feeCategory.model');

const checkStudentFees = async () => {
  try {
    console.log('🔍 Checking Student Fee Records');
    console.log('===============================');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all student fees
    const studentFees = await StudentFee.find({})
      .populate('studentId', 'firstName lastName studentId email')
      .populate('feeItems.categoryId', 'name type');
    
    console.log(`📋 Found ${studentFees.length} student fee records`);
    
    if (studentFees.length === 0) {
      console.log('❌ No student fee records found.');
      return;
    }
    
    console.log('\n📊 Student Fee Details:');
    console.log('=======================');
    
    studentFees.forEach((fee, index) => {
      if (!fee.studentId) {
        console.log(`\n${index + 1}. [Student ID Missing]`);
        console.log(`   Semester: ${fee.semester}`);
        console.log(`   Academic Year: ${fee.academicYear}`);
        console.log(`   Total Due: ₹${fee.totalDue?.toLocaleString()}`);
        console.log(`   Total Paid: ₹${fee.totalPaid?.toLocaleString()}`);
        console.log(`   Fee Items: ${fee.feeItems.length}`);
        return;
      }
      
      console.log(`\n${index + 1}. ${fee.studentId.firstName} ${fee.studentId.lastName} (${fee.studentId.studentId})`);
      console.log(`   Semester: ${fee.semester}`);
      console.log(`   Academic Year: ${fee.academicYear}`);
      console.log(`   Total Due: ₹${fee.totalDue?.toLocaleString()}`);
      console.log(`   Total Paid: ₹${fee.totalPaid?.toLocaleString()}`);
      console.log(`   Fee Items: ${fee.feeItems.length}`);
      
      if (fee.feeItems.length > 0) {
        console.log('   Fee Items:');
        fee.feeItems.forEach((item, itemIndex) => {
          console.log(`     ${itemIndex + 1}. ${item.name} - ₹${item.originalAmount?.toLocaleString()} (${item.status})`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking student fees:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run if this file is executed directly
if (require.main === module) {
  checkStudentFees();
}

module.exports = { checkStudentFees }; 