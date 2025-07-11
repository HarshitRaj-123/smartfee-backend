const mongoose = require('mongoose');
require('dotenv').config();

const FeeCategory = require('../models/feeCategory.model');
const FeeTemplate = require('../models/feeTemplate.model');
const Course = require('../models/course.model');
const User = require('../models/user.model');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedFeeCategories = async (adminId) => {
  console.log('Creating fee categories...');
  
  const categories = [
    {
      name: 'Tuition Fee',
      type: 'base',
      description: 'Basic tuition fee for academic instruction',
      createdBy: adminId
    },
    {
      name: 'Lab Fee',
      type: 'base',
      description: 'Laboratory usage and equipment fee',
      createdBy: adminId
    },
    {
      name: 'Library Fee',
      type: 'service',
      description: 'Library access and book lending fee',
      createdBy: adminId
    },
    {
      name: 'Sports Fee',
      type: 'service',
      description: 'Sports facilities and activities fee',
      createdBy: adminId
    },
    {
      name: 'Transport Fee',
      type: 'service',
      meta: { requiresRoute: true, hasVariableAmount: true },
      description: 'Bus transportation service fee',
      createdBy: adminId
    },
    {
      name: 'Hostel Fee',
      type: 'service',
      meta: { requiresRoomType: true, hasVariableAmount: true },
      description: 'Hostel accommodation fee',
      createdBy: adminId
    },
    {
      name: 'Late Fee',
      type: 'fine',
      description: 'Penalty for late payment',
      createdBy: adminId
    },
    {
      name: 'Exam Fee',
      type: 'misc',
      description: 'Examination and evaluation fee',
      createdBy: adminId
    },
    {
      name: 'Development Fee',
      type: 'misc',
      description: 'Infrastructure development fee',
      createdBy: adminId
    },
    {
      name: 'Internet Fee',
      type: 'service',
      description: 'WiFi and internet access fee',
      createdBy: adminId
    }
  ];
  
  // Clear existing categories
  await FeeCategory.deleteMany({});
  
  const createdCategories = await FeeCategory.insertMany(categories);
  console.log(`Created ${createdCategories.length} fee categories`);
  
  return createdCategories;
};

const seedCourses = async (adminId) => {
  console.log('Creating courses...');
  
  const courses = [
    {
      name: 'Bachelor of Technology in Computer Science',
      code: 'BTCS',
      description: 'Four-year undergraduate program in Computer Science',
      duration: 8, // 8 semesters
      department: 'Computer Science',
      createdBy: adminId
    },
    {
      name: 'Bachelor of Technology in Mechanical Engineering',
      code: 'BTME', 
      description: 'Four-year undergraduate program in Mechanical Engineering',
      duration: 8,
      department: 'Mechanical Engineering',
      createdBy: adminId
    },
    {
      name: 'Master of Business Administration',
      code: 'MBA',
      description: 'Two-year postgraduate program in Business Administration',
      duration: 4, // 4 semesters
      department: 'Management',
      createdBy: adminId
    }
  ];
  
  // Clear existing courses
  await Course.deleteMany({});
  
  const createdCourses = await Course.insertMany(courses);
  console.log(`Created ${createdCourses.length} courses`);
  
  return createdCourses;
};

