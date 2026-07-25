const pool = require('../config/db');

const DashboardController = {
  async getDashboardData(req, res) {
    try {
      const { desde, hasta } = req.query;

      // Build date helpers
      const fechaHoy = desde ? `'${desde}'::date` : 'CURRENT_DATE';
      const fechaInicioMes = desde ? `'${desde}'::date` : "date_trunc('month', CURRENT_DATE)";
      const fechaFinMes = hasta ? `'${hasta}'::date` : 'CURRENT_DATE';
      const mesAnteriorInicio = "date_trunc('month', CURRENT_DATE - INTERVAL '1 month')";
      const mesAnteriorFin = "date_trunc('month', CURRENT_DATE) - INTERVAL '1 day'";

      const sql = (strs, ...vals) => {
        let r = strs[0];
        for (let i = 0; i < vals.length; i++) r += vals[i] + strs[i + 1];
        return r;
      };

      const [ventasHoy, pendientes, deudores, productosTop, ingresosMes,
             ventasSemana, pedidosPorEstado, stockBajo,
             ventasMesAnterior, clientesTop, completadosHoy,
             gastosHoy, gastosMes, gastosPorConductor] =
        await Promise.all([
          pool.query(sql`
            SELECT COALESCE(SUM(monto_total), 0) AS total
            FROM pedidos
            WHERE estado IN ('entregado','completado')
              AND fecha_entrega::date = ${fechaHoy}
          `),
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
          pool.query(sql`
            SELECT pr.nombre,
                   SUM(pd.cantidad)::int AS cantidad,
                   SUM(pd.cantidad * pd.preciounitario)::float AS total_bs
            FROM pedidoproducto pd
            JOIN productos pr ON pr.idproducto = pd.producto_id
            JOIN pedidos p ON p.id = pd.pedido_id
            WHERE p.estado IN ('entregado','completado')
              AND p.fecha_entrega::date BETWEEN ${fechaInicioMes} AND ${fechaFinMes}
            GROUP BY pr.nombre
            ORDER BY cantidad DESC
            LIMIT 10
          `),
          pool.query(sql`
            SELECT COALESCE(SUM(monto_total)::float, 0) AS total
            FROM pedidos
            WHERE estado IN ('entregado','completado')
              AND fecha_entrega::date BETWEEN ${fechaInicioMes} AND ${fechaFinMes}
          `),
          pool.query(sql`
            SELECT fecha_entrega::date AS dia,
                   COALESCE(SUM(monto_total)::float, 0) AS total
            FROM pedidos
            WHERE estado IN ('entregado','completado')
              AND fecha_entrega >= ${fechaInicioMes} - INTERVAL '6 days'
              AND fecha_entrega::date <= ${fechaFinMes}
            GROUP BY fecha_entrega::date
            ORDER BY dia
          `),
          pool.query(
            `SELECT estado, COUNT(*)::int AS count
             FROM pedidos
             GROUP BY estado
             ORDER BY count DESC`
          ),
          pool.query(
            `SELECT idproducto, nombre, cantidad
             FROM productos
             WHERE cantidad < 10 AND estado = true
             ORDER BY cantidad
             LIMIT 20`
          ),
          pool.query(sql`
            SELECT COALESCE(SUM(monto_total)::float, 0) AS total
            FROM pedidos
            WHERE estado IN ('entregado','completado')
              AND fecha_entrega::date BETWEEN ${mesAnteriorInicio} AND ${mesAnteriorFin}
          `),
          pool.query(sql`
            SELECT u.id, u.nombre, u.telefono,
                   COUNT(p.id)::int AS pedidos,
                   COALESCE(SUM(p.monto_total), 0) AS total_gastado
            FROM usuarios u
            JOIN pedidos p ON p.usuario_id = u.id
            WHERE p.estado IN ('entregado','completado')
              AND COALESCE(u.su, false) = false
              AND p.fecha_entrega::date BETWEEN ${fechaInicioMes} AND ${fechaFinMes}
            GROUP BY u.id, u.nombre, u.telefono
            ORDER BY total_gastado DESC
            LIMIT 5
          `),
          pool.query(sql`
            SELECT COUNT(*)::int AS count
            FROM pedidos
            WHERE estado IN ('entregado','completado')
              AND fecha_entrega::date = ${fechaHoy}
          `),
          pool.query(sql`
            SELECT COALESCE(SUM(monto)::float, 0) AS total
            FROM gastos_dia
            WHERE DATE(fecha_gasto) = ${fechaHoy}
          `),
          pool.query(sql`
            SELECT COALESCE(SUM(monto)::float, 0) AS total
            FROM gastos_dia
            WHERE DATE(fecha_gasto) BETWEEN ${fechaInicioMes} AND ${fechaFinMes}
          `),
          pool.query(sql`
            SELECT u.nombre AS conductor,
                   COUNT(g.id)::int AS cantidad,
                   COALESCE(SUM(g.monto)::float, 0) AS total
            FROM gastos_dia g
            JOIN usuarios u ON u.id = g.id_conductor
            WHERE DATE(g.fecha_gasto) BETWEEN ${fechaInicioMes} AND ${fechaFinMes}
            GROUP BY u.nombre
            ORDER BY total DESC
          `),
        ]);

      const ventasActual = parseFloat(ingresosMes.rows[0].total) || 0;
      const ventasAnterior = parseFloat(ventasMesAnterior.rows[0].total) || 0;
      const variacion = ventasAnterior > 0
        ? ((ventasActual - ventasAnterior) / ventasAnterior) * 100
        : (ventasActual > 0 ? 100 : 0);

      res.json({
        ventas_hoy: parseFloat(ventasHoy.rows[0].total) || 0,
        pedidos_pendientes: pendientes.rows[0].count,
        deudores: {
          clientes: deudores.rows[0].clientes,
          total_deuda: parseFloat(deudores.rows[0].total_deuda) || 0,
        },
        productos_top: productosTop.rows,
        ingresos_mes: ventasActual,
        ventas_semana: ventasSemana.rows,
        pedidos_por_estado: pedidosPorEstado.rows,
        stock_bajo: stockBajo.rows,
        vs_mes_anterior: {
          ventas_actual: ventasActual,
          ventas_anterior: ventasAnterior,
          variacion_porcentaje: Math.round(variacion * 100) / 100,
        },
        clientes_top: clientesTop.rows,
        pedidos_completados_hoy: completadosHoy.rows[0].count,
        gastos_hoy: parseFloat(gastosHoy.rows[0].total) || 0,
        gastos_mes: parseFloat(gastosMes.rows[0].total) || 0,
        gastos_por_conductor: gastosPorConductor.rows,
      });
    } catch (error) {
      console.error('Error en dashboard:', error);
      res.status(500).json({ error: 'Error al obtener datos del dashboard' });
    }
  },
};

module.exports = DashboardController;
