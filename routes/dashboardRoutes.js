const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authMiddleware, requireRoles } = require('../middleware/authMiddleware');

router.get(
  '/',
  authMiddleware,
  requireRoles('administrador'),
  DashboardController.getDashboardData
);

module.exports = router;
