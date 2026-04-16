const express = require('express');
const router = express.Router();
const { getAttendance, markAttendance, getStudentAttendanceSummary } = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, getAttendance);
router.post('/', authenticate, authorize('admin', 'teacher'), markAttendance);
router.get('/summary/:studentId', authenticate, getStudentAttendanceSummary);

module.exports = router;
