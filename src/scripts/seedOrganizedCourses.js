const mongoose = require('mongoose');
require('dotenv').config();

const Course = require('../models/course.model');
const User = require('../models/user.model');

// Import organized courses data
const organizedCourses = [
  // ENGINEERING COURSES
  {
    category: "Engineering",
    program_name: "B.Tech",
    branch: "Computer Science and Engineering",
    course_name: "Bachelor of Technology in Computer Science and Engineering",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Engineering",
    program_name: "B.Tech",
    branch: "Artificial Intelligence",
    course_name: "Bachelor of Technology in Artificial Intelligence",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Engineering",
    program_name: "B.Tech",
    branch: "Mechanical Engineering",
    course_name: "Bachelor of Technology in Mechanical Engineering",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Engineering",
    program_name: "B.Tech",
    branch: "Civil Engineering",
    course_name: "Bachelor of Technology in Civil Engineering",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Engineering",
    program_name: "B.Tech",
    branch: "Electronics & Communication Engineering",
    course_name: "Bachelor of Technology in Electronics & Communication Engineering",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Engineering",
    program_name: "B.Tech",
    branch: "Electrical Engineering",
    course_name: "Bachelor of Technology in Electrical Engineering",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Engineering",
    program_name: "M.Tech",
    branch: "Computer Science and Engineering",
    course_name: "Master of Technology in Computer Science and Engineering",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Engineering",
    program_name: "M.Tech",
    branch: "Electronics & Communication Engineering",
    course_name: "Master of Technology in Electronics & Communication Engineering",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Engineering",
    program_name: "M.Tech",
    branch: "Civil Engineering",
    course_name: "Master of Technology in Civil Engineering",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Engineering",
    program_name: "M.Tech",
    branch: "Mechanical Engineering",
    course_name: "Master of Technology in Mechanical Engineering",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Engineering",
    program_name: "Diploma",
    branch: "Computer Science Engineering",
    course_name: "Diploma in Computer Science Engineering",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Engineering",
    program_name: "Diploma",
    branch: "Electrical Engineering",
    course_name: "Diploma in Electrical Engineering",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Engineering",
    program_name: "Diploma",
    branch: "Mechanical Engineering",
    course_name: "Diploma in Mechanical Engineering",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Engineering",
    program_name: "Diploma",
    branch: "Civil Engineering",
    course_name: "Diploma in Civil Engineering",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Engineering",
    program_name: "ITI",
    branch: "Welding Technology",
    course_name: "Welder Certification Program",
    duration: "6 Months",
    totalSemesters: 1
  },
  {
    category: "Engineering",
    program_name: "ITI",
    branch: "Plumbing Technology",
    course_name: "Plumbing Certification Program",
    duration: "6 Months",
    totalSemesters: 1
  },
  {
    category: "Engineering",
    program_name: "ITI",
    branch: "Computer Operations",
    course_name: "Computer Operator and Programming Assistant",
    duration: "1 Year",
    totalSemesters: 2
  },

  // COMPUTER APPLICATIONS
  {
    category: "Computer Applications",
    program_name: "MCA",
    branch: "Computer Applications",
    course_name: "Master of Computer Applications",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Computer Applications",
    program_name: "BCA",
    branch: "Computer Applications",
    course_name: "Bachelor of Computer Applications",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Computer Applications",
    program_name: "PGDCA",
    branch: "Computer Applications",
    course_name: "Post Graduate Diploma in Computer Applications",
    duration: "1 Year",
    totalSemesters: 2
  },
  {
    category: "Computer Applications",
    program_name: "B.Sc",
    branch: "Information Technology",
    course_name: "Bachelor of Science in Information Technology",
    duration: "3 Years",
    totalSemesters: 6
  },

  // PHARMACY
  {
    category: "Pharmacy",
    program_name: "B.Pharm",
    branch: "Pharmacy",
    course_name: "Bachelor of Pharmacy",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Pharmacy",
    program_name: "M.Pharm",
    branch: "Pharmacy",
    course_name: "Master of Pharmacy",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Pharmacy",
    program_name: "Diploma",
    branch: "Pharmacy",
    course_name: "Diploma in Pharmacy",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Pharmacy",
    program_name: "Pharm.D",
    branch: "Doctor of Pharmacy",
    course_name: "Doctor of Pharmacy",
    duration: "6 Years",
    totalSemesters: 12
  },

  // HOTEL MANAGEMENT
  {
    category: "Hotel Management",
    program_name: "BHMCT",
    branch: "Hotel Management and Catering Technology",
    course_name: "Bachelor of Hotel Management and Catering Technology",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Hotel Management",
    program_name: "MHMCT",
    branch: "Hotel Management & Catering Technology",
    course_name: "Master of Hotel Management & Catering Technology",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Hotel Management",
    program_name: "B.Voc",
    branch: "Hospitality and Catering Management",
    course_name: "Bachelor of Vocation in Hospitality and Catering Management",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Hotel Management",
    program_name: "B.Sc",
    branch: "Nutrition and Dietetics",
    course_name: "Bachelor of Science in Nutrition and Dietetics",
    duration: "4 Years",
    totalSemesters: 8
  },

  // MANAGEMENT & COMMERCE
  {
    category: "Management",
    program_name: "MBA",
    branch: "Business Administration",
    course_name: "Master of Business Administration",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Management",
    program_name: "BBA",
    branch: "Business Administration",
    course_name: "Bachelor of Business Administration",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Commerce",
    program_name: "B.Com",
    branch: "Commerce Honours",
    course_name: "Bachelor of Commerce Honours",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Commerce",
    program_name: "M.Com",
    branch: "Commerce",
    course_name: "Master of Commerce",
    duration: "2 Years",
    totalSemesters: 4
  },

  // PARAMEDICAL
  {
    category: "Paramedical",
    program_name: "M.Sc",
    branch: "Medical Laboratory Science - Clinical Biochemistry",
    course_name: "Master of Science in Medical Laboratory Science - Clinical Biochemistry",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Paramedical",
    program_name: "B.Sc",
    branch: "Radio Imaging Technology",
    course_name: "Bachelor of Science in Radio Imaging Technology",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Paramedical",
    program_name: "B.Sc",
    branch: "Operation Theatre Technology",
    course_name: "Bachelor of Science in Operation Theatre Technology",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Paramedical",
    program_name: "B.Sc",
    branch: "Optometry",
    course_name: "Bachelor of Science in Optometry",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Paramedical",
    program_name: "B.Sc",
    branch: "Anesthesia",
    course_name: "Bachelor of Science in Anesthesia",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Paramedical",
    program_name: "B.Sc",
    branch: "Medical Laboratory Science",
    course_name: "Bachelor of Science in Medical Laboratory Science",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Paramedical",
    program_name: "Diploma",
    branch: "Medical Laboratory Technology",
    course_name: "Diploma in Medical Laboratory Technology",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Paramedical",
    program_name: "B.Sc",
    branch: "Cardiac Care Technology",
    course_name: "Bachelor of Science in Cardiac Care Technology",
    duration: "4 Years",
    totalSemesters: 8
  },
  {
    category: "Paramedical",
    program_name: "B.Sc",
    branch: "Physiotherapy",
    course_name: "Bachelor of Science in Physiotherapy",
    duration: "4.5 Years",
    totalSemesters: 9
  },
  {
    category: "Paramedical",
    program_name: "M.Sc",
    branch: "Cardiac Care Technology",
    course_name: "Master of Science in Cardiac Care Technology",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Paramedical",
    program_name: "M.Sc",
    branch: "Anesthesia and Operation Theatre Technology",
    course_name: "Master of Science in Anesthesia and Operation Theatre Technology",
    duration: "2 Years",
    totalSemesters: 4
  },

  // NURSING
  {
    category: "Nursing",
    program_name: "Diploma",
    branch: "Nursing",
    course_name: "Diploma in Nursing",
    duration: "2 Years",
    totalSemesters: 4
  },

  // LAW
  {
    category: "Law",
    program_name: "LL.B",
    branch: "Law",
    course_name: "Bachelor of Law",
    duration: "3 Years",
    totalSemesters: 6
  },
  {
    category: "Law",
    program_name: "BA LL.B",
    branch: "Arts and Law",
    course_name: "Bachelor of Arts and Bachelor of Law",
    duration: "5 Years",
    totalSemesters: 10
  },

  // SCIENCE
  {
    category: "Science",
    program_name: "M.Sc",
    branch: "Chemistry",
    course_name: "Master of Science in Chemistry",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Science",
    program_name: "M.Sc",
    branch: "Mathematics",
    course_name: "Master of Science in Mathematics",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Science",
    program_name: "M.Sc",
    branch: "Physics",
    course_name: "Master of Science in Physics",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Science",
    program_name: "B.Sc",
    branch: "Non-Medical",
    course_name: "Bachelor of Science in Non-Medical",
    duration: "3 Years",
    totalSemesters: 6
  },

  // EDUCATION
  {
    category: "Education",
    program_name: "M.Ed",
    branch: "Education",
    course_name: "Master of Education",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Education",
    program_name: "M.A",
    branch: "Education",
    course_name: "Master of Arts in Education",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Education",
    program_name: "B.Ed",
    branch: "Education",
    course_name: "Bachelor of Education",
    duration: "2 Years",
    totalSemesters: 4
  },
  {
    category: "Arts",
    program_name: "B.A",
    branch: "Arts",
    course_name: "Bachelor of Arts",
    duration: "3 Years",
    totalSemesters: 6
  }
];

