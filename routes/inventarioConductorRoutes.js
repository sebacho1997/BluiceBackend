const express = require('express');
const router = express.Router();
const InventarioConductorController = require('../controllers/InventarioConductorController');

// -----------------------------
// RUTAS INVENTARIO
// -----------------------------

// Crear un nuevo inventario
router.post('/', InventarioConductorController.crearInventario);

router.get('/hoy/:conductor_id', InventarioConductorController.getInventarioHoy);
router.get('/existe/:conductorId', InventarioConductorController.existeInventarioHoy);

// Obtener detalle de un inventario específico (debe ir ANTES de /:conductor_id)
router.get('/detalle/:inventario_id', InventarioConductorController.obtenerDetalleInventario);

router.put('/cerrar', InventarioConductorController.cerrarInventario);

// -----------------------------
// RUTAS DEVOLUCIÓN
// -----------------------------
// Crear devolución
router.post('/devolucion', InventarioConductorController.crearDevolucion);

// Obtener detalle de una devolución (debe ir ANTES de /devolucion/:conductor_id)
router.get('/devolucion/detalle/:devolucion_id', InventarioConductorController.obtenerDetalleDevolucion);

// Obtener todas las devoluciones de un conductor
router.get('/devolucion/:conductor_id', InventarioConductorController.obtenerDevoluciones);

// Obtener todos los inventarios de un conductor (ruta dinámica al final para no pisar las anteriores)
router.get('/:conductor_id', InventarioConductorController.obtenerInventarios);

module.exports = router;
