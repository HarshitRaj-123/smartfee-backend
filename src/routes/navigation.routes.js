const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');

// Navigation configuration based on roles
const navigationConfig = {
  super_admin: [
    { label: "Dashboard", route: "/dashboard", icon: "Dashboard" },
    { label: "Users", route: "/users", icon: "Group" },
    { label: "Students", route: "/students", icon: "School" },
    { label: "Fee Management", route: "/fee-management", icon: "AccountBalanceWallet" },
    { label: "Fee Payment", route: "/fee-payment", icon: "Payments" },
    { label: "Transactions", route: "/transactions", icon: "ReceiptLong" },
    { label: "Notifications", route: "/notifications", icon: "Notifications" },
    { label: "Audit Logs", route: "/audit-logs", icon: "History" },
    { label: "Settings", route: "/settings", icon: "Settings" }
  ],

  admin: [
    { label: "Dashboard", route: "/dashboard", icon: "Dashboard" },
    { label: "Users", route: "/users", icon: "Group" },
    { label: "Students", route: "/students", icon: "School" },
    { label: "Fee Management", route: "/fee-management", icon: "AccountBalanceWallet" },
    { label: "Fee Payment", route: "/fee-payment", icon: "Payments" },
    { label: "Transactions", route: "/transactions", icon: "ReceiptLong" },
    { label: "Notifications", route: "/notifications", icon: "Notifications" },
    { label: "Audit Logs", route: "/audit-logs", icon: "History" },
    { label: "Settings", route: "/settings", icon: "Settings" }
  ],

  accountant: [
    { label: "Dashboard", route: "/dashboard", icon: "Dashboard" },
    { label: "Students", route: "/students", icon: "School" },
    { label: "Fee Payment", route: "/fee-payment", icon: "Payments" },
    { label: "Transactions", route: "/transactions", icon: "ReceiptLong" },
    { label: "Notifications", route: "/notifications", icon: "Notifications" },
    { label: "Settings", route: "/settings", icon: "Settings" }
  ],

  student: [
    { label: "Dashboard", route: "/dashboard", icon: "Dashboard" },
    { label: "Transactions", route: "/transactions", icon: "ReceiptLong" },
    { label: "Fee Payment", route: "/fee-payment", icon: "Payments" },
    { label: "Notifications", route: "/notifications", icon: "Notifications" },
    { label: "Settings", route: "/settings", icon: "Settings" }
  ]
};

// Get navigation items based on user role
router.get('/sidebar', verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const navigationItems = navigationConfig[userRole] || [];

    res.json({
      success: true,
      data: {
        role: userRole,
        navigationItems
      }
    });
  } catch (error) {
    console.error('Error fetching navigation:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching navigation items'
    });
  }
});

// Get all available navigation items (for admin purposes)
router.get('/all', verifyToken, async (req, res) => {
  try {
    // Only super_admin can access all navigation configs
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin privileges required.'
      });
    }

    res.json({
      success: true,
      data: navigationConfig
    });
  } catch (error) {
    console.error('Error fetching all navigation:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching navigation configuration'
    });
  }
});

module.exports = router; 