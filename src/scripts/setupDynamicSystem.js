const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const User = require('../models/user.model');
const Course = require('../models/course.model');
const FeeCategory = require('../models/feeCategory.model');
const { assignFeeStructuresToAllEligibleStudents } = require('../controllers/feeStructure.controller');

const setupDynamicSystem = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    console.log('\n🚀 SETTING UP DYNAMIC FEE SYSTEM (NO HARDCODED AMOUNTS)');
    console.log('=======================================================');

    // Step 1: Find admin user
    const adminUser = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }
    console.log(`✅ Found admin user: ${adminUser.firstName} ${adminUser.lastName}`);

    // Step 2: Create comprehensive course structure (without fee amounts)
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
        eligibilityCriteria: '10+2 with PCM and minimum 75% marks'
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
        eligibilityCriteria: '10+2 with minimum 60% marks'
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
        eligibilityCriteria: 'Bachelor degree with minimum 50% marks'
      },
      {
        name: 'Bachelor of Science in Information Technology',
        code: 'BSIT',
        category: 'Computer Applications',
        program_name: 'B.Sc',
        branch: 'Information Technology',
        course_name: 'Bachelor of Science in Information Technology',
        duration: '3 Years',
        totalSemesters: 6,
        department: 'Computer Applications',
        description: 'Three-year undergraduate program in Information Technology',
        createdBy: adminUser._id,
        eligibilityCriteria: '10+2 with Mathematics and minimum 60% marks'
      },
      {
        name: 'Master of Computer Applications',
        code: 'MCA',
        category: 'Computer Applications',
        program_name: 'MCA',
        branch: 'Computer Applications',
        course_name: 'Master of Computer Applications',
        duration: '2 Years',
        totalSemesters: 4,
        department: 'Computer Applications',
        description: 'Two-year postgraduate program in Computer Applications',
        createdBy: adminUser._id,
        eligibilityCriteria: 'Bachelor degree with Mathematics and minimum 50% marks'
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

    // Step 3: Create comprehensive fee categories (without amounts)
    console.log('\n💰 Creating comprehensive fee categories...');
    
    const feeCategories = [
      {
        name: 'Tuition Fee',
        type: 'base',
        description: 'Basic tuition fee for academic instruction',
        meta: { 
          mandatory: true, 
          refundable: false,
          calculationType: 'fixed',
          applicableToAll: true
        },
        createdBy: adminUser._id
      },
      {
        name: 'Lab Fee',
        type: 'service',
        description: 'Laboratory usage and equipment fee',
        meta: { 
          mandatory: true, 
          refundable: false,
          calculationType: 'fixed',
          applicableCourses: ['Engineering', 'Computer Applications']
        },
        createdBy: adminUser._id
      },
      {
        name: 'Library Fee',
        type: 'service',
        description: 'Library access and book usage fee',
        meta: { 
          mandatory: true, 
          refundable: false,
          calculationType: 'fixed',
          applicableToAll: true
        },
        createdBy: adminUser._id
      },
      {
        name: 'Hostel Fee',
        type: 'service',
        description: 'Accommodation charges for hostel residents',
        meta: { 
          mandatory: false, 
          refundable: true, 
          calculationType: 'variable',
          roomTypes: ['single', 'double', 'triple', 'ac', 'non-ac'],
          variableFactors: ['roomType', 'blockType', 'floorLevel']
        },
        createdBy: adminUser._id
      },
      {
        name: 'Mess Fee',
        type: 'service',
        description: 'Meal charges for mess facility',
        meta: { 
          mandatory: false, 
          refundable: true, 
          calculationType: 'variable',
          mealTypes: ['veg', 'non-veg', 'both'],
          planTypes: ['monthly', 'semester', 'annual'],
          variableFactors: ['mealType', 'planType']
        },
        createdBy: adminUser._id
      },
      {
        name: 'Transport Fee',
        type: 'service',
        description: 'Transportation facility charges',
        meta: { 
          mandatory: false, 
          refundable: true, 
          calculationType: 'variable',
          routes: ['Route A', 'Route B', 'Route C', 'Route D'],
          variableFactors: ['route', 'distance', 'vehicleType']
        },
        createdBy: adminUser._id
      },
      {
        name: 'Sports Fee',
        type: 'service',
        description: 'Sports facility and equipment usage fee',
        meta: { 
          mandatory: true, 
          refundable: false,
          calculationType: 'fixed',
          applicableToAll: true
        },
        createdBy: adminUser._id
      },
      {
        name: 'Exam Fee',
        type: 'base',
        description: 'Examination and evaluation charges',
        meta: { 
          mandatory: true, 
          refundable: false,
          calculationType: 'fixed',
          applicableToAll: true
        },
        createdBy: adminUser._id
      },
      {
        name: 'Development Fee',
        type: 'misc',
        description: 'Infrastructure development and maintenance fee',
        meta: { 
          mandatory: true, 
          refundable: false,
          calculationType: 'fixed',
          applicableToAll: true
        },
        createdBy: adminUser._id
      },
      {
        name: 'Internet Fee',
        type: 'service',
        description: 'WiFi and internet access fee',
        meta: { 
          mandatory: false, 
          refundable: false,
          calculationType: 'fixed',
          applicableToAll: true
        },
        createdBy: adminUser._id
      },
      {
        name: 'Late Fee',
        type: 'fine',
        description: 'Penalty for late payment of fees',
        meta: { 
          mandatory: false, 
          refundable: false,
          calculationType: 'percentage',
          basePercentage: 2,
          maxAmount: 5000
        },
        createdBy: adminUser._id
      },
      {
        name: 'Security Deposit',
        type: 'misc',
        description: 'Refundable security deposit',
        meta: { 
          mandatory: true, 
          refundable: true,
          calculationType: 'fixed',
          applicableToAll: true,
          refundConditions: 'On course completion or withdrawal'
        },
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
        console.log(`   ✅ Created fee category: ${category.name} (${category.type})`);
      } else {
        createdCategories.push(existingCategory);
        console.log(`   ℹ️  Fee category already exists: ${existingCategory.name}`);
      }
    }

    // Step 4: System setup completion summary
    console.log('\n📊 SYSTEM SETUP SUMMARY');
    console.log('========================');
    console.log(`✅ Courses created: ${createdCourses.length}`);
    console.log(`✅ Fee categories created: ${createdCategories.length}`);
    console.log('\n🎯 NEXT STEPS FOR ADMINS:');
    console.log('==========================');
    console.log('1. 📋 Create Fee Templates:');
    console.log('   - Use POST /api/fee-templates to create templates for each course-semester');
    console.log('   - Define actual amounts for each fee category');
    console.log('   - Set optional services (hostel, mess, transport) with variable pricing');
    console.log('');
    console.log('2. 👥 Add Students:');
    console.log('   - Use POST /api/users to create student accounts');
    console.log('   - Assign courses and current semesters');
    console.log('   - Configure service preferences');
    console.log('');
    console.log('3. 💰 Generate Student Fees:');
    console.log('   - Use POST /api/student-fees/generate to create fee records');
    console.log('   - Templates will be cloned and customized per student');
    console.log('   - Service-based fees will be added/removed automatically');
    console.log('');
    console.log('4. 🔄 Manage Semester Upgrades:');
    console.log('   - Use POST /api/semester-upgrade/single or /bulk for upgrades');
    console.log('   - New fee templates will be applied automatically');
    console.log('   - Service changes can be handled during upgrade');
    console.log('');
    console.log('🌟 ADMIN INTERFACE ENDPOINTS:');
    console.log('==============================');
    console.log('Fee Templates: /api/fee-templates (GET, POST, PUT, DELETE)');
    console.log('Fee Categories: /api/fee-categories (GET, POST, PUT, DELETE)');
    console.log('Student Fees: /api/student-fees (GET, POST, PUT)');
    console.log('Semester Upgrade: /api/semester-upgrade (POST)');
    console.log('Service Management: /api/service-management (GET, POST, PUT)');
    console.log('');
    console.log('📋 SAMPLE FEE TEMPLATE CREATION:');
    console.log('=================================');
    console.log('POST /api/fee-templates');
    console.log(JSON.stringify({
      courseId: "COURSE_ID_HERE",
      semester: 1,
      templateName: "BTCSE Semester 1 - 2024-25",
      academicYear: "2024-25",
      feeItems: [
        {
          categoryId: "TUITION_CATEGORY_ID",
          name: "Tuition Fee",
          amount: 50000,
          meta: { semester: 1, mandatory: true }
        },
        {
          categoryId: "LAB_CATEGORY_ID", 
          name: "Lab Fee",
          amount: 8000,
          meta: { semester: 1, mandatory: true }
        },
        {
          categoryId: "HOSTEL_CATEGORY_ID",
          name: "Hostel Fee", 
          amount: 15000,
          isOptional: true,
          meta: { roomType: "double", refundable: true }
        }
      ]
    }, null, 2));

    console.log('\n✨ DYNAMIC FEE SYSTEM READY!');
    console.log('All fee amounts are now configurable by admins through the API.');
    console.log('No hardcoded amounts exist in the system.');

  } catch (error) {
    console.error('❌ Error setting up dynamic system:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
  }
};

async function assignAllFeesScript() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  const adminUser = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
  if (!adminUser) {
    console.error('No admin user found.');
    process.exit(1);
  }
  const result = await assignFeeStructuresToAllEligibleStudents(adminUser._id);
  console.log(`Fee assignment complete. Assigned: ${result.totalAssigned}, Skipped: ${result.totalSkipped}`);
  process.exit(0);
}

// Run the setup
if (require.main === module) {
  setupDynamicSystem();
}

if (require.main === module && process.argv.includes('--assign-fees')) {
  assignAllFeesScript();
}

module.exports = setupDynamicSystem;
