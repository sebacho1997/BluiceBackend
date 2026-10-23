const express = require('express');
const router = express.Router();
const notificacionController = require('../controllers/notificacionController');
const { authMiddleware, requireRoles } = require('../middleware/authMiddleware');

router.get(
  '/',
  authMiddleware,
  requireRoles('administrador', 'admin'),
  notificacionController.listar
);

module.exports = router;
