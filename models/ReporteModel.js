const pool = require('../config/db');

class ReporteModel {
  static async getConductorById(conductorId) {
    const res = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
      [conductorId]
    );
    return res.rows.length ? res.rows[0] : null;
  }

  static async getPedidosDia(conductorId) {
    const res = await pool.query(`
      SELECT p.id AS pedido_id, p.usuario_id AS cliente_id, u.nombre AS cliente_nombre,
             p.monto_total, p.monto_pendiente, p.monto_pagado
      FROM pedidos p
      JOIN usuarios u ON u.id = p.usuario_id AND u.tipo_usuario = 'cliente'
      WHERE p.id_conductor = $1
        AND p.estado IN ('entregado','completado')
        AND p.fecha_entrega::date = CURRENT_DATE
      ORDER BY p.id
    `, [conductorId]);
    return res.rows;
  }

  static async getProductosPorPedidos(pedidoIds) {
    const res = await pool.query(`
      SELECT pd.pedido_id, pr.idproducto AS producto_id, pr.nombre AS producto_nombre,
             pd.cantidad, pd.preciounitario, (pd.cantidad * pd.preciounitario) AS subtotal
      FROM pedidoproducto pd
      JOIN productos pr ON pr.idproducto = pd.producto_id
      WHERE pd.pedido_id = ANY($1)
    `, [pedidoIds]);

    const map = {};
    res.rows.forEach(pr => {
      if (!map[pr.pedido_id]) map[pr.pedido_id] = [];
      map[pr.pedido_id].push(pr);
    });
    return map;
  }

  static async getPagosPorPedidos(pedidoIds) {
    const res = await pool.query(`
      SELECT pedido_id, metodo_pago, SUM(monto_pagado) AS total
      FROM pagos_pedido
      WHERE pedido_id = ANY($1)
      GROUP BY pedido_id, metodo_pago
    `, [pedidoIds]);

    const map = {};
    res.rows.forEach(pg => {
      if (!map[pg.pedido_id]) map[pg.pedido_id] = { efectivo: 0, qr: 0 };
      if (pg.metodo_pago.toLowerCase() === 'efectivo') map[pg.pedido_id].efectivo = parseFloat(pg.total);
      if (pg.metodo_pago.toLowerCase() === 'qr') map[pg.pedido_id].qr = parseFloat(pg.total);
    });
    return map;
  }
}

module.exports = ReporteModel;
