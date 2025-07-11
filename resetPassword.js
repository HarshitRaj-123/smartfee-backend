const mongoose = require('mongoose');
const User = require('./src/models/user.model');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartfee');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Reset password for a user
const resetPassword = async (email, newPassword) => {
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User with email ${email} not found`);
      return;
    }

    user.password = newPassword;
    await user.save();
    console.log(`Password reset successfully for ${email}`);
  } catch (error) {
    console.error('Error resetting password:', error);
  }
};

// Create a new user
const createUser = async (email, password, firstName, lastName, role) => {
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`User with email ${email} already exists`);
      return;
    }

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role
    });

    await user.save();
    console.log(`User created successfully: ${email} - ${firstName} ${lastName} - ${role}`);
  } catch (error) {
    console.error('Error creating user:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();

  // Get command line arguments
  const args = process.argv.slice(2);
  const action = args[0];

  if (action === 'reset') {
    const email = args[1];
    const password = args[2];
    
    if (!email || !password) {
      console.log('Usage: node resetPassword.js reset <email> <password>');
      process.exit(1);
    }
    
    await resetPassword(email, password);
  } else if (action === 'create') {
    const email = args[1];
    const password = args[2];
    const firstName = args[3];
    const lastName = args[4];
    const role = args[5];
    
    if (!email || !password || !firstName || !lastName || !role) {
      console.log('Usage: node resetPassword.js create <email> <password> <firstName> <lastName> <role>');
      console.log('Roles: super_admin, admin, accountant, student');
      process.exit(1);
    }
    
    await createUser(email, password, firstName, lastName, role);
  } else if (action === 'list') {
    // List all users
    const users = await User.find().select('email firstName lastName role isActive');
    console.log('\n=== ALL USERS ===');
    users.forEach(user => {
      console.log(`${user.email} - ${user.firstName} ${user.lastName} - ${user.role} - ${user.isActive ? 'Active' : 'Inactive'}`);
    });
  } else {
    console.log('SmartFee Password Reset Utility');
    console.log('');
    console.log('Usage:');
    console.log('  node resetPassword.js list                                           - List all users');
    console.log('  node resetPassword.js reset <email> <password>                      - Reset password for existing user');
    console.log('  node resetPassword.js create <email> <password> <firstName> <lastName> <role> - Create new user');
    console.log('');
    console.log('Examples:');
    console.log('  node resetPassword.js list');
    console.log('  node resetPassword.js reset superadmin@smartfee.com password123');
    console.log('  node resetPassword.js create newadmin@smartfee.com password123 New Admin admin');
    console.log('');
    console.log('Available Roles: super_admin, admin, accountant, student');
  }

  process.exit(0);
};

main().catch(console.error); 