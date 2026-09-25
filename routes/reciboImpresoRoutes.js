const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const ReciboImpresoController = require('../controllers/reciboImpresoController');

router.post('/', authMiddleware, ReciboImpresoController.guardar);
router.post('/movimiento', authMiddleware, ReciboImpresoController.guardarMovimiento);
router.get('/', authMiddleware, ReciboImpresoController.listar);
router.get('/pdf', authMiddleware, ReciboImpresoController.listarPdf);
router.get('/pedido/:pedido_id', authMiddleware, ReciboImpresoController.listarPorPedido);

module.exports = router;
