const express = require('express');

const router = express.Router();
const enquiryController = require('../controllers/enquiryController');

router.post('/', enquiryController.submitEnquiry);
router.get('/', enquiryController.getEnquiries);

module.exports = router;
