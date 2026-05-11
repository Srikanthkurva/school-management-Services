const express = require('express');
const router = express.Router();
const teacherRequestController = require('../controllers/teacherRequestController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Public
router.post('/submit', teacherRequestController.submitRequest);

// Admin Only
router.get('/all', authenticate, authorize('admin'), teacherRequestController.getAllRequests);
router.put('/approve/:id', authenticate, authorize('admin'), teacherRequestController.approveRequest);
router.put('/reject/:id', authenticate, authorize('admin'), teacherRequestController.rejectRequest);

module.exports = router;
