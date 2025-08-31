const pool = require('../config/db');

const PedidoProducto = {
  async create({ pedido_id, producto_id, cantidad }) {
    const result = await pool.query(
      `INSERT INTO pedido_productos (pedido_id, producto_id, cantidad)
       VALUES ($1, $2, $3) RETURNING *`,
      [pedido_id, producto_id, cantidad]
    );
    return result.rows[0];
  },

  async getByPedido(pedido_id) {
    const result = await pool.query(
      'SELECT * FROM pedido_productos WHERE pedido_id = $1',
      [pedido_id]
    );
    return result.rows;
  },

  async deleteByPedido(pedido_id) {
    const result = await pool.query(
      'DELETE FROM pedido_productos WHERE pedido_id = $1',
      [pedido_id]
    );
    return result.rowCount > 0;
  }
};

module.exports = PedidoProducto;
