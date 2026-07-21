const express = require('express');
const router = express.Router();
const pedidoProductoController = require('../controllers/pedidoProductoController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, pedidoProductoController.agregarProducto);

router.get('/:pedido_id', authMiddleware, pedidoProductoController.obtenerProductosPorPedido);

router.delete('/:pedido_id', authMiddleware, pedidoProductoController.eliminarProductosPorPedido);

module.exports = router;
