const pool = require('../config/db');

const Producto = {
  async create({ nombre, nombre_interno, cantidad, preciounitario, imagen, imagen_id }) {
  const result = await pool.query(
    `INSERT INTO productos (nombre, nombre_interno, cantidad, preciounitario, imagen, imagen_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [nombre, nombre_interno, cantidad, preciounitario, imagen, imagen_id]
  );
  return result.rows[0];
},
  async getAll() {
    const result = await pool.query('SELECT * FROM productos WHERE estado = true');
    return result.rows;
  },

  async getById(idproducto) {
    const result = await pool.query('SELECT * FROM productos WHERE idproducto = $1 AND estado = true', [idproducto]);
    return result.rows[0];
  },

  async update(idproducto, { nombre, nombre_interno, cantidad, preciounitario, imagen, imagen_id }) {
  const result = await pool.query(
    `UPDATE productos
     SET nombre = $1, nombre_interno = $2, cantidad = $3, preciounitario = $4, imagen = $5, imagen_id = $6
     WHERE idproducto = $7 RETURNING *`,
    [nombre, nombre_interno, cantidad, preciounitario, imagen, imagen_id, idproducto]
  );
  return result.rows[0];
},

  async delete(idproducto) {
    const result = await pool.query('UPDATE productos SET estado = false WHERE idproducto = $1', [idproducto]);
    return result.rowCount > 0;
  }
};

module.exports = Producto;
