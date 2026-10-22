const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateAgent } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/register', authController.registerAgent);
router.post('/change-password', authenticateAgent, authController.changePassword);
router.get('/me', authenticateAgent, authController.getMe);
router.post('/logout', authenticateAgent, authController.logout);

module.exports = router;
