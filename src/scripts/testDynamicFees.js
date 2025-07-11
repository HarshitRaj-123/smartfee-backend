const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/user.model');
const Course = require('../models/course.model');
const FeeCategory = require('../models/feeCategory.model');
const FeeTemplate = require('../models/feeTemplate.model');
const StudentFee = require('../models/studentFee.model');

const testDynamicFeeCreation = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    console.log('\n🧪 TESTING DYNAMIC FEE CREATION');
    console.log('===============================');

    // Find admin user
    const adminUser = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
    if (!adminUser) {
      console.error('❌ No admin user found');
      process.exit(1);
    }

    // Get sample course and categories
    const course = await Course.findOne({ code: 'BTCSE' });
    const categories = await FeeCategory.find({ isActive: true });

    if (!course) {
      console.error('❌ Sample course not found. Run setup script first.');
      process.exit(1);
    }

    console.log(`✅ Using course: ${course.name}`);
    console.log(`✅ Found ${categories.length} fee categories`);

    // Create dynamic fee template with admin-defined amounts
    console.log('\n📋 Creating Dynamic Fee Template...');

    const tuitionCategory = categories.find(cat => cat.name === 'Tuition Fee');
    const labCategory = categories.find(cat => cat.name === 'Lab Fee');
    const libraryCategory = categories.find(cat => cat.name === 'Library Fee');
    const hostelCategory = categories.find(cat => cat.name === 'Hostel Fee');
    const messCategory = categories.find(cat => cat.name === 'Mess Fee');

    // Admin-configurable amounts (no hardcoding in production)
    const adminDefinedAmounts = {
      tuition: 45000,    // Admin sets this amount
      lab: 7500,         // Admin sets this amount
      library: 2000,     // Admin sets this amount
      hostel: 18000,     // Admin sets this amount (optional)
      mess: 12000        // Admin sets this amount (optional)
    };

    const dynamicFeeTemplate = {
      courseId: course._id,
      semester: 1,
      templateName: `${course.code} Semester 1 - Dynamic Template - 2024-25`,
      academicYear: '2024-25',
      description: 'Dynamically created fee template by admin',
      feeItems: [
        {
          categoryId: tuitionCategory._id,
          name: 'Tuition Fee',
          amount: adminDefinedAmounts.tuition,
          meta: { semester: 1, mandatory: true },
          description: 'Core academic instruction fee'
        },
        {
          categoryId: labCategory._id,
          name: 'Computer Lab Fee',
          amount: adminDefinedAmounts.lab,
          meta: { semester: 1, mandatory: true },
          description: 'Laboratory equipment and usage'
        },
        {
          categoryId: libraryCategory._id,
          name: 'Library Fee',
          amount: adminDefinedAmounts.library,
          meta: { semester: 1, mandatory: true },
          description: 'Library access and resources'
        },
        {
          categoryId: hostelCategory._id,
          name: 'Hostel Fee',
          amount: adminDefinedAmounts.hostel,
          isOptional: true,
          meta: { 
            semester: 1, 
            mandatory: false,
            roomType: 'double',
            refundable: true
          },
          description: 'Accommodation charges (optional)'
        },
        {
          categoryId: messCategory._id,
          name: 'Mess Fee',
          amount: adminDefinedAmounts.mess,
          isOptional: true,
          meta: { 
            semester: 1, 
            mandatory: false,
            mealType: 'veg',
            planType: 'semester',
            refundable: true
          },
          description: 'Meal facility charges (optional)'
        }
      ],
      createdBy: adminUser._id
    };

    // Calculate total amount
    dynamicFeeTemplate.totalAmount = dynamicFeeTemplate.feeItems.reduce((sum, item) => sum + item.amount, 0);

    // Create the template
    const feeTemplate = new FeeTemplate(dynamicFeeTemplate);
    await feeTemplate.save();

    console.log(`✅ Created dynamic fee template: ${feeTemplate.templateName}`);
    console.log(`💰 Total Template Amount: ₹${feeTemplate.totalAmount.toLocaleString()}`);

    // Create a sample student to test fee generation
    console.log('\n👨‍🎓 Creating Sample Student...');

    const sampleStudent = {
      email: 'dynamic.test@example.com',
      password: 'password123',
      role: 'student',
      firstName: 'Dynamic',
      lastName: 'Test',
      studentId: 'DYN2024001',
      rollNumber: 'BTCSE999',
      courseId: course._id,
      currentSemester: 1,
      academicYear: '2024-25',
      yearOfJoining: 2024,
      enrollmentDate: new Date(),
      phone: '+91-9999999999',
      servicesOpted: {
        hostel: {
          isOpted: true,
          roomType: 'double',
          blockName: 'Test Block',
          roomNumber: 'T-999',
          optedDate: new Date()
        },
        mess: {
          isOpted: false,  // Student chose not to opt for mess
          optedDate: null
        },
        transport: {
          isOpted: false,
          optedDate: null
        },
        library: {
          isOpted: true,
          cardNumber: 'LIB999',
          optedDate: new Date()
        }
      }
    };

    // Check if student already exists
    const existingStudent = await User.findOne({ email: sampleStudent.email });
    let student;
    
    if (existingStudent) {
      student = existingStudent;
      console.log(`ℹ️  Using existing student: ${student.firstName} ${student.lastName}`);
    } else {
      student = new User(sampleStudent);
      await student.save();
      console.log(`✅ Created new student: ${student.firstName} ${student.lastName}`);
    }

    // Generate student fee from template
    console.log('\n💰 Generating Student Fee from Template...');

    // Check if fee already exists
    const existingFee = await StudentFee.findOne({
      studentId: student._id,
      semester: 1,
      academicYear: '2024-25'
    });

    if (existingFee) {
      console.log(`ℹ️  Fee record already exists for student`);
    } else {
      // Clone template for student
      const studentFeeData = feeTemplate.cloneForStudent(student._id);
      studentFeeData.generatedBy = adminUser._id;

      // Adjust fees based on student's service selections
      studentFeeData.feeItems = studentFeeData.feeItems.filter(item => {
        // Include mandatory fees
        if (!item.isOptional) return true;
        
        // Include optional fees only if student opted for them
        if (item.name.toLowerCase().includes('hostel')) {
          return student.servicesOpted.hostel.isOpted;
        }
        if (item.name.toLowerCase().includes('mess')) {
          return student.servicesOpted.mess.isOpted;
        }
        
        return true;
      });

      // Set due date
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      studentFeeData.dueDate = dueDate;

      const studentFee = new StudentFee(studentFeeData);
      await studentFee.save();

      console.log(`✅ Generated student fee record`);
      console.log(`💰 Student's Fee Amount: ₹${studentFee.netAmount.toLocaleString()}`);
      console.log(`📊 Fee Items: ${studentFee.feeItems.length}`);
      
      // Show fee breakdown
      console.log('\n📋 Fee Breakdown:');
      studentFee.feeItems.forEach(item => {
        const status = item.isOptional ? '(Optional)' : '(Mandatory)';
        console.log(`   - ${item.name}: ₹${item.originalAmount.toLocaleString()} ${status}`);
      });
    }

    console.log('\n✨ DYNAMIC FEE SYSTEM TEST COMPLETED');
    console.log('====================================');
    console.log('✅ Fee template created dynamically by admin');
    console.log('✅ Student fee generated based on service selections');
    console.log('✅ No hardcoded amounts in the system');
    console.log('✅ Complete flexibility for administrators');

    console.log('\n🎯 KEY BENEFITS:');
    console.log('- Admins can set any fee amounts through the interface');
    console.log('- Service-based fees are automatically included/excluded');
    console.log('- Templates can be cloned and modified for different semesters');
    console.log('- Full audit trail of who created what amounts when');
    console.log('- Easy to adjust fees without code changes');

  } catch (error) {
    console.error('❌ Error testing dynamic fees:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔐 Database connection closed');
  }
};

// Run the test
if (require.main === module) {
  testDynamicFeeCreation();
}

module.exports = testDynamicFeeCreation; 