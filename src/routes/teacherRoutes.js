const express = require('express');
const router = express.Router();
const { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } = require('../controllers/teacherController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize('admin'), getTeachers);
router.get('/:id', authenticate, authorize('admin', 'teacher'), getTeacherById);
router.post('/', authenticate, authorize('admin'), createTeacher);
router.put('/:id', authenticate, authorize('admin'), updateTeacher);
router.delete('/:id', authenticate, authorize('admin'), deleteTeacher);

module.exports = router;
