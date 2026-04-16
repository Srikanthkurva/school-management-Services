const express = require('express');
const router = express.Router();
const { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Debug test endpoint (no auth)
router.get('/test', async (req, res) => {
  try {
    const db = require('../config/db');
    const [rows] = await db.query('SELECT id, name, subject FROM teachers LIMIT 10');
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/', authenticate, authorize('admin'), getTeachers);
router.get('/:id', getTeacherById);
router.post('/', authenticate, authorize('admin'), createTeacher);
router.put('/:id', authenticate, authorize('admin'), updateTeacher);
router.delete('/:id', authenticate, authorize('admin'), deleteTeacher);

module.exports = router;
