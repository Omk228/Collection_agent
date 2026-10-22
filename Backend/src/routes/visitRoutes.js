const express = require('express');
const router = express.Router();
const visitController = require('../controllers/visitController');
const { optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, visitController.recordVisit);
router.get('/', optionalAuth, visitController.getVisits);
router.get('/analytics', optionalAuth, visitController.getVisitAnalytics);

module.exports = router;
