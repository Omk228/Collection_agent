const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, taskController.getTasks);
router.post('/', optionalAuth, taskController.createTask);
router.put('/:id', optionalAuth, taskController.updateTask);
router.delete('/:id', optionalAuth, taskController.deleteTask);

module.exports = router;
