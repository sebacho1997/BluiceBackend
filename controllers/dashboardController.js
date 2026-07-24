const pool = require('../config/db');

const DashboardController = {
  async getDashboardData(req, res) {
    try {
      const [ventasHoy, pendientes, deudores, productosTop, ingresosMes] =
        await Promise.all([
          pool.query(
            `SELECT COALESCE(SUM(monto_total), 0) AS total
             FROM pedidos
             WHERE estado IN ('entregado','completado')
               AND fecha_entrega::date = CURRENT_DATE`
          ),
          pool.query(
            `SELECT COUNT(*)::int AS count
             FROM pedidos
             WHERE estado = 'pendiente'`
          ),
          pool.query(
            `SELECT COUNT(DISTINCT u.id)::int AS clientes,
                    COALESCE(SUM(p.monto_pendiente), 0) AS total_deuda
             FROM pedidos p
             JOIN usuarios u ON u.id = p.usuario_id
             WHERE p.monto_pendiente > 0
               AND COALESCE(u.su, false) = false`
          ),
          pool.query(
            `SELECT pr.nombre,
                    SUM(pd.cantidad)::int AS cantidad,
                    SUM(pd.cantidad * pd.preciounitario)::float AS total_bs
             FROM pedidoproducto pd
             JOIN productos pr ON pr.idproducto = pd.producto_id
             JOIN pedidos p ON p.id = pd.pedido_id
             WHERE p.estado IN ('entregado','completado')
             GROUP BY pr.nombre
             ORDER BY cantidad DESC
             LIMIT 10`
          ),
          pool.query(
            `SELECT COALESCE(SUM(monto_total), 0) AS total
             FROM pedidos
             WHERE estado IN ('entregado','completado')
               AND TO_CHAR(fecha_entrega, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')`
          ),
        ]);

      res.json({
        ventas_hoy: parseFloat(ventasHoy.rows[0].total) || 0,
        pedidos_pendientes: pendientes.rows[0].count,
        deudores: {
          clientes: deudores.rows[0].clientes,
          total_deuda: parseFloat(deudores.rows[0].total_deuda) || 0,
        },
        productos_top: productosTop.rows,
        ingresos_mes: parseFloat(ingresosMes.rows[0].total) || 0,
      });
    } catch (error) {
      console.error('Error en dashboard:', error);
      res.status(500).json({ error: 'Error al obtener datos del dashboard' });
    }
  },
};

module.exports = DashboardController;
