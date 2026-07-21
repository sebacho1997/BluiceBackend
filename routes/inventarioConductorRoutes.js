const express = require('express');
const router = express.Router();
const InventarioConductorController = require('../controllers/InventarioConductorController');
const { authMiddleware } = require('../middleware/authMiddleware');

// -----------------------------
// RUTAS INVENTARIO
// -----------------------------

router.post('/', authMiddleware, InventarioConductorController.crearInventario);

router.get('/hoy/:conductor_id', authMiddleware, InventarioConductorController.getInventarioHoy);
router.get('/existe/:conductorId', authMiddleware, InventarioConductorController.existeInventarioHoy);

router.get('/detalle/:inventario_id', authMiddleware, InventarioConductorController.obtenerDetalleInventario);

router.put('/cerrar', authMiddleware, InventarioConductorController.cerrarInventario);

// -----------------------------
// RUTAS DEVOLUCIÓN
// -----------------------------
router.post('/devolucion', authMiddleware, InventarioConductorController.crearDevolucion);

router.get('/devolucion/detalle/:devolucion_id', authMiddleware, InventarioConductorController.obtenerDetalleDevolucion);

router.get('/devolucion/:conductor_id', authMiddleware, InventarioConductorController.obtenerDevoluciones);

router.get('/:conductor_id', authMiddleware, InventarioConductorController.obtenerInventarios);

module.exports = router;
