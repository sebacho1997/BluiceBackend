const pool = require('../config/db');   

const GastosDia = {
  async create({ id_conductor, descripcion, monto }) {
    const result = await pool.query(
      `INSERT INTO gastos_dia (id_conductor, descripcion, monto) 
       VALUES ($1, $2, $3) RETURNING *`,
      [id_conductor, descripcion, monto]
    );
    return result.rows[0];
  },
async listarHoyConductor(idConductor) {
  const result = await pool.query(
    `SELECT g.*, u.nombre AS conductor_nombre
     FROM gastos_dia g
     JOIN usuarios u ON u.id = g.id_conductor
     WHERE DATE(fecha_gasto) = CURRENT_DATE
       AND g.id_conductor = $1
     ORDER BY fecha_gasto DESC`,
    [idConductor]
  );
  return result.rows;
},
  async findAll(idConductor) { 
  const result = await pool.query(
    `SELECT g.*, u.nombre AS conductor_nombre
     FROM gastos_dia g
     JOIN usuarios u ON u.id = g.id_conductor
     WHERE g.id_conductor = $1
     ORDER BY g.fecha_gasto DESC`,
    [idConductor]
  );
  return result.rows;
},

  async findById(id) {
    const result = await pool.query(
      `SELECT g.*, u.nombre AS conductor_nombre
       FROM gastos_dia g
       JOIN usuarios u ON u.id = g.id_conductor
       WHERE g.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async update(id, { id_conductor, descripcion, monto }) {
    const result = await pool.query(
      `UPDATE gastos_dia
       SET id_conductor = $1, descripcion = $2, monto = $3
       WHERE id = $4 RETURNING *`,
      [id_conductor, descripcion, monto, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await pool.query(
      `DELETE FROM gastos_dia WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
};

module.exports = GastosDia;
