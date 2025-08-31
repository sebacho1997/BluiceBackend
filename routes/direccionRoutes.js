const express = require('express');
const router = express.Router();
const direccionController = require('../controllers/direccionController');

// ⚡ importante: poner rutas más específicas primero
router.get('/usuario/:usuario_id', direccionController.getByUserId);
router.get('/:id', direccionController.getById);

router.post('/users/:id', direccionController.create);
router.put('/:id', direccionController.update);
router.delete('/:id', direccionController.delete);

module.exports = router;
