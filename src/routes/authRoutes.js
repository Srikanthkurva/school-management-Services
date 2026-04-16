const express = require('express');
const router = express.Router();
const { login, getMe, logout, setupFirstTime } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/setup-password', setupFirstTime);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

module.exports = router;
