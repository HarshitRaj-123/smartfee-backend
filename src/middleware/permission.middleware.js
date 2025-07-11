const { PERMISSIONS } = require('../constants/roles');

function permit(feature) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) return res.status(401).json({ message: 'Unauthorized' });
    if (!PERMISSIONS[feature]) return res.status(500).json({ message: 'Permission not defined' });
    if (!PERMISSIONS[feature].includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
}

module.exports = permit;

