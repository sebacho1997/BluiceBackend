const pool = require('../config/db');

const Notificacion = {
  async listar({ afterId = 0, limite = 50, recientesMinutos = 10 } = {}) {
    const maxRes = await pool.query(
      'SELECT COALESCE(MAX(id), 0) AS max_id FROM notificaciones_admin'
    );
    const maxId = Number(maxRes.rows[0]?.max_id || 0);

    if (!afterId) {
      const desde = new Date(Date.now() - recientesMinutos * 60 * 1000);
      const result = await pool.query(
        `SELECT n.id, n.pedido_id, n.titulo, n.mensaje, n.created_at,
                p.estado, p.tipo, p.usuario_id,
                u.nombre AS cliente_nombre
         FROM notificaciones_admin n
         LEFT JOIN pedidos p ON p.id = n.pedido_id
         LEFT JOIN usuarios u ON u.id = p.usuario_id
         WHERE n.created_at >= $1
         ORDER BY n.id ASC
         LIMIT $2`,
        [desde, limite]
      );

      const ultimoId = result.rows.length
        ? Number(result.rows[result.rows.length - 1].id)
        : maxId;

      return { notificaciones: result.rows, lastId: ultimoId };
    }

    const result = await pool.query(
      `SELECT n.id, n.pedido_id, n.titulo, n.mensaje, n.created_at,
              p.estado, p.tipo, p.usuario_id,
              u.nombre AS cliente_nombre
       FROM notificaciones_admin n
       LEFT JOIN pedidos p ON p.id = n.pedido_id
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE n.id > $1
       ORDER BY n.id ASC
       LIMIT $2`,
      [afterId, limite]
    );

    const ultimoId = result.rows.length
      ? Number(result.rows[result.rows.length - 1].id)
      : Number(afterId);

    return { notificaciones: result.rows, lastId: ultimoId };
  },

  async limpiarAntiguas(dias = 30) {
    const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    await pool.query(
      'DELETE FROM notificaciones_admin WHERE created_at < $1',
      [corte]
    );
  },
};

module.exports = Notificacion;
