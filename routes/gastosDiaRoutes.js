const express = require('express');
const router = express.Router();
const gastosDiaController = require('../controllers/gastosDiaController');

router.post('/', gastosDiaController.create);
router.get('/', gastosDiaController.findAll);
router.get('/hoy', gastosDiaController.listarHoy);
router.get('/:id', gastosDiaController.findById);
router.put('/:id', gastosDiaController.update);
router.delete('/:id', gastosDiaController.delete);

module.exports = router;
