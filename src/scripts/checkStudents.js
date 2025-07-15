const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/user.model');

const checkStudents = async () => {
  try {
    console.log('🔍 Checking Students in Database');
    console.log('===============================');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all students
    const students = await User.find({ role: 'student' });
    console.log(`👥 Found ${students.length} students in database`);
    
    if (students.length === 0) {
      console.log('❌ No students found. Please create students first.');
      return;
    }
    
    console.log('\n📋 Student Details:');
    console.log('==================');
    
    students.forEach((student, index) => {
      console.log(`\n${index + 1}. ${student.firstName} ${student.lastName}`);
      console.log(`   Student ID: ${student.studentId}`);
      console.log(`   Email: ${student.email}`);
      console.log(`   Role: ${student.role}`);
      console.log(`   Current Semester: ${student.currentSemester}`);
      console.log(`   Academic Year: ${student.academicYear}`);
      console.log(`   Course Info:`, student.courseInfo);
      console.log(`   Enrollment Date: ${student.enrollmentDate}`);
      console.log(`   Is Active: ${student.isActive}`);
    });
    
    // Check course info patterns
    console.log('\n📊 Course Info Analysis:');
    console.log('=======================');
    
    const coursePatterns = {};
    students.forEach(student => {
      const programName = student.courseInfo?.program_name || 'Unknown';
      const branch = student.courseInfo?.branch || 'Unknown';
      const key = `${programName} - ${branch}`;
      
      if (!coursePatterns[key]) {
        coursePatterns[key] = {
          count: 0,
          semesters: new Set(),
          academicYears: new Set()
        };
      }
      
      coursePatterns[key].count++;
      coursePatterns[key].semesters.add(student.currentSemester);
      coursePatterns[key].academicYears.add(student.academicYear);
    });
    
    Object.entries(coursePatterns).forEach(([course, data]) => {
      console.log(`\n${course}:`);
      console.log(`   Count: ${data.count} students`);
      console.log(`   Semesters: ${Array.from(data.semesters).join(', ')}`);
      console.log(`   Academic Years: ${Array.from(data.academicYears).join(', ')}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking students:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run if this file is executed directly
if (require.main === module) {
  checkStudents();
}

module.exports = { checkStudents }; 