const seedOrganizedCourses = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find an admin user to assign as creator
    const adminUser = await User.findOne({ role: { $in: ['admin', 'super_admin'] } });
    if (!adminUser) {
      console.error('No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    console.log('Starting to seed organized courses...');

    // Clear existing courses
    await Course.deleteMany({});
    console.log('Cleared existing courses');

    // Prepare courses for insertion
    const coursesToInsert = organizedCourses.map((courseData, index) => {
      // Generate course code from program_name and branch
      const programCode = courseData.program_name.replace(/[^A-Z]/g, '');
      const branchCode = courseData.branch
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 4);
      
      const code = programCode + branchCode + (index + 1).toString().padStart(2, '0');

      return {
        name: courseData.course_name,
        code: code,
        description: `${courseData.duration} program in ${courseData.branch}`,
        category: courseData.category,
        program_name: courseData.program_name,
        branch: courseData.branch,
        course_name: courseData.course_name,
        duration: courseData.duration,
        totalSemesters: courseData.totalSemesters,
        department: courseData.category, // Using category as department for compatibility
        isActive: true,
        createdBy: adminUser._id,
        eligibilityCriteria: `Standard eligibility criteria for ${courseData.program_name} programs`,
        fees: {
          admissionFee: courseData.totalSemesters * 1000, // Base calculation
          securityDeposit: 5000,
          otherCharges: 2000
        }
      };
    });

    // Insert courses in batches
    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < coursesToInsert.length; i += batchSize) {
      const batch = coursesToInsert.slice(i, i + batchSize);
      await Course.insertMany(batch);
      insertedCount += batch.length;
      console.log(`Inserted ${insertedCount}/${coursesToInsert.length} courses`);
    }

    console.log('\n=== SEEDING COMPLETED ===');
    console.log(`✅ Successfully seeded ${insertedCount} courses`);

    // Display summary by category
    const summary = await Course.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          courses: { $push: { name: '$name', code: '$code' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n=== COURSES BY CATEGORY ===');
    summary.forEach(cat => {
      console.log(`\n📚 ${cat._id}: ${cat.count} courses`);
      cat.courses.forEach(course => {
        console.log(`   - ${course.name} (${course.code})`);
      });
    });

    console.log('\n🎉 Database seeding completed successfully!');

  } catch (error) {
    console.error('Error seeding courses:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seeding function
if (require.main === module) {
  seedOrganizedCourses();
}

module.exports = seedOrganizedCourses; 