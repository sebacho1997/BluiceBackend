const express = require('express');
const router = express.Router();
const pedidoProductoController = require('../controllers/pedidoProductoController');

// Agregar un producto a un pedido
router.post('/', pedidoProductoController.agregarProducto);

// Obtener productos de un pedido
router.get('/:pedido_id', pedidoProductoController.obtenerProductosPorPedido);

// Eliminar productos de un pedido
router.delete('/:pedido_id', pedidoProductoController.eliminarProductosPorPedido);

module.exports = router;
