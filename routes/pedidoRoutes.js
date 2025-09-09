const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadComprobantes } = require('../middleware/upload'); // <-- importamos el middleware

router.get('/deudores',authMiddleware, pedidoController.getClientesDeudores);
// Crear un pedido
router.post('/', authMiddleware, pedidoController.crearPedido);

// Obtener todos los pedidos
router.get('/', authMiddleware, pedidoController.obtenerPedidos);

router.patch('/:id/completado', authMiddleware, pedidoController.marcarCompletado);
// Obtener pedidos de un usuario en pendiente o asignado
router.get('/usuario/:usuario_id', authMiddleware, pedidoController.obtenerPedidosPorUsuario);

router.get('/sinconductor', authMiddleware, pedidoController.obtenerPedidosPendientesSinConductor);

router.post('/:id/entregado', authMiddleware, pedidoController.marcarEntregado);

// Obtener un pedido por ID
router.get('/:id', authMiddleware, pedidoController.obtenerPedidoPorId);

// Obtener pedidos por usuario y estado
router.get('/usuario/:usuario_id/estado/:estado', authMiddleware, pedidoController.obtenerPedidosPorEstadoycliente);

router.get('/estado/:estado', authMiddleware, pedidoController.obtenerPedidosPorEstado);

router.post('/:id/pagos', authMiddleware, uploadComprobantes.single('comprobante'), pedidoController.agregarPago);
router.get('/:id/pagos', authMiddleware, pedidoController.obtenerPagos);
router.put('/:pago_id', authMiddleware, uploadComprobantes.single('comprobante'), pedidoController.editarPago);
// Actualizar estado del pedido
router.put('/:id/estado', authMiddleware, pedidoController.actualizarEstado);

// Obtener pedidos asignados a un conductor
router.get('/conductor/:conductor_id', authMiddleware, pedidoController.obtenerPedidosAsignados);

// Asignar conductor
router.put('/:pedidoId/assign/:conductorId', authMiddleware, pedidoController.asignarConductor);


// Obtener productos de un pedido específico
router.get('/:pedidoId/productos', authMiddleware, pedidoController.obtenerProductosPedido);

// Confirmar entrega de un pedido
router.put('/:id/entregar', authMiddleware, pedidoController.confirmarEntrega);

router.put('/:id/recibo',authMiddleware, pedidoController.agregarRecibo);

// routes/pedidoRoutes.js
router.put('/edit/:pedidoId/productos/:pedidoproductoId/precio', pedidoController.updateProductPriceInPedido);


module.exports = router;
