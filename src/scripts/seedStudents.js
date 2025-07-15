const mongoose = require('mongoose');
const User = require('../models/user.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartfee';

async function seedStudents() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const students = [
    {
      firstName: 'Amit',
      lastName: 'Sharma',
      email: 'amit.sharma1@example.com',
      studentId: 'SVIET-2023-BCA-001',
      phone: '9876543210',
      role: 'student',
      isActive: true,
      academicStatus: 'active',
      courseInfo: {
        program_name: 'BCA',
        branch: 'Computer Applications',
        category: 'Computer Applications',
        course_name: 'Bachelor of Computer Applications',
        duration: '3 Years',
        totalSemesters: 6
      },
      currentSemester: 1,
      yearOfJoining: 2023,
      password: 'defaultPassword123'
    },
    {
      firstName: 'Priya',
      lastName: 'Verma',
      email: 'priya.verma2@example.com',
      studentId: 'SVIET-2024-CSE-002',
      phone: '9876543211',
      role: 'student',
      isActive: true,
      academicStatus: 'active',
      courseInfo: {
        program_name: 'B.Tech',
        branch: 'Computer Science and Engineering',
        category: 'Engineering',
        course_name: 'Bachelor of Technology in Computer Science and Engineering',
        duration: '4 Years',
        totalSemesters: 8
      },
      currentSemester: 2,
      yearOfJoining: 2024,
      password: 'defaultPassword123'
    },
    {
      firstName: 'Rahul',
      lastName: 'Patel',
      email: 'rahul.patel3@example.com',
      studentId: 'SVIET-2022-MBA-003',
      phone: '9876543212',
      role: 'student',
      isActive: true,
      academicStatus: 'active',
      courseInfo: {
        program_name: 'MBA',
        branch: 'Business Administration',
        category: 'Management',
        course_name: 'Master of Business Administration',
        duration: '2 Years',
        totalSemesters: 4
      },
      currentSemester: 1,
      yearOfJoining: 2022,
      password: 'defaultPassword123'
    }
  ];

  await User.insertMany(students);
  console.log('Inserted 3 students');
  await mongoose.disconnect();
}

seedStudents().catch(err => {
  console.error('Error seeding students:', err);
  process.exit(1);
}); 