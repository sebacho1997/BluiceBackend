const express = require('express');
const router = express.Router();
const prestamoEquipoController = require('../controllers/prestamoEquipoController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, prestamoEquipoController.create);
router.get('/', authMiddleware, prestamoEquipoController.getAll);
router.get('/:id', authMiddleware, prestamoEquipoController.getById);
router.put('/:id', authMiddleware, prestamoEquipoController.update);
router.delete('/:id', authMiddleware, prestamoEquipoController.delete);

module.exports = router;