const seedFeeTemplates = async (categories, courses, adminId) => {
  console.log('Creating fee templates...');
  
  // Get category IDs by name for easy reference
  const getCategoryId = (name) => categories.find(cat => cat.name === name)._id;
  
  const templates = [
    {
      courseId: courses.find(c => c.code === 'BTCS')._id,
      semester: 1,
      templateName: 'BTCS Semester 1 Fee Structure',
      academicYear: '2024-25',
      feeItems: [
        {
          categoryId: getCategoryId('Tuition Fee'),
          name: 'Tuition Fee',
          amount: 50000
        },
        {
          categoryId: getCategoryId('Lab Fee'),
          name: 'Computer Lab Fee',
          amount: 8000
        },
        {
          categoryId: getCategoryId('Library Fee'),
          name: 'Library Fee',
          amount: 2000
        },
        {
          categoryId: getCategoryId('Sports Fee'),
          name: 'Sports Fee',
          amount: 1500
        },
        {
          categoryId: getCategoryId('Development Fee'),
          name: 'Development Fee',
          amount: 5000
        },
        {
          categoryId: getCategoryId('Exam Fee'),
          name: 'Exam Fee',
          amount: 3000
        },
        {
          categoryId: getCategoryId('Internet Fee'),
          name: 'Internet & WiFi Fee',
          amount: 1000
        }
      ],
      createdBy: adminId
    },
    {
      courseId: courses.find(c => c.code === 'BTME')._id,
      semester: 1,
      templateName: 'BTME Semester 1 Fee Structure',
      academicYear: '2024-25',
      feeItems: [
        {
          categoryId: getCategoryId('Tuition Fee'),
          name: 'Tuition Fee',
          amount: 45000
        },
        {
          categoryId: getCategoryId('Lab Fee'),
          name: 'Engineering Lab Fee',
          amount: 12000
        },
        {
          categoryId: getCategoryId('Library Fee'),
          name: 'Library Fee',
          amount: 2000
        },
        {
          categoryId: getCategoryId('Sports Fee'),
          name: 'Sports Fee',
          amount: 1500
        },
        {
          categoryId: getCategoryId('Development Fee'),
          name: 'Development Fee',
          amount: 5000
        },
        {
          categoryId: getCategoryId('Exam Fee'),
          name: 'Exam Fee',
          amount: 3000
        }
      ],
      createdBy: adminId
    },
    {
      courseId: courses.find(c => c.code === 'MBA')._id,
      semester: 1,
      templateName: 'MBA Semester 1 Fee Structure',
      academicYear: '2024-25',
      feeItems: [
        {
          categoryId: getCategoryId('Tuition Fee'),
          name: 'Tuition Fee',
          amount: 75000
        },
        {
          categoryId: getCategoryId('Library Fee'),
          name: 'Library Fee',
          amount: 3000
        },
        {
          categoryId: getCategoryId('Development Fee'),
          name: 'Development Fee',
          amount: 8000
        },
        {
          categoryId: getCategoryId('Exam Fee'),
          name: 'Exam Fee',
          amount: 4000
        },
        {
          categoryId: getCategoryId('Internet Fee'),
          name: 'Internet & WiFi Fee',
          amount: 1500
        }
      ],
      createdBy: adminId
    }
  ];
  
  // Clear existing templates
  await FeeTemplate.deleteMany({});
  
  const createdTemplates = await FeeTemplate.insertMany(templates);
  console.log(`Created ${createdTemplates.length} fee templates`);
  
  return createdTemplates;
};

const main = async () => {
  try {
    await connectDB();
    
    // Find an admin user
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('No admin user found. Please create an admin user first.');
      process.exit(1);
    }
    
    console.log(`Using admin: ${admin.firstName} ${admin.lastName} (${admin.email})`);
    
    // Seed data
    const categories = await seedFeeCategories(admin._id);
    const courses = await seedCourses(admin._id);
    const templates = await seedFeeTemplates(categories, courses, admin._id);
    
    console.log('\n=== Seeding Complete ===');
    console.log(`✓ ${categories.length} Fee Categories`);
    console.log(`✓ ${courses.length} Courses`);
    console.log(`✓ ${templates.length} Fee Templates`);
    
    console.log('\n=== Sample API Endpoints ===');
    console.log('GET /api/fee-categories - Get all fee categories');
    console.log('GET /api/fee-templates - Get all fee templates');
    console.log('POST /api/student-fees/generate - Generate student fee from template');
    console.log('POST /api/payments - Record a payment');
    
    console.log('\n=== Next Steps ===');
    console.log('1. Use POST /api/student-fees/generate to create student fees');
    console.log('2. Use POST /api/payments to record payments');
    console.log('3. Test the dynamic fee management system!');
    
  } catch (error) {
    console.error('Error seeding fee system:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

main(); 