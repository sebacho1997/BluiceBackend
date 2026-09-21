const pool = require('../config/db');

const Equipo = {
  async create({ nombre, descripcion, precio, stock }) {
    const result = await pool.query(
      `INSERT INTO equipos (nombre, descripcion, precio, stock)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, descripcion || '', precio || 0, stock || 0]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await pool.query(
      `SELECT * FROM equipos ORDER BY nombre ASC, id ASC`
    );
    return result.rows;
  },

  async findById(id) {
    const result = await pool.query(
      `SELECT * FROM equipos WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async update(id, { nombre, descripcion, precio, stock }) {
    const result = await pool.query(
      `UPDATE equipos
       SET nombre = $1, descripcion = $2, precio = $3, stock = $4
       WHERE id = $5 RETURNING *`,
      [nombre, descripcion || '', precio || 0, stock || 0, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await pool.query(
      `DELETE FROM equipos WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  },
};

module.exports = Equipo;