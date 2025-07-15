const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('../models/user.model');
const FeeStructure = require('../models/feeStructure.model');

const createSampleFeeStructures = async () => {
  try {
    console.log('🚀 Creating Sample Fee Structures');
    console.log('================================');
    
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
    
    // Sample fee structures
    const sampleStructures = [
      {
        programName: 'B.Tech',
        branch: 'Computer Science and Engineering',
        semester: 1,
        academicSession: '2024-25',
        courseInfo: {
          category: 'Engineering',
          course_name: 'Bachelor of Technology in Computer Science and Engineering',
          duration: '4 Years',
          totalSemesters: 8
        },
        baseFees: [
          { name: 'Tuition Fee', amount: 50000, type: 'base', isRequired: true, description: 'Core academic fee' },
          { name: 'Admission Fee', amount: 10000, type: 'base', isRequired: true, description: 'One-time admission fee' },
          { name: 'Examination Fee', amount: 5000, type: 'base', isRequired: true, description: 'Per semester' },
          { name: 'Library Fee', amount: 3000, type: 'base', isRequired: true, description: 'Per semester' },
          { name: 'Lab Fee', amount: 8000, type: 'base', isRequired: false, description: 'Laboratory usage' }
        ],
        serviceFees: [
          {
            serviceType: 'hostel',
            name: 'Hostel Fee',
            amount: 25000,
            isOptional: true,
            configuration: { roomType: 'shared' },
            description: 'Accommodation charges'
          },
          {
            serviceType: 'mess',
            name: 'Mess Fee',
            amount: 15000,
            isOptional: true,
            configuration: { mealType: 'veg' },
            description: 'Food and dining charges'
          },
          {
            serviceType: 'transport',
            name: 'Transport Fee',
            amount: 8000,
            isOptional: true,
            configuration: { route: 'Route A' },
            description: 'Transportation charges'
          }
        ],
        status: 'active',
        propagationSettings: {
          autoAssignToNewStudents: true,
          notifyOnChanges: true,
          effectiveFrom: new Date('2024-01-01')
        },
        createdBy: adminUser._id
      },
      {
        programName: 'BCA',
        branch: 'Computer Applications',
        semester: 1,
        academicSession: '2024-25',
        courseInfo: {
          category: 'Computer Applications',
          course_name: 'Bachelor of Computer Applications',
          duration: '3 Years',
          totalSemesters: 6
        },
        baseFees: [
          { name: 'Tuition Fee', amount: 40000, type: 'base', isRequired: true, description: 'Core academic fee' },
          { name: 'Admission Fee', amount: 8000, type: 'base', isRequired: true, description: 'One-time admission fee' },
          { name: 'Examination Fee', amount: 4000, type: 'base', isRequired: true, description: 'Per semester' },
          { name: 'Library Fee', amount: 2500, type: 'base', isRequired: true, description: 'Per semester' }
        ],
        serviceFees: [
          {
            serviceType: 'hostel',
            name: 'Hostel Fee',
            amount: 20000,
            isOptional: true,
            configuration: { roomType: 'shared' },
            description: 'Accommodation charges'
          },
          {
            serviceType: 'mess',
            name: 'Mess Fee',
            amount: 12000,
            isOptional: true,
            configuration: { mealType: 'veg' },
            description: 'Food and dining charges'
          }
        ],
        status: 'active',
        propagationSettings: {
          autoAssignToNewStudents: true,
          notifyOnChanges: true,
          effectiveFrom: new Date('2024-01-01')
        },
        createdBy: adminUser._id
      }
    ];
    
    let createdCount = 0;
    for (const structureData of sampleStructures) {
      // Check if structure already exists
      const existingStructure = await FeeStructure.findOne({
        programName: structureData.programName,
        branch: structureData.branch,
        semester: structureData.semester,
        academicSession: structureData.academicSession
      });
      
      if (!existingStructure) {
        const feeStructure = new FeeStructure(structureData);
        await feeStructure.save();
        console.log(`✅ Created fee structure: ${structureData.programName} - ${structureData.branch} (Semester ${structureData.semester})`);
        console.log(`   💰 Total Amount: ₹${feeStructure.grandTotal.toLocaleString()}`);
        createdCount++;
      } else {
        console.log(`ℹ️  Fee structure already exists: ${structureData.programName} - ${structureData.branch} (Semester ${structureData.semester})`);
      }
    }
    
    console.log(`\n🎉 Created ${createdCount} new fee structures`);
    console.log('📋 Now run: node smartfee-backend/src/scripts/assignFees.js');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating fee structures:', error);
    process.exit(1);
  }
};

// Run if this file is executed directly
if (require.main === module) {
  createSampleFeeStructures();
}

module.exports = { createSampleFeeStructures }; 