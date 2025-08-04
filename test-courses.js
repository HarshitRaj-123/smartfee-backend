const mongoose = require('mongoose');
require('dotenv').config();

const Course = require('./src/models/course.model');

async function testCourses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if courses exist
    const courses = await Course.find({ isActive: true })
      .select('name code category program_name branch totalSemesters duration')
      .sort({ name: 1 });

    console.log(`Found ${courses.length} courses in database`);
    
    if (courses.length > 0) {
      console.log('\nFirst 5 courses:');
      courses.slice(0, 5).forEach(course => {
        console.log(`- ${course.name} (${course.code}) - ${course.duration}`);
      });
    } else {
      console.log('No courses found in database');
    }

    // Test the organized courses fallback
    const organizedCourses = require('./src/constants/organized_courses');
    console.log(`\nOrganized courses available: ${organizedCourses.length}`);

  } catch (error) {
    console.error('Error testing courses:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

testCourses(); 