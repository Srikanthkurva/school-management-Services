const express = require('express');
const router = express.Router();
const { getResults, getResultById, createResult } = require('../controllers/resultController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, getResults);
router.get('/:id', authenticate, getResultById);
router.post('/', authenticate, authorize('admin', 'teacher'), createResult);

module.exports = router;
