const express = require('express');
const router = express.Router();
const DevolucionEquipoController = require('../controllers/devolucionEquipoController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, DevolucionEquipoController.crear);
router.get('/', authMiddleware, DevolucionEquipoController.listarTodas);
router.get('/conductor/:conductor_id', authMiddleware, DevolucionEquipoController.listarPorConductor);

module.exports = router;
