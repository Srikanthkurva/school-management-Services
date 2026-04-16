const express = require('express');
const router = express.Router();

const { getAssignments, getAssignmentById, createAssignment, updateAssignment, deleteAssignment } = require('../controllers/assignmentController');
const { authenticate, authorize, requirePermission } = require('../middleware/authMiddleware');

// Public read endpoints: allow frontend to fetch assignment lists without auth
router.get('/', getAssignments);
router.get('/:id', getAssignmentById);

// Protect modifying endpoints and require explicit permission
router.post('/', authenticate, authorize('admin', 'teacher'), requirePermission('manage_assignments'), createAssignment);
router.put('/:id', authenticate, authorize('admin', 'teacher'), requirePermission('manage_assignments'), updateAssignment);
router.delete('/:id', authenticate, authorize('admin', 'teacher'), requirePermission('manage_assignments'), deleteAssignment);

module.exports = router;
