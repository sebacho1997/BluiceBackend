const pool = require('../config/db');
const PrestamoEquipo = {
  async create({ id_cliente, equipo, estado_entrega, cantidad }) {
    console.log("model.js: cliente:"+id_cliente+" equipo:"+equipo+" estado:"+estado_entrega+" cantidad:"+cantidad);
    const result = await pool.query(
      `INSERT INTO prestamo_equipo (id_cliente, equipo, estado_entrega, cantidad)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_cliente, equipo, estado_entrega, cantidad]
    );
    return result.rows[0];
  },

  async update(id, { equipo, estado_entrega, estado_devolucion, fecha_devolucion, cantidad,estado_prestamo }) {
    const result = await pool.query(
      `UPDATE prestamo_equipo
       SET equipo = $1, estado_entrega = $2, estado_devolucion = $3, fecha_devolucion = $4, cantidad = $5,estado_prestamo =$6
       WHERE id = $7 RETURNING *`,
      [equipo, estado_entrega, estado_devolucion, fecha_devolucion, cantidad,estado_prestamo, id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await pool.query(
      `SELECT pe.*, u.nombre AS cliente_nombre
       FROM prestamo_equipo pe
       JOIN usuarios u ON u.id = pe.id_cliente
       ORDER BY pe.id DESC`
    );
    return result.rows;
  },

  async findById(id) {
    const result = await pool.query(
      `SELECT pe.*, u.nombre AS cliente_nombre
       FROM prestamo_equipo pe
       JOIN usuarios u ON u.id = pe.id_cliente
       WHERE pe.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const result = await pool.query(
      `DELETE FROM prestamo_equipo WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
};

module.exports = PrestamoEquipo;
