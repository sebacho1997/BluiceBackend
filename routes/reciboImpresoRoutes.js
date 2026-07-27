const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const ReciboImpresoController = require('../controllers/reciboImpresoController');

router.post('/', authMiddleware, ReciboImpresoController.guardar);
router.get('/pedido/:pedido_id', authMiddleware, ReciboImpresoController.listarPorPedido);

module.exports = router;
