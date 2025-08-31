const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Configuración de almacenamiento en Cloudinary
const storageProductos = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'productos',   // Carpeta en Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

// Storage para comprobantes
const storageComprobantes = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'comprobantes',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});
const storagePedidoImagenes = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'pedidoImagenes', // Carpeta en Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const uploadPedidoImagenes = multer({ storage: storagePedidoImagenes });
const uploadProductos = multer({ storage: storageProductos });
const uploadComprobantes = multer({ storage: storageComprobantes });

module.exports = { uploadProductos, uploadComprobantes, uploadPedidoImagenes };
