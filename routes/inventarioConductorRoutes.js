const express = require('express');
const router = express.Router();
const InventarioConductorController = require('../controllers/InventarioConductorController');

// -----------------------------
// RUTAS INVENTARIO
// -----------------------------

// Crear un nuevo inventario
router.post('/', InventarioConductorController.crearInventario);

router.get('/hoy/:conductor_id', InventarioConductorController.getInventarioHoy);

// Obtener todos los inventarios de un conductor
router.get('/:conductor_id', InventarioConductorController.obtenerInventarios);

// Obtener detalle de un inventario específico
router.get('/detalle/:inventario_id', InventarioConductorController.obtenerDetalle);

router.put('/cerrar', InventarioConductorController.cerrarInventario);

// -----------------------------
// RUTAS DEVOLUCIÓN
// -----------------------------
// Crear devolución
router.post('/devolucion', InventarioConductorController.crearDevolucion);

// Obtener todas las devoluciones de un conductor
router.get('/devolucion/:conductor_id', InventarioConductorController.obtenerDevoluciones);

// Obtener detalle de una devolución
router.get('/devolucion/detalle/:devolucion_id', InventarioConductorController.obtenerDetalle);

module.exports = router;
