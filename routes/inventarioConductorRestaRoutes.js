const express = require('express');
const router = express.Router();
const InventarioConductorRestaController = require('../controllers/inventarioConductorRestaController');

// --------------------
// Rutas para inventario_conductor_resta
// --------------------

// Crear inventario
router.post('/inventario-resta', InventarioConductorRestaController.crearInventario);

// Verificar si existe inventario hoy
router.get('/inventario-resta/existe/:conductorId', InventarioConductorRestaController.existeInventarioHoy);

// Obtener inventario del día
router.get('/hoy/:conductorId', InventarioConductorRestaController.getInventarioHoy);

// Obtener todos los inventarios de un conductor
router.get('/inventario-resta/todos/:conductorId', InventarioConductorRestaController.obtenerInventarios);

// Obtener detalle de un inventario
router.get('/inventario-resta/detalle/:inventarioId', InventarioConductorRestaController.obtenerDetalleInventario);

// Actualizar inventario y sus detalles
router.put('/inventario-resta', InventarioConductorRestaController.actualizarInventario);

// Cerrar inventario
router.put('/inventario-resta/cerrar/:inventarioId', InventarioConductorRestaController.cerrarInventario);

router.put('/inventario-resta/restar', InventarioConductorRestaController.restarInventarioPedido);

module.exports = router;
