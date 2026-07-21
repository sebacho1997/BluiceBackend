const express = require('express');
const router = express.Router();
const InventarioConductorRestaController = require('../controllers/inventarioConductorRestaController');
const { authMiddleware } = require('../middleware/authMiddleware');

// --------------------
// Rutas para inventario_conductor_resta
// --------------------

router.post('/inventario-resta', authMiddleware, InventarioConductorRestaController.crearInventario);

router.get('/inventario-resta/existe/:conductorId', authMiddleware, InventarioConductorRestaController.existeInventarioHoy);

router.get('/hoy/:conductorId', authMiddleware, InventarioConductorRestaController.getInventarioHoy);

router.get('/inventario-resta/todos/:conductorId', authMiddleware, InventarioConductorRestaController.obtenerInventarios);

router.get('/inventario-resta/detalle/:inventarioId', authMiddleware, InventarioConductorRestaController.obtenerDetalleInventario);

router.put('/inventario-resta', authMiddleware, InventarioConductorRestaController.actualizarInventario);

router.put('/inventario-resta/cerrar/:inventarioId', authMiddleware, InventarioConductorRestaController.cerrarInventario);

router.put('/inventario-resta/restar', authMiddleware, InventarioConductorRestaController.restarInventarioPedido);

module.exports = router;
