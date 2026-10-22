const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, auditController.getAuditLogs);
router.post('/', optionalAuth, auditController.recordCustomLog);

module.exports = router;
