const FeeTemplate = require('../models/feeTemplate.model');
const FeeCategory = require('../models/feeCategory.model');
const Course = require('../models/course.model');
const StudentFee = require('../models/studentFee.model');

// Create new fee template
const createFeeTemplate = async (req, res) => {
  try {
    const { 
      courseId, 
      semester, 
      templateName, 
      feeItems, 
      academicYear, 
      description 
    } = req.body;

    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Validate semester is within course limits
    if (semester < 1 || semester > course.totalSemesters) {
      return res.status(400).json({
        success: false,
        message: `Semester must be between 1 and ${course.totalSemesters} for this course`
      });
    }

    // Check if template already exists for this course-semester-year
    const existingTemplate = await FeeTemplate.findOne({
      courseId,
      semester,
      academicYear,
      isActive: true
    });

    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Fee template already exists for this course, semester, and academic year'
      });
    }

    // Validate fee items and categories
    const validatedFeeItems = [];
    for (const item of feeItems) {
      const category = await FeeCategory.findById(item.categoryId);
      if (!category || !category.isActive) {
        return res.status(400).json({
          success: false,
          message: `Invalid or inactive fee category: ${item.categoryId}`
        });
      }

      // Validate amount is positive
      if (!item.amount || item.amount < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid amount for fee item: ${item.name}`
        });
      }

      validatedFeeItems.push({
        categoryId: item.categoryId,
        name: item.name || category.name,
        amount: parseFloat(item.amount),
        meta: item.meta || {},
        isOptional: item.isOptional || false,
        description: item.description || ''
      });
    }

    // Calculate total amount
    const totalAmount = validatedFeeItems.reduce((sum, item) => sum + item.amount, 0);

    // Create fee template
    const feeTemplate = new FeeTemplate({
      courseId,
      semester,
      templateName,
      feeItems: validatedFeeItems,
      totalAmount,
      academicYear,
      description,
      createdBy: req.user.id
    });

    await feeTemplate.save();

    // Populate response
    await feeTemplate.populate([
      { path: 'courseId', select: 'name code totalSemesters' },
      { path: 'feeItems.categoryId', select: 'name type meta' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Fee template created successfully',
      data: feeTemplate
    });

  } catch (error) {
    console.error('Error creating fee template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create fee template',
      error: error.message
    });
  }
};

// Get all fee templates with filters
const getFeeTemplates = async (req, res) => {
  try {
    const { 
      courseId, 
      semester, 
      academicYear, 
      isActive = true,
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = { isTemplate: true };
    if (courseId) query.courseId = courseId;
    if (semester) query.semester = parseInt(semester);
    if (academicYear) query.academicYear = academicYear;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const templates = await FeeTemplate.find(query)
      .populate('courseId', 'name code totalSemesters category')
      .populate('feeItems.categoryId', 'name type meta')
      .populate('createdBy', 'firstName lastName')
      .sort({ courseId: 1, semester: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FeeTemplate.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching fee templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee templates',
      error: error.message
    });
  }
};

// Get single fee template by ID
const getFeeTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await FeeTemplate.findById(id)
      .populate('courseId', 'name code totalSemesters category')
      .populate('feeItems.categoryId', 'name type meta')
      .populate('createdBy', 'firstName lastName');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Fee template not found'
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Error fetching fee template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee template',
      error: error.message
    });
  }
};

// Update fee template
const updateFeeTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      templateName, 
      feeItems, 
      description,
      isActive 
    } = req.body;

    const template = await FeeTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Fee template not found'
      });
    }

    // Check if template is being used by students
    const studentsUsingTemplate = await StudentFee.countDocuments({
      templateId: id
    });

    if (studentsUsingTemplate > 0 && feeItems) {
      return res.status(400).json({
        success: false,
        message: `Cannot modify fee items as ${studentsUsingTemplate} students are using this template. Create a new template instead.`
      });
    }

    // Update basic fields
    if (templateName) template.templateName = templateName;
    if (description !== undefined) template.description = description;
    if (isActive !== undefined) template.isActive = isActive;

    // Update fee items if provided and no students are using the template
    if (feeItems && studentsUsingTemplate === 0) {
      const validatedFeeItems = [];
      for (const item of feeItems) {
        const category = await FeeCategory.findById(item.categoryId);
        if (!category || !category.isActive) {
          return res.status(400).json({
            success: false,
            message: `Invalid or inactive fee category: ${item.categoryId}`
          });
        }

        if (!item.amount || item.amount < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid amount for fee item: ${item.name}`
          });
        }

        validatedFeeItems.push({
          categoryId: item.categoryId,
          name: item.name || category.name,
          amount: parseFloat(item.amount),
          meta: item.meta || {},
          isOptional: item.isOptional || false,
          description: item.description || ''
        });
      }

      template.feeItems = validatedFeeItems;
      template.totalAmount = validatedFeeItems.reduce((sum, item) => sum + item.amount, 0);
    }

    await template.save();

    // Populate response
    await template.populate([
      { path: 'courseId', select: 'name code totalSemesters' },
      { path: 'feeItems.categoryId', select: 'name type meta' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Fee template updated successfully',
      data: template
    });

  } catch (error) {
    console.error('Error updating fee template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fee template',
      error: error.message
    });
  }
};

// Delete fee template (soft delete)
const deleteFeeTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await FeeTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Fee template not found'
      });
    }

    // Check if template is being used by students
    const studentsUsingTemplate = await StudentFee.countDocuments({
      templateId: id
    });

    if (studentsUsingTemplate > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete template as ${studentsUsingTemplate} students are using it. Deactivate instead.`
      });
    }

    // Soft delete
    template.isActive = false;
    await template.save();

    res.status(200).json({
      success: true,
      message: 'Fee template deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting fee template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fee template',
      error: error.message
    });
  }
};

// Clone fee template (for creating similar templates)
const cloneFeeTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      courseId, 
      semester, 
      templateName, 
      academicYear,
      adjustments = []
    } = req.body;

    const originalTemplate = await FeeTemplate.findById(id);
    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Original template not found'
      });
    }

    // Validate new course if provided
    if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Target course not found'
        });
      }
    }

    // Check if target template already exists
    const existingTemplate = await FeeTemplate.findOne({
      courseId: courseId || originalTemplate.courseId,
      semester: semester || originalTemplate.semester,
      academicYear: academicYear || originalTemplate.academicYear,
      isActive: true
    });

    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Fee template already exists for target course, semester, and academic year'
      });
    }

    // Clone fee items with adjustments
    let clonedFeeItems = [...originalTemplate.feeItems];
    
    // Apply adjustments if provided
    for (const adjustment of adjustments) {
      const itemIndex = clonedFeeItems.findIndex(item => 
        item.categoryId.toString() === adjustment.categoryId
      );
      
      if (itemIndex !== -1) {
        if (adjustment.type === 'percentage') {
          clonedFeeItems[itemIndex].amount *= (1 + adjustment.value / 100);
        } else if (adjustment.type === 'fixed') {
          clonedFeeItems[itemIndex].amount += adjustment.value;
        } else if (adjustment.type === 'replace') {
          clonedFeeItems[itemIndex].amount = adjustment.value;
        }
        clonedFeeItems[itemIndex].amount = Math.round(clonedFeeItems[itemIndex].amount);
      }
    }

    // Calculate new total
    const totalAmount = clonedFeeItems.reduce((sum, item) => sum + item.amount, 0);

    // Create cloned template
    const clonedTemplate = new FeeTemplate({
      courseId: courseId || originalTemplate.courseId,
      semester: semester || originalTemplate.semester,
      templateName: templateName || `${originalTemplate.templateName} (Copy)`,
      feeItems: clonedFeeItems,
      totalAmount,
      academicYear: academicYear || originalTemplate.academicYear,
      description: `Cloned from: ${originalTemplate.templateName}`,
      createdBy: req.user.id
    });

    await clonedTemplate.save();

    // Populate response
    await clonedTemplate.populate([
      { path: 'courseId', select: 'name code totalSemesters' },
      { path: 'feeItems.categoryId', select: 'name type meta' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Fee template cloned successfully',
      data: clonedTemplate
    });

  } catch (error) {
    console.error('Error cloning fee template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clone fee template',
      error: error.message
    });
  }
};

// Get fee template usage statistics
const getTemplateUsageStats = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await FeeTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Fee template not found'
      });
    }

    // Get usage statistics
    const totalStudents = await StudentFee.countDocuments({ templateId: id });
    const paidStudents = await StudentFee.countDocuments({ 
      templateId: id, 
      status: 'paid' 
    });
    const partialStudents = await StudentFee.countDocuments({ 
      templateId: id, 
      status: 'partial' 
    });
    const unpaidStudents = await StudentFee.countDocuments({ 
      templateId: id, 
      status: 'unpaid' 
    });

    // Get revenue statistics
    const revenueStats = await StudentFee.aggregate([
      { $match: { templateId: template._id } },
      {
        $group: {
          _id: null,
          totalDue: { $sum: '$totalDue' },
          totalPaid: { $sum: '$totalPaid' },
          totalFines: { $sum: '$totalFines' },
          totalDiscounts: { $sum: '$totalDiscounts' }
        }
      }
    ]);

    const revenue = revenueStats[0] || {
      totalDue: 0,
      totalPaid: 0,
      totalFines: 0,
      totalDiscounts: 0
    };

    res.status(200).json({
      success: true,
      data: {
        template: {
          _id: template._id,
          templateName: template.templateName,
          courseId: template.courseId,
          semester: template.semester,
          academicYear: template.academicYear
        },
        usage: {
          totalStudents,
          paidStudents,
          partialStudents,
          unpaidStudents,
          paymentRate: totalStudents > 0 ? ((paidStudents / totalStudents) * 100).toFixed(2) : 0
        },
        revenue: {
          ...revenue,
          collectionRate: revenue.totalDue > 0 ? ((revenue.totalPaid / revenue.totalDue) * 100).toFixed(2) : 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching template usage stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage statistics',
      error: error.message
    });
  }
};

module.exports = {
  createFeeTemplate,
  getFeeTemplates,
  getFeeTemplateById,
  updateFeeTemplate,
  deleteFeeTemplate,
  cloneFeeTemplate,
  getTemplateUsageStats
}; 