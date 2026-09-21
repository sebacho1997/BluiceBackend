const pool = require('../config/db');

const DevolucionEquipo = {
  async crear({ id_movimiento, id_conductor, id_cliente, estado_devolucion }) {
    const result = await pool.query(
      `INSERT INTO devolucion_equipo (id_movimiento, id_conductor, id_cliente, estado_devolucion)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_movimiento, id_conductor, id_cliente, estado_devolucion || '']
    );
    return result.rows[0];
  },

  async findByConductor(idConductor) {
    const result = await pool.query(
      `SELECT de.*, 
              me.id_equipo, me.cantidad, me.tipo,
              e.nombre AS equipo_nombre, e.descripcion AS equipo_descripcion,
              u.nombre AS cliente_nombre
       FROM devolucion_equipo de
       JOIN movimiento_equipos me ON me.id = de.id_movimiento
       JOIN equipos e ON e.id = me.id_equipo
       JOIN usuarios u ON u.id = de.id_cliente
       WHERE de.id_conductor = $1
       ORDER BY de.fecha_devolucion DESC`,
      [idConductor]
    );
    return result.rows;
  },

  async findByMovimiento(idMovimiento) {
    const result = await pool.query(
      `SELECT * FROM devolucion_equipo WHERE id_movimiento = $1`,
      [idMovimiento]
    );
    return result.rows[0] || null;
  },

  async findAll() {
    const result = await pool.query(
      `SELECT de.*,
              me.id_equipo, me.cantidad, me.tipo,
              e.nombre AS equipo_nombre, e.descripcion AS equipo_descripcion,
              c.nombre AS conductor_nombre,
              u.nombre AS cliente_nombre
       FROM devolucion_equipo de
       JOIN movimiento_equipos me ON me.id = de.id_movimiento
       JOIN equipos e ON e.id = me.id_equipo
       JOIN usuarios c ON c.id = de.id_conductor
       JOIN usuarios u ON u.id = de.id_cliente
       ORDER BY de.fecha_devolucion DESC`
    );
    return result.rows;
  },
};

module.exports = DevolucionEquipo;
