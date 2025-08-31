const pool = require('../config/db');

const PedidoImagen = {
  async agregarImagen(pedido_id, imagen_url, imagen_id) {
    try {
      const result = await pool.query(
        `INSERT INTO pedido_imagenes (id_pedido, imagen, imagen_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [pedido_id, imagen_url, imagen_id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error al agregar imagen de pedido:', error);
      throw new Error('No se pudo agregar la imagen del pedido');
    }
  },

  async getImagenesByPedido(pedido_id) {
    try {
      const result = await pool.query(
        `SELECT * FROM pedido_imagenes WHERE id_pedido = $1`,
        [pedido_id]
      );
      return result.rows;
    } catch (error) {
      console.error('Error al obtener imágenes del pedido:', error);
      throw new Error('No se pudieron obtener las imágenes del pedido');
    }
  },
};

module.exports = PedidoImagen;
