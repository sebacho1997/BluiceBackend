const express = require('express');
const router = express.Router();
const gastosDiaController = require('../controllers/gastosDiaController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, gastosDiaController.create);
router.get('/', authMiddleware, gastosDiaController.findAll);
router.get('/hoy', authMiddleware, gastosDiaController.listarHoy);
router.get('/:id', authMiddleware, gastosDiaController.findById);
router.put('/:id', authMiddleware, gastosDiaController.update);
router.delete('/:id', authMiddleware, gastosDiaController.delete);

module.exports = router;
