const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Authorization denied.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_12345');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      const { permissions } = require('../data/mockData');
      const role = req.user?.role;
      if (!role) return res.status(401).json({ success: false, message: 'No user role present' });
      const rolePerms = permissions[role] || [];
      if (!rolePerms.includes(permission)) {
        return res.status(403).json({ success: false, message: `Permission '${permission}' required` });
      }
      next();
    } catch (err) {
      console.error('requirePermission error', err);
      return res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

module.exports = { authenticate, authorize, requirePermission };

