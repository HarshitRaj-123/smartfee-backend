const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const { initializeSessionCleanup } = require('./middleware/sessionCleanup.middleware');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/sessions', require('./routes/session.routes'));
app.use('/api/navigation', require('./routes/navigation.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/student-fees', require('./routes/studentFee.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/fee-structures', require('./routes/feeStructure.routes'));

console.log('All routes registered successfully!');

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartfee')
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Initialize session cleanup
    initializeSessionCleanup();
    
    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  }); 