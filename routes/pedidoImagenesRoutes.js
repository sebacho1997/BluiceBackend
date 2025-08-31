const express = require('express');
const router = express.Router();
const pedidoImagenesController = require('../controllers/pedidoImagenesController');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadPedidoImagenes } = require('../middleware/upload'); // middleware Cloudinary

// Subir imagen de un pedido
router.post(
  '/:id_pedido',
  authMiddleware,
  uploadPedidoImagenes.single('imagen'),
  pedidoImagenesController.agregarImagen
);

// Obtener imágenes de un pedido
router.get(
  '/:id_pedido',
  authMiddleware,
  pedidoImagenesController.obtenerImagenes
);

module.exports = router;
