const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, paymentController.recordPayment);
router.get('/', optionalAuth, paymentController.getPayments);
router.get('/summary', optionalAuth, paymentController.getPaymentSummary);
router.get('/receipt/:receiptNumber', optionalAuth, paymentController.getReceiptByNumber);

module.exports = router;
