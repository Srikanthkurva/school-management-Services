const express = require('express');
const router = express.Router();
const { getClasses } = require('../controllers/classController');

// GET /api/classes
router.get('/', getClasses);

module.exports = router;
