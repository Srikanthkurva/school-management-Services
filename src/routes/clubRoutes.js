const express = require('express');
const router = express.Router();
const clubController = require('../controllers/clubController');

router.post('/', clubController.submitClubRequest);
router.get('/', clubController.getClubRequests);

module.exports = router;
