const express = require('express');
const router = express.Router();
const movimientoEquipoController = require('../controllers/movimientoEquipoController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, movimientoEquipoController.create);
router.get('/', authMiddleware, movimientoEquipoController.getAll);
router.get('/:id', authMiddleware, movimientoEquipoController.getById);
router.put('/:id/entregar', authMiddleware, movimientoEquipoController.entregar);
router.put('/:id/devolver', authMiddleware, movimientoEquipoController.devolver);
router.delete('/:id', authMiddleware, movimientoEquipoController.delete);

module.exports = router;