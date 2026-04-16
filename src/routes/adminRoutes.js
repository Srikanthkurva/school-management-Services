const express = require('express');
const router = express.Router();
const { getAnalytics, getPermissions, updatePermissions, getActivityLogs, getNotifications } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/analytics', authenticate, authorize('admin'), getAnalytics);
router.get('/permissions', authenticate, authorize('admin'), getPermissions);
router.put('/permissions', authenticate, authorize('admin'), updatePermissions);
router.get('/logs', authenticate, authorize('admin'), getActivityLogs);
router.get('/notifications', authenticate, getNotifications);

module.exports = router;
