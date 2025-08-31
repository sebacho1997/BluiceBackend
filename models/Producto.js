const pool = require('../config/db');

const Producto = {
  async create({ nombre, cantidad, preciounitario, imagen, imagen_id }) {
  const result = await pool.query(
    `INSERT INTO productos (nombre, cantidad, preciounitario, imagen, imagen_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [nombre, cantidad, preciounitario, imagen, imagen_id]
  );
  return result.rows[0];
},
  async getAll() {
    const result = await pool.query('SELECT * FROM productos');
    return result.rows;
  },

  async getById(idproducto) {
    const result = await pool.query('SELECT * FROM productos WHERE idproducto = $1', [idproducto]);
    return result.rows[0];
  },

  async update(idproducto, { nombre, cantidad, preciounitario, imagen, imagen_id }) {
  const result = await pool.query(
    `UPDATE productos
     SET nombre = $1, cantidad = $2, preciounitario = $3, imagen = $4, imagen_id = $5
     WHERE idproducto = $6 RETURNING *`,
    [nombre, cantidad, preciounitario, imagen, imagen_id, idproducto]
  );
  return result.rows[0];
},

  async delete(idproducto) {
    const result = await pool.query('DELETE FROM productos WHERE idproducto = $1', [idproducto]);
    return result.rowCount > 0;
  }
};

module.exports = Producto;
