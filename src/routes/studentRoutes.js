const express = require('express');
const router = express.Router();
const { getStudents, getStudentById, createStudent, updateStudent, deleteStudent } = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Debug endpoint
router.get('/test', async (req, res) => {
  try {
    const db = require('../config/db');
    const [rows] = await db.query('SELECT id, name, roll_no FROM students LIMIT 10');
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/', authenticate, authorize('admin', 'teacher'), getStudents);
router.get('/:id', getStudentById);
router.post('/', authenticate, authorize('admin'), createStudent);
router.put('/:id', authenticate, authorize('admin'), updateStudent);
router.delete('/:id', authenticate, authorize('admin'), deleteStudent);

module.exports = router;
