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

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://smartfee-frontend.vercel.app', 'https://smartfee-frontend-git-main-harshitraj-123.vercel.app', 'https://smartfee-frontend-harshitraj-123.vercel.app']
    : (process.env.FRONTEND_URL || 'http://localhost:5173'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!', timestamp: new Date().toISOString() });
});

console.log('All routes registered successfully!');

// 404 handler
app.use('/api/*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    message: 'API route not found', 
    path: req.url,
    method: req.method 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartfee')
  .then(() => {
    console.log('Connected to MongoDB');
    // Initialize session cleanup
    initializeSessionCleanup();
    // Only start server if not running on Vercel
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

module.exports = app; 
module.exports.handler = serverless(app);