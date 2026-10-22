const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, customerController.getCustomers);
router.get('/distribution-status', optionalAuth, customerController.getDistributionStatus);
router.post('/auto-assign', optionalAuth, customerController.triggerAutoAssign);
router.get('/:id', optionalAuth, customerController.getCustomerById);
router.post('/assign-case', optionalAuth, customerController.assignCaseToAgent);
router.post('/', optionalAuth, customerController.createCustomer);
router.put('/:id', optionalAuth, customerController.updateCustomer);

module.exports = router;
