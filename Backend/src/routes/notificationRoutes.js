const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, notificationController.getNotifications);
router.put('/:id/read', optionalAuth, notificationController.markAsRead);
router.put('/read-all', optionalAuth, notificationController.markAllAsRead);
router.post('/', optionalAuth, notificationController.createNotification);

module.exports = router;
