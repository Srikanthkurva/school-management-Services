const express = require('express');
const router = express.Router();
const admissionController = require('../controllers/admissionController');

router.post('/', admissionController.submitAdmission);

// Super admin endpoints
router.get('/pending', admissionController.getPendingAdmissions);
router.post('/:id/approve', admissionController.approveAdmission);
router.post('/:id/reject', admissionController.rejectAdmission);

// Admin direct add student (no approval needed)
router.post('/add-student', admissionController.addStudentDirect);

module.exports = router;
