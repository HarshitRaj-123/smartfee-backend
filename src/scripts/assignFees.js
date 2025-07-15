const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/user.model');
const FeeStructure = require('../models/feeStructure.model');
const StudentFee = require('../models/studentFee.model');
const Course = require('../models/course.model');
const FeeTemplate = require('../models/feeTemplate.model');
const FeeCategory = require('../models/feeCategory.model');

// Function to create student fee record
const createStudentFeeRecord = async (studentId, feeStructure, createdBy) => {
  try {
    // Check if StudentFee already exists
    const existingFee = await StudentFee.findOne({
      studentId,
      semester: feeStructure.semester,
      academicYear: feeStructure.academicSession
    });

    if (existingFee) {
      return existingFee;
    }

    // Find course by program name and branch
    const course = await Course.findOne({
      program_name: feeStructure.programName,
      branch: feeStructure.branch
    });

    // Find or create a default fee category
    let defaultCategory = await FeeCategory.findOne({ name: 'General Fee' });
    
    if (!defaultCategory) {
      defaultCategory = new FeeCategory({
        name: 'General Fee',
        type: 'base',
        description: 'General fee category for student fees',
        meta: { mandatory: true, refundable: false },
        createdBy: createdBy
      });
      await defaultCategory.save();
    }

    // Compose feeItems for the template
    const templateFeeItems = [
      ...feeStructure.baseFees.map(fee => ({
        categoryId: defaultCategory._id,
        name: fee.name,
        amount: fee.amount,
        meta: fee.metadata || {},
        isOptional: false
      })),
      ...feeStructure.serviceFees.map(fee => ({
        categoryId: defaultCategory._id,
        name: fee.name,
        amount: fee.amount,
        meta: fee.configuration || {},
        isOptional: fee.isOptional || false
      }))
    ];

    // Find or create a fee template
    let template = await FeeTemplate.findOne({
      courseId: course ? course._id : undefined,
      semester: feeStructure.semester,
      academicYear: feeStructure.academicSession
    });

    if (!template) {
      template = new FeeTemplate({
        templateName: `${feeStructure.programName} ${feeStructure.branch} Semester ${feeStructure.semester}`,
        courseId: course ? course._id : undefined,
        semester: feeStructure.semester,
        academicYear: feeStructure.academicSession,
        feeItems: templateFeeItems,
        createdBy: createdBy
      });
      await template.save();
    }

    // Create fee items for StudentFee
    const feeItems = templateFeeItems.map(item => ({
      categoryId: item.categoryId,
      name: item.name,
      originalAmount: item.amount,
      paid: 0,
      status: 'unpaid',
      meta: item.meta,
      isOptional: item.isOptional
    }));

    const studentFee = new StudentFee({
      studentId,
      courseId: course ? course._id : undefined,
      semester: feeStructure.semester,
      academicYear: feeStructure.academicSession,
      templateId: template._id,
      feeItems,
      totalDue: feeStructure.grandTotal,
      generatedBy: createdBy
    });

    return await studentFee.save();
  } catch (error) {
    console.error('Error creating student fee record:', error);
    throw error;
  }
};

// Main assignment function
const assignFeeStructuresToAllEligibleStudents = async (adminUserId = null) => {
  try {
    let totalAssigned = 0;
    let totalSkipped = 0;
    
    console.log('🔍 Finding all active fee structures...');
    const allStructures = await FeeStructure.find({ status: 'active' });
    console.log(`📋 Found ${allStructures.length} active fee structures`);
    
    for (const feeStructure of allStructures) {
      console.log(`\n📊 Processing: ${feeStructure.programName} - ${feeStructure.branch} (Semester ${feeStructure.semester})`);
      
      const effectiveFrom = feeStructure.propagationSettings?.effectiveFrom || feeStructure.createdAt;
      console.log(`📅 Effective from: ${effectiveFrom.toDateString()}`);
      
      const students = await User.find({
        role: 'student',
        'courseInfo.program_name': feeStructure.programName,
        'courseInfo.branch': feeStructure.branch,
        currentSemester: feeStructure.semester,
        academicYear: feeStructure.academicSession,
        isActive: true
      });
      
      console.log(`👥 Found ${students.length} eligible students`);
      
      for (const student of students) {
        const existingFee = await StudentFee.findOne({
          studentId: student._id,
          semester: feeStructure.semester,
          academicYear: feeStructure.academicSession
        });
        
        if (!existingFee) {
          console.log(`   ✅ Assigning to: ${student.firstName} ${student.lastName} (${student.studentId})`);
          await feeStructure.assignToStudents([student._id], adminUserId || feeStructure.createdBy);
          await createStudentFeeRecord(student._id, feeStructure, adminUserId || feeStructure.createdBy);
          totalAssigned++;
        } else {
          console.log(`   ⏭️  Skipping: ${student.firstName} ${student.lastName} (${student.studentId}) - already has fee record`);
          totalSkipped++;
        }
      }
    }
    
    return { totalAssigned, totalSkipped };
  } catch (error) {
    console.error('❌ Error in assignment process:', error);
    throw error;
  }
};

// Script execution
const runAssignment = async () => {
  try {
    console.log('🚀 Starting Fee Structure Assignment Script');
    console.log('==========================================');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find admin user
    const adminUser = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }
    console.log(`👤 Using admin: ${adminUser.firstName} ${adminUser.lastName}`);
    
    // Run assignment
    const result = await assignFeeStructuresToAllEligibleStudents(adminUser._id);
    
    console.log('\n🎉 ASSIGNMENT COMPLETE!');
    console.log('======================');
    console.log(`✅ Total Assigned: ${result.totalAssigned}`);
    console.log(`⏭️  Total Skipped: ${result.totalSkipped}`);
    console.log(`📊 Total Processed: ${result.totalAssigned + result.totalSkipped}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
};

// Run if this file is executed directly
if (require.main === module) {
  runAssignment();
}

module.exports = { assignFeeStructuresToAllEligibleStudents }; 