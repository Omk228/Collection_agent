const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { optionalAuth } = require('../middleware/auth');

router.post('/ping', optionalAuth, locationController.recordLocationPing);
router.get('/history', optionalAuth, locationController.getLocationHistory);
router.get('/live', optionalAuth, locationController.getLiveLocation);
router.get('/all-agents', optionalAuth, locationController.getAllAgentsLiveLocation);

module.exports = router;

