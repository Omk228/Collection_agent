const express = require('express');
const router = express.Router();
const cashSubmissionController = require('../controllers/cashSubmissionController');
const { optionalAuth } = require('../middleware/auth');

router.get('/status', optionalAuth, cashSubmissionController.getCashStatus);
router.get('/pending', optionalAuth, cashSubmissionController.getCashStatus);
router.post('/', optionalAuth, cashSubmissionController.createSubmission);
router.put('/:id/status', optionalAuth, cashSubmissionController.updateSubmissionStatus);

module.exports = router;
