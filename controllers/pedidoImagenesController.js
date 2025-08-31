const PedidoImagen = require('../models/pedido_imagenes');

const pedidoImagenesController = {
  async agregarImagen(req, res) {
    try {
      const { id_pedido } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'Debe seleccionar una imagen' });
      }

      const imagen_url = req.file.path; // URL de Cloudinary
      const imagen_id = req.file.filename; // public_id de Cloudinary

      const nuevaImagen = await PedidoImagen.agregarImagen(id_pedido, imagen_url, imagen_id);

      res.json(nuevaImagen);
    } catch (error) {
      console.error('Error al subir imagen de pedido:', error);
      res.status(500).json({ error: 'No se pudo subir la imagen del pedido' });
    }
  },

  async obtenerImagenes(req, res) {
    try {
      const { id_pedido } = req.params;
      const imagenes = await PedidoImagen.getImagenesByPedido(id_pedido);
      res.json(imagenes);
    } catch (error) {
      console.error('Error al obtener imágenes de pedido:', error);
      res.status(500).json({ error: 'No se pudieron obtener las imágenes del pedido' });
    }
  },
};

module.exports = pedidoImagenesController;
