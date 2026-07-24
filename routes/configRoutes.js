const express = require('express');
const configController = require('../controllers/configController');
const { authMiddleware, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', configController.getAll);
router.put('/', authMiddleware, requireRoles('admin'), configController.update);

module.exports = router;
