const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');
const { authMiddleware, requireRoles } = require('../middleware/authMiddleware');
const { uploadProductos } = require('../middleware/upload');
const uploadBase64 = require('../middleware/uploadBase64');

router.post('/', authMiddleware, requireRoles('admin'), express.json(), uploadBase64, uploadProductos.single('imagen'), productoController.crearProducto);

router.get('/', productoController.obtenerProductos);

router.get('/:id', productoController.obtenerProductoPorId);

router.put('/:id', authMiddleware, requireRoles('admin'), express.json(), uploadBase64, uploadProductos.single('imagen'), productoController.actualizarProducto);

router.delete('/:id', authMiddleware, requireRoles('admin'), productoController.eliminarProducto);

module.exports = router;
