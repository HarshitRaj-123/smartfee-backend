const mongoose = require('mongoose');
const User = require('../models/user.model');
const StudentFee = require('../models/studentFee.model');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartfee', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testCustomFeeCreation = async () => {
  try {
    console.log('Testing custom fee creation...');
    
    // Find a student
    const student = await User.findOne({ role: 'student' });
    if (!student) {
      console.log('No student found in database');
      return;
    }
    
    console.log('Found student:', student.firstName, student.lastName, student.studentId);
    
    // Check if student already has a fee record
    const existingFee = await StudentFee.findOne({
      studentId: student._id,
      semester: student.currentSemester || 1,
      academicYear: new Date().getFullYear().toString()
    });
    
    if (existingFee) {
      console.log('Student already has a fee record for this semester');
      console.log('Fee record ID:', existingFee._id);
      console.log('Fee items count:', existingFee.feeItems.length);
      return;
    }
    
    console.log('Student does not have a fee record for this semester');
    console.log('You can now test the Add Fee button in the frontend');
    
  } catch (error) {
    console.error('Error testing custom fee creation:', error);
  } finally {
    mongoose.connection.close();
  }
};

testCustomFeeCreation(); 