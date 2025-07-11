const FeeCategory = require('../models/feeCategory.model');

// Create a new fee category
const createFeeCategory = async (req, res) => {
  try {
    const { name, type, meta, description } = req.body;
    
    // Check if category with same name already exists
    const existingCategory = await FeeCategory.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      isActive: true 
    });
    
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Fee category with this name already exists'
      });
    }
    
    const feeCategory = new FeeCategory({
      name,
      type,
      meta: meta || {},
      description,
      createdBy: req.user.id
    });
    
    await feeCategory.save();
    
    res.status(201).json({
      success: true,
      message: 'Fee category created successfully',
      data: feeCategory
    });
  } catch (error) {
    console.error('Error creating fee category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create fee category',
      error: error.message
    });
  }
};

// Get all active fee categories
const getFeeCategories = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    
    const filters = {};
    if (type) filters.type = type;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    else filters.isActive = true; // Default to active only
    
    const categories = await FeeCategory.find(filters)
      .populate('createdBy', 'firstName lastName')
      .sort({ type: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('Error fetching fee categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee categories',
      error: error.message
    });
  }
};

// Get fee category by ID
const getFeeCategoryById = async (req, res) => {
  try {
    const category = await FeeCategory.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Fee category not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Error fetching fee category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee category',
      error: error.message
    });
  }
};

// Update fee category
const updateFeeCategory = async (req, res) => {
  try {
    const { name, type, meta, description, isActive } = req.body;
    
    const category = await FeeCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Fee category not found'
      });
    }
    
    // Check if name is being changed and if new name already exists
    if (name && name !== category.name) {
      const existingCategory = await FeeCategory.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        isActive: true,
        _id: { $ne: req.params.id }
      });
      
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: 'Fee category with this name already exists'
        });
      }
    }
    
    // Update fields
    if (name !== undefined) category.name = name;
    if (type !== undefined) category.type = type;
    if (meta !== undefined) category.meta = meta;
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;
    
    await category.save();
    
    res.status(200).json({
      success: true,
      message: 'Fee category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Error updating fee category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fee category',
      error: error.message
    });
  }
};

// Delete fee category (soft delete)
const deleteFeeCategory = async (req, res) => {
  try {
    const category = await FeeCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Fee category not found'
      });
    }
    
    // Soft delete by setting isActive to false
    category.isActive = false;
    await category.save();
    
    res.status(200).json({
      success: true,
      message: 'Fee category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting fee category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fee category',
      error: error.message
    });
  }
};

// Get categories by type
const getCategoriesByType = async (req, res) => {
  try {
    const { types } = req.query;
    
    if (!types) {
      return res.status(400).json({
        success: false,
        message: 'Types parameter is required'
      });
    }
    
    const typeArray = types.split(',');
    const categories = await FeeCategory.getCategoriesByType(typeArray);
    
    res.status(200).json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error('Error fetching categories by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories by type',
      error: error.message
    });
  }
};

module.exports = {
  createFeeCategory,
  getFeeCategories,
  getFeeCategoryById,
  updateFeeCategory,
  deleteFeeCategory,
  getCategoriesByType
}; 