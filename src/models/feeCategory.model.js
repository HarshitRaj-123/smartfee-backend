const mongoose = require('mongoose');

const feeCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['base', 'service', 'fine', 'misc', 'custom'],
    required: true,
    default: 'custom'
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
    // For special fields like roomType, route, distance, etc.
    // Example: { requiresRoute: true, hasVariableAmount: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
feeCategorySchema.index({ name: 1, isActive: 1 });
feeCategorySchema.index({ type: 1, isActive: 1 });
feeCategorySchema.index({ createdBy: 1 });

// Virtual for formatted display
feeCategorySchema.virtual('displayName').get(function() {
  return `${this.name} (${this.type})`;
});

// Static method to get active categories
feeCategorySchema.statics.getActiveCategories = function(type = null) {
  const query = { isActive: true };
  if (type) query.type = type;
  return this.find(query).sort({ name: 1 });
};

// Static method to get categories by type
feeCategorySchema.statics.getCategoriesByType = function(types = []) {
  return this.find({
    type: { $in: types },
    isActive: true
  }).sort({ type: 1, name: 1 });
};

module.exports = mongoose.model('FeeCategory', feeCategorySchema); 