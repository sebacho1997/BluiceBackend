const express = require('express');
const router = express.Router();
const prestamoEquipoController = require('../controllers/prestamoEquipoController');

// CRUD
router.post('/', prestamoEquipoController.create);
router.get('/', prestamoEquipoController.getAll);
router.get('/:id', prestamoEquipoController.getById);
router.put('/:id', prestamoEquipoController.update);
router.delete('/:id', prestamoEquipoController.delete);

module.exports = router;
