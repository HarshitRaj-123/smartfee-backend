const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  // Basic course information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 20
  },
  description: {
    type: String,
    maxlength: 500
  },
  
  // Structured course information from organized courses
  category: {
    type: String,
    required: true,
    trim: true,
    enum: ['Engineering', 'Computer Applications', 'Pharmacy', 'Hotel Management', 
           'Management', 'Commerce', 'Paramedical', 'Nursing', 'Law', 'Science', 
           'Education', 'Arts']
  },
  program_name: {
    type: String,
    required: true,
    trim: true
  },
  branch: {
    type: String,
    required: true,
    trim: true
  },
  course_name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300
  },
  duration: {
    type: String,
    required: true,
    trim: true
    // Format: "4 Years", "6 Months", etc.
  },
  totalSemesters: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  
  // Legacy field for backward compatibility
  department: {
    type: String,
    trim: true
  },
  
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Additional metadata
  eligibilityCriteria: {
    type: String,
    maxlength: 500
  },
  fees: {
    admissionFee: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
courseSchema.index({ code: 1 });
courseSchema.index({ category: 1, isActive: 1 });
courseSchema.index({ program_name: 1, branch: 1 });
courseSchema.index({ name: 1, isActive: 1 });
courseSchema.index({ totalSemesters: 1 });

// Virtual for display name
courseSchema.virtual('displayName').get(function() {
  return `${this.name} (${this.code})`;
});

// Virtual for full course name
courseSchema.virtual('fullCourseName').get(function() {
  return `${this.program_name} in ${this.branch}`;
});

// Static method to get active courses
courseSchema.statics.getActiveCourses = function(category = null) {
  const query = { isActive: true };
  if (category) query.category = category;
  return this.find(query).sort({ category: 1, program_name: 1, branch: 1 });
};

// Static method to get courses by category
courseSchema.statics.getCoursesByCategory = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    { 
      $group: {
        _id: '$category',
        courses: { 
          $push: {
            _id: '$_id',
            name: '$name',
            code: '$code',
            program_name: '$program_name',
            branch: '$branch',
            course_name: '$course_name',
            duration: '$duration',
            totalSemesters: '$totalSemesters'
          }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Static method to get courses by duration/semesters
courseSchema.statics.getCoursesBySemesters = function(semesters) {
  return this.find({ 
    totalSemesters: semesters,
    isActive: true 
  }).sort({ category: 1, program_name: 1 });
};

module.exports = mongoose.model('Course', courseSchema);