const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { optionalAuth, authenticateAgent } = require('../middleware/auth');

router.get('/profile', optionalAuth, agentController.getProfile);
router.put('/profile', optionalAuth, agentController.updateProfile);
router.get('/dashboard-stats', optionalAuth, agentController.getDashboardStats);

module.exports = router;
