const { analytics, permissions, activityLogs, notifications } = require('../data/mockData');

const getAnalytics = (req, res) => {
  res.json({ success: true, data: analytics });
};

const getPermissions = (req, res) => {
  res.json({ success: true, data: permissions });
};

const updatePermissions = (req, res) => {
  const { role, perms } = req.body;
  if (!role || !Array.isArray(perms)) {
    return res.status(400).json({ success: false, message: 'Role and permissions array required' });
  }
  if (!permissions[role]) {
    return res.status(404).json({ success: false, message: 'Role not found' });
  }
  permissions[role] = perms;
  res.json({ success: true, message: 'Permissions updated', data: permissions });
};

const getActivityLogs = (req, res) => {
  const { limit = 20 } = req.query;
  const logs = activityLogs.slice(0, Number(limit));
  res.json({ success: true, data: logs, total: activityLogs.length });
};

const getNotifications = (req, res) => {
  const { role } = req.user;
  const filtered = notifications.filter((n) => n.targetRole === role || n.targetRole === 'all');
  res.json({ success: true, data: filtered, total: filtered.length });
};

module.exports = { getAnalytics, getPermissions, updatePermissions, getActivityLogs, getNotifications };
