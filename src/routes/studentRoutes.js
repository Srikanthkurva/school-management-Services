const express = require('express');
const router = express.Router();
const { getStudents, getStudentById, createStudent, updateStudent, deleteStudent } = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize('admin', 'teacher'), getStudents);
router.get('/:id', authenticate, getStudentById);
router.post('/', authenticate, authorize('admin'), createStudent);
router.put('/:id', authenticate, authorize('admin'), updateStudent);
router.delete('/:id', authenticate, authorize('admin'), deleteStudent);

module.exports = router;
