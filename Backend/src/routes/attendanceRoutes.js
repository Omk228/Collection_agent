const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { optionalAuth } = require('../middleware/auth');

router.get('/today', optionalAuth, attendanceController.getTodayAttendance);
router.post('/punch-in', optionalAuth, attendanceController.punchIn);
router.post('/punch-out', optionalAuth, attendanceController.punchOut);
router.get('/history', optionalAuth, attendanceController.getAttendanceHistory);

module.exports = router;
