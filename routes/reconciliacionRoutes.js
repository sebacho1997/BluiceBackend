const express = require('express');
const router = express.Router();
const ReconciliacionController = require('../controllers/reconciliacionController');
const { authMiddleware, requireRoles } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, requireRoles('administrador'), ReconciliacionController.getReconciliacion);

module.exports = router;
