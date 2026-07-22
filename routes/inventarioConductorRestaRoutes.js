const express = require('express');
const router = express.Router();
const InventarioConductorRestaController = require('../controllers/inventarioConductorRestaController');
const { authMiddleware } = require('../middleware/authMiddleware');

// --------------------
// Rutas para inventario_conductor_resta
// --------------------

router.post('/', authMiddleware, InventarioConductorRestaController.crearInventario);

router.get('/existe/:conductorId', authMiddleware, InventarioConductorRestaController.existeInventarioHoy);

router.get('/hoy/:conductorId', authMiddleware, InventarioConductorRestaController.getInventarioHoy);

router.get('/todos/:conductorId', authMiddleware, InventarioConductorRestaController.obtenerInventarios);

router.get('/detalle/:inventarioId', authMiddleware, InventarioConductorRestaController.obtenerDetalleInventario);

router.put('/', authMiddleware, InventarioConductorRestaController.actualizarInventario);

router.put('/cerrar/:inventarioId', authMiddleware, InventarioConductorRestaController.cerrarInventario);

router.put('/restar', authMiddleware, InventarioConductorRestaController.restarInventarioPedido);

module.exports = router;
