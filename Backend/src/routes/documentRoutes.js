const express = require('express');
const router = express.Router();
const DocumentController = require('../controllers/documentController');
const { protectStaticDocs } = require('../middleware/securityMiddleware');
const { optionalAuth } = require('../middleware/auth');

// GET /api/documents/customer/:userId
router.get('/customer/:userId', optionalAuth, DocumentController.getByUserId);

// GET /api/documents/stream?path=...
router.get('/stream', protectStaticDocs, DocumentController.streamDocument);

// GET /api/documents/:userId
router.get('/:userId', optionalAuth, DocumentController.getByUserId);

module.exports = router;
