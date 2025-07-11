const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const User = require('../models/user.model');
const Course = require('../models/course.model');
const FeeCategory = require('../models/feeCategory.model');
const FeeTemplate = require('../models/feeTemplate.model');
const StudentFee = require('../models/studentFee.model');

const setupCompleteSystem = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    console.log('\n🚀 SETTING UP COMPLETE DYNAMIC FEE SYSTEM');
    console.log('==========================================');

    // Step 1: Find admin user
    const adminUser = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }
    console.log(`✅ Found admin user: ${adminUser.firstName} ${adminUser.lastName}`);

    // Step 2: Clear existing data (optional - uncomment if needed)
    // console.log('\n🧹 Clearing existing data...');
    // await Course.deleteMany({});
    // await FeeCategory.deleteMany({});
    // await FeeTemplate.deleteMany({});
    // await StudentFee.deleteMany({});

    // Step 3: Create comprehensive course structure
    console.log('\n📚 Creating comprehensive course structure...');
    
    const sampleCourses = [
      {
        name: 'Bachelor of Technology in Computer Science and Engineering',
        code: 'BTCSE',
        category: 'Engineering',
        program_name: 'B.Tech',
        branch: 'Computer Science and Engineering',
        course_name: 'Bachelor of Technology in Computer Science and Engineering',
        duration: '4 Years',
        totalSemesters: 8,
        department: 'Engineering',
        description: 'Four-year undergraduate program in Computer Science and Engineering',
        createdBy: adminUser._id,
        eligibilityCriteria: '10+2 with PCM and minimum 75% marks',
        fees: {
          admissionFee: 25000,
          securityDeposit: 10000,
          otherCharges: 5000
        }
      },
      {
        name: 'Bachelor of Computer Applications',
        code: 'BCA',
        category: 'Computer Applications',
        program_name: 'BCA',
        branch: 'Computer Applications',
        course_name: 'Bachelor of Computer Applications',
        duration: '3 Years',
        totalSemesters: 6,
        department: 'Computer Applications',
        description: 'Three-year undergraduate program in Computer Applications',
        createdBy: adminUser._id,
        eligibilityCriteria: '10+2 with minimum 60% marks',
        fees: {
          admissionFee: 15000,
          securityDeposit: 8000,
          otherCharges: 3000
        }
      },
      {
        name: 'Master of Business Administration',
        code: 'MBA',
        category: 'Management',
        program_name: 'MBA',
        branch: 'Business Administration',
        course_name: 'Master of Business Administration',
        duration: '2 Years',
        totalSemesters: 4,
        department: 'Management',
        description: 'Two-year postgraduate program in Business Administration',
        createdBy: adminUser._id,
        eligibilityCriteria: 'Bachelor degree with minimum 50% marks',
        fees: {
          admissionFee: 50000,
          securityDeposit: 15000,
          otherCharges: 8000
        }
      }
    ];

    let createdCourses = [];
    for (const courseData of sampleCourses) {
      const existingCourse = await Course.findOne({ code: courseData.code });
      if (!existingCourse) {
        const course = new Course(courseData);
        await course.save();
        createdCourses.push(course);
        console.log(`   ✅ Created course: ${course.name} (${course.code})`);
      } else {
        createdCourses.push(existingCourse);
        console.log(`   ℹ️  Course already exists: ${existingCourse.name} (${existingCourse.code})`);
      }
    }

    // Step 4: Create comprehensive fee categories
    console.log('\n💰 Creating comprehensive fee categories...');
    
    const feeCategories = [
      {
        name: 'Tuition Fee',
        type: 'base',
        description: 'Basic tuition fee for academic instruction',
        meta: { mandatory: true, refundable: false },
        createdBy: adminUser._id
      },
      {
        name: 'Lab Fee',
        type: 'service',
        description: 'Laboratory usage and equipment fee',
        meta: { mandatory: true, refundable: false },
        createdBy: adminUser._id
      },
      {
        name: 'Library Fee',
        type: 'service',
        description: 'Library access and book usage fee',
        meta: { mandatory: true, refundable: false },
        createdBy: adminUser._id
      },
      {
        name: 'Hostel Fee',
        type: 'service',
        description: 'Accommodation charges for hostel residents',
        meta: { mandatory: false, refundable: true, roomTypes: ['single', 'double', 'triple', 'ac', 'non-ac'] },
        createdBy: adminUser._id
      },
      {
        name: 'Mess Fee',
        type: 'service',
        description: 'Meal charges for mess facility',
        meta: { mandatory: false, refundable: true, mealTypes: ['veg', 'non-veg', 'both'] },
        createdBy: adminUser._id
      },
      {
        name: 'Transport Fee',
        type: 'service',
        description: 'Transportation facility charges',
        meta: { mandatory: false, refundable: true, routes: ['Route A', 'Route B', 'Route C'] },
        createdBy: adminUser._id
      },
      {
        name: 'Sports Fee',
        type: 'service',
        description: 'Sports facility and equipment usage fee',
        meta: { mandatory: true, refundable: false },
        createdBy: adminUser._id
      },
      {
        name: 'Exam Fee',
        type: 'base',
        description: 'Examination and evaluation charges',
        meta: { mandatory: true, refundable: false },
        createdBy: adminUser._id
      },
      {
        name: 'Development Fee',
        type: 'misc',
        description: 'Infrastructure development and maintenance fee',
        meta: { mandatory: true, refundable: false },
        createdBy: adminUser._id
      },
      {
        name: 'Late Fee',
        type: 'fine',
        description: 'Penalty for late payment of fees',
        meta: { mandatory: false, refundable: false },
        createdBy: adminUser._id
      }
    ];

    let createdCategories = [];
    for (const categoryData of feeCategories) {
      const existingCategory = await FeeCategory.findOne({ name: categoryData.name });
      if (!existingCategory) {
        const category = new FeeCategory(categoryData);
        await category.save();
        createdCategories.push(category);
        console.log(`   ✅ Created fee category: ${category.name}`);
      } else {
        createdCategories.push(existingCategory);
        console.log(`   ℹ️  Fee category already exists: ${existingCategory.name}`);
      }
    }

    // Step 5: Create fee templates for each course and semester
    console.log('\n📋 Creating comprehensive fee templates...');
    
    console.log('\n⚠️  IMPORTANT: FEE TEMPLATE CREATION SKIPPED');
    console.log('==============================================');
    console.log('This system now uses DYNAMIC FEE MANAGEMENT.');
    console.log('Fee amounts are NOT hardcoded and must be configured by admins.');
    console.log('');
    console.log('🎯 TO CREATE FEE TEMPLATES:');
    console.log('1. Use the Admin Dashboard or API endpoints');
    console.log('2. POST /api/fee-templates with your custom amounts');
    console.log('3. Each course-semester combination needs its own template');
    console.log('');
    console.log('📋 Available Fee Categories:');
    for (const category of createdCategories) {
      console.log(`   - ${category.name} (${category.type}) - ID: ${category._id}`);
    }
    console.log('');
    console.log('📚 Available Courses:');
    for (const course of createdCourses) {
      console.log(`   - ${course.name} (${course.code}) - ID: ${course._id}`);
      console.log(`     Semesters: 1 to ${course.totalSemesters}`);
    }

    // Step 6: Create sample students with services
    console.log('\n👨‍🎓 Creating sample students with different service configurations...');
    
    const sampleStudents = [
      {
        email: 'student1@example.com',
        password: 'password123',
        role: 'student',
        firstName: 'Rahul',
        lastName: 'Sharma',
        studentId: 'ST2024001',
        rollNumber: 'BTCSE001',
        courseId: createdCourses[0]._id, // B.Tech CSE
        currentSemester: 1,
        academicYear: '2024-25',
        yearOfJoining: 2024,
        enrollmentDate: new Date(),
        phone: '+91-9876543210',
        servicesOpted: {
          hostel: {
            isOpted: true,
            roomType: 'double',
            blockName: 'A Block',
            roomNumber: 'A-101',
            optedDate: new Date()
          },
          mess: {
            isOpted: true,
            mealType: 'veg',
            planType: 'semester',
            optedDate: new Date()
          },
          transport: {
            isOpted: true,
            route: 'Route A',
            distance: 15,
            pickupPoint: 'Central Bus Stand',
            optedDate: new Date()
          },
          library: {
            isOpted: true,
            cardNumber: 'LIB2024001',
            optedDate: new Date()
          }
        }
      },
      {
        email: 'student2@example.com',
        password: 'password123',
        role: 'student',
        firstName: 'Priya',
        lastName: 'Patel',
        studentId: 'ST2024002',
        rollNumber: 'BCA001',
        courseId: createdCourses[1]._id, // BCA
        currentSemester: 1,
        academicYear: '2024-25',
        yearOfJoining: 2024,
        enrollmentDate: new Date(),
        phone: '+91-9876543211',
        servicesOpted: {
          hostel: {
            isOpted: false,
            roomType: 'double'
          },
          mess: {
            isOpted: false,
            mealType: 'veg'
          },
          transport: {
            isOpted: true,
            route: 'Route B',
            distance: 8,
            pickupPoint: 'Railway Station',
            optedDate: new Date()
          },
          library: {
            isOpted: true,
            cardNumber: 'LIB2024002',
            optedDate: new Date()
          }
        }
      },
      {
        email: 'student3@example.com',
        password: 'password123',
        role: 'student',
        firstName: 'Arjun',
        lastName: 'Singh',
        studentId: 'ST2024003',
        rollNumber: 'MBA001',
        courseId: createdCourses[2]._id, // MBA
        currentSemester: 1,
        academicYear: '2024-25',
        yearOfJoining: 2024,
        enrollmentDate: new Date(),
        phone: '+91-9876543212',
        servicesOpted: {
          hostel: {
            isOpted: true,
            roomType: 'single',
            blockName: 'B Block',
            roomNumber: 'B-201',
            optedDate: new Date()
          },
          mess: {
            isOpted: true,
            mealType: 'non-veg',
            planType: 'monthly',
            optedDate: new Date()
          },
          transport: {
            isOpted: false,
            route: '',
            distance: 0
          },
          library: {
            isOpted: true,
            cardNumber: 'LIB2024003',
            optedDate: new Date()
          }
        }
      }
    ];

    let createdStudents = [];
    for (const studentData of sampleStudents) {
      const existingStudent = await User.findOne({ email: studentData.email });
      if (!existingStudent) {
        const student = new User(studentData);
        await student.save();
        createdStudents.push(student);
        console.log(`   ✅ Created student: ${student.firstName} ${student.lastName} (${student.studentId})`);
      } else {
        createdStudents.push(existingStudent);
        console.log(`   ℹ️  Student already exists: ${existingStudent.firstName} ${existingStudent.lastName}`);
      }
    }

    // Step 7: Generate fee structures for students
    console.log('\n💳 Generating fee structures for students...');
    
    for (const student of createdStudents) {
      const existingFee = await StudentFee.findOne({
        studentId: student._id,
        semester: student.currentSemester,
        academicYear: student.academicYear
      });

      if (!existingFee) {
        const template = await FeeTemplate.getTemplateByCourse(
          student.courseId,
          student.currentSemester,
          student.academicYear
        );

        if (template) {
          const studentFeeData = template.cloneForStudent(student._id);
          studentFeeData.generatedBy = adminUser._id;
          
          // Set due date (30 days from now)
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30);
          studentFeeData.dueDate = dueDate;

          // Adjust fees based on services opted
          studentFeeData.feeItems = studentFeeData.feeItems.filter(item => {
            // Remove optional services not opted by student
            if (item.isOptional) {
              if (item.name.toLowerCase().includes('hostel') && !student.servicesOpted.hostel.isOpted) {
                return false;
              }
              if (item.name.toLowerCase().includes('mess') && !student.servicesOpted.mess.isOpted) {
                return false;
              }
              if (item.name.toLowerCase().includes('transport') && !student.servicesOpted.transport.isOpted) {
                return false;
              }
            }
            return true;
          });

          // Recalculate total
          studentFeeData.totalDue = studentFeeData.feeItems.reduce((sum, item) => sum + item.originalAmount, 0);
          studentFeeData.netAmount = studentFeeData.totalDue;

          const studentFee = new StudentFee(studentFeeData);
          await studentFee.save();
          
          console.log(`   ✅ Generated fee for ${student.firstName} ${student.lastName}: ₹${studentFee.netAmount}`);
        }
      } else {
        console.log(`   ℹ️  Fee already exists for ${student.firstName} ${student.lastName}`);
      }
    }

    // Step 8: Display system summary
    console.log('\n📊 SYSTEM SETUP SUMMARY');
    console.log('======================');
    
    const [courseCount, categoryCount, templateCount, studentCount, feeCount] = await Promise.all([
      Course.countDocuments({ isActive: true }),
      FeeCategory.countDocuments({ isActive: true }),
      FeeTemplate.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'student', isActive: true }),
      StudentFee.countDocuments({})
    ]);

    console.log(`📚 Active Courses: ${courseCount}`);
    console.log(`💰 Fee Categories: ${categoryCount}`);
    console.log(`📋 Fee Templates: ${templateCount}`);
    console.log(`👨‍🎓 Active Students: ${studentCount}`);
    console.log(`💳 Student Fee Records: ${feeCount}`);

    console.log('\n🎉 COMPLETE DYNAMIC FEE SYSTEM SETUP SUCCESSFUL!');
    console.log('\nFeatures Available:');
    console.log('✅ Dynamic Fee Categories and Templates');
    console.log('✅ Student Service Management (Hostel, Mess, Transport, Library)');
    console.log('✅ Semester-wise Fee Structure');
    console.log('✅ Automatic Fee Calculation based on Services');
    console.log('✅ Payment Tracking and Receipt Generation');
    console.log('✅ Fine and Discount Management');
    console.log('✅ Comprehensive Course Management');
    console.log('✅ Role-based Access Control');

    console.log('\n📝 Next Steps:');
    console.log('1. Test semester upgrade functionality');
    console.log('2. Test service opt-in/opt-out');
    console.log('3. Test payment processing');
    console.log('4. Set up notification system');
    console.log('5. Configure frontend integration');

  } catch (error) {
    console.error('❌ Error setting up system:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the setup function
if (require.main === module) {
  setupCompleteSystem();
}

module.exports = setupCompleteSystem; 