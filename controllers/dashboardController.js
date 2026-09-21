const pool = require('../config/db');

const ALLOWED_STATES = [
  'pendiente', 'asignado', 'parcial', 'pagado',
  'entregado', 'completado', 'cancelado'
];
const ALLOWED_TYPES = ['particular', 'contrato', 'boliche'];

function safeInt(val) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

function run(fn) {
  const params = [];
  const q = (val) => { params.push(val); return `$${params.length}`; };
  const sql = fn(q);
  return pool.query(sql, params);
}

const DashboardController = {
  async getDashboardData(req, res) {
    try {
      const { desde, hasta, conductor, estado, tipo, cliente } = req.query;

      const cC = conductor ? safeInt(conductor) : null;
      const cL = cliente ? safeInt(cliente) : null;
      const cE = estado && ALLOWED_STATES.includes(estado) ? estado : null;
      const cT = tipo && ALLOWED_TYPES.includes(tipo) ? tipo : null;

      const hoy = desde || null;
      const aI = "date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date";
      const aF = "(date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date";

      function dateRange(q, desde, hasta) {
        const SQL_DEFAULT_I = "date_trunc('month', CURRENT_DATE)::date";
        const SQL_DEFAULT_F = 'CURRENT_DATE::date';
        const desdeSQL = desde ? q(desde) : SQL_DEFAULT_I;
        const hastaSQL = hasta ? q(hasta) : SQL_DEFAULT_F;
        return { desdeSQL, hastaSQL };
      }

      function semanaRange(q, desde, hasta) {
        const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
        if (desde) {
          return { semanaSQL: `(${desdeSQL}::date - INTERVAL '6 days')::date`, hastaSQL };
        }
        return { semanaSQL: `(date_trunc('month', CURRENT_DATE)::date - INTERVAL '6 days')::date`, hastaSQL };
      }

      function pCond(q) {
        const c = [];
        if (cC) c.push(`p.id_conductor = ${q(cC)}`);
        if (cL) c.push(`p.usuario_id = ${q(cL)}`);
        if (cT) c.push(`p.tipo = ${q(cT)}`);
        return c.length ? 'AND ' + c.join(' AND ') : '';
      }

      const [r0,r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,r12,r13,r14,r15,r16,r17,r18,r19,r20] =
        await Promise.all([
          run(q => `SELECT COALESCE(SUM(p.monto_total),0)::float AS total
                    FROM pedidos p
                    WHERE p.estado IN ('entregado','completado')
                      AND p.fecha_entrega::date = ${hoy ? q(hoy) : 'CURRENT_DATE'}
                      ${pCond(q)}`),

          run(q => `SELECT COUNT(*)::int AS count
                    FROM pedidos p
                    WHERE p.estado = 'pendiente' ${pCond(q)}`),

          run(q => `SELECT COUNT(DISTINCT p.usuario_id)::int AS clients,
                           COALESCE(SUM(p.monto_pendiente),0)::float AS total_deuda
                    FROM pedidos p
                    JOIN usuarios u ON u.id = p.usuario_id
                    WHERE p.monto_pendiente > 0 AND COALESCE(u.su,false) = false
                      ${cC ? `AND p.id_conductor = ${q(cC)}` : ''}
                      ${cL ? `AND p.usuario_id = ${q(cL)}` : ''}`),

          run(q => {
            const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
            return `SELECT pr.nombre,
                           SUM(pd.cantidad)::int AS cantidad,
                           SUM(pd.cantidad * pd.preciounitario)::float AS total_bs
                    FROM pedidoproducto pd
                    JOIN productos pr ON pr.idproducto = pd.producto_id
                    JOIN pedidos p ON p.id = pd.pedido_id
                    WHERE p.estado IN ('entregado','completado')
                      AND p.fecha_entrega::date BETWEEN ${desdeSQL} AND ${hastaSQL}
                      ${pCond(q)}
                    GROUP BY pr.nombre ORDER BY cantidad DESC LIMIT 10`;
          }),

          run(q => {
            const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
            return `SELECT COALESCE(SUM(p.monto_total),0)::float AS total
                    FROM pedidos p
                    WHERE p.estado IN ('entregado','completado')
                      AND p.fecha_entrega::date BETWEEN ${desdeSQL} AND ${hastaSQL}
                      ${pCond(q)}`;
          }),

          run(q => {
            const { semanaSQL, hastaSQL } = semanaRange(q, desde, hasta);
            return `SELECT p.fecha_entrega::date AS dia,
                           COALESCE(SUM(p.monto_total),0)::float AS total
                    FROM pedidos p
                    WHERE p.estado IN ('entregado','completado')
                      AND p.fecha_entrega::date BETWEEN ${semanaSQL} AND ${hastaSQL}
                      ${pCond(q)}
                    GROUP BY p.fecha_entrega::date ORDER BY dia`;
          }),

          run(q => {
            const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
            return `SELECT p.estado, COUNT(*)::int AS count
                    FROM pedidos p
                    WHERE p.fecha_entrega::date BETWEEN ${desdeSQL} AND ${hastaSQL}
                      ${cC ? `AND p.id_conductor = ${q(cC)}` : ''}
                      ${cT ? `AND p.tipo = ${q(cT)}` : ''}
                    GROUP BY p.estado ORDER BY count DESC`;
          }),

          pool.query(`SELECT idproducto, nombre, cantidad
                      FROM productos WHERE cantidad < 10 AND estado = true
                      ORDER BY cantidad LIMIT 20`),

          pool.query(`SELECT COALESCE(SUM(monto_total),0)::float AS total
                      FROM pedidos
                      WHERE estado IN ('entregado','completado')
                        AND fecha_entrega::date BETWEEN ${aI} AND ${aF}`),

          run(q => {
            const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
            return `SELECT u.id, u.nombre, u.telefono,
                           COUNT(p.id)::int AS pedidos,
                           COALESCE(SUM(p.monto_total),0)::float AS total_gastado
                    FROM usuarios u
                    JOIN pedidos p ON p.usuario_id = u.id
                    WHERE p.estado IN ('entregado','completado')
                      AND COALESCE(u.su,false) = false
                      AND p.fecha_entrega::date BETWEEN ${desdeSQL} AND ${hastaSQL}
                      ${cC ? `AND p.id_conductor = ${q(cC)}` : ''}
                      ${cT ? `AND p.tipo = ${q(cT)}` : ''}
                    GROUP BY u.id, u.nombre, u.telefono
                    ORDER BY total_gastado DESC LIMIT 5`;
          }),

          run(q => `SELECT COUNT(*)::int AS count
                    FROM pedidos p
                    WHERE p.estado IN ('entregado','completado')
                      AND p.fecha_entrega::date = ${hoy ? q(hoy) : 'CURRENT_DATE'}
                      ${cC ? `AND p.id_conductor = ${q(cC)}` : ''}`),

          run(q => `SELECT COALESCE(SUM(g.monto),0)::float AS total
                    FROM gastos_dia g
                    WHERE DATE(g.fecha_gasto) = ${hoy ? q(hoy) : 'CURRENT_DATE'}
                      ${cC ? `AND g.id_conductor = ${q(cC)}` : ''}`),

          run(q => {
            const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
            return `SELECT COALESCE(SUM(g.monto),0)::float AS total
                    FROM gastos_dia g
                    WHERE DATE(g.fecha_gasto) BETWEEN ${desdeSQL} AND ${hastaSQL}
                      ${cC ? `AND g.id_conductor = ${q(cC)}` : ''}`;
          }),

          run(q => {
            const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
            return `SELECT u.nombre AS conductor,
                           COUNT(g.id)::int AS cantidad,
                           COALESCE(SUM(g.monto),0)::float AS total
                    FROM gastos_dia g
                    JOIN usuarios u ON u.id = g.id_conductor
                    WHERE DATE(g.fecha_gasto) BETWEEN ${desdeSQL} AND ${hastaSQL}
                      ${cC ? `AND g.id_conductor = ${q(cC)}` : ''}
                    GROUP BY u.nombre ORDER BY total DESC`;
          }),

          run(q => {
            const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
            const c = [];
            if (cC) c.push(`me.id_conductor = ${q(cC)}`);
            if (cL) c.push(`me.id_cliente = ${q(cL)}`);
            const w = c.length ? 'WHERE ' + c.join(' AND ') : '';
            return `SELECT COUNT(*)::int AS total,
                           COUNT(*) FILTER (WHERE me.tipo = 'venta') AS ventas,
                           COUNT(*) FILTER (WHERE me.tipo = 'prestamo') AS prestamos,
                           COALESCE(SUM(me.monto) FILTER (WHERE me.tipo = 'venta'),0)::float AS ingresos_ventas,
                           COALESCE(SUM(me.monto_garantia) FILTER (WHERE me.tipo = 'prestamo'),0)::float AS total_garantias
                    FROM movimiento_equipos me
                    ${w}
                    ${w ? 'AND' : 'WHERE'} me.fecha_registro::date BETWEEN ${desdeSQL} AND ${hastaSQL}`;
          }),

          run(q => {
            const { desdeSQL, hastaSQL } = dateRange(q, desde, hasta);
            const c = [];
            if (cC) c.push(`me.id_conductor = ${q(cC)}`);
            if (cL) c.push(`me.id_cliente = ${q(cL)}`);
            const w = c.length ? 'WHERE ' + c.join(' AND ') : '';
            return `SELECT e.nombre AS equipo,
                           COUNT(*)::int AS cantidad,
                           COALESCE(SUM(me.monto),0)::float AS total
                    FROM movimiento_equipos me
                    JOIN equipos e ON e.id = me.id_equipo
                    ${w}
                    ${w ? 'AND' : 'WHERE'} me.tipo = 'venta'
                    AND me.fecha_registro::date BETWEEN ${desdeSQL} AND ${hastaSQL}
                    GROUP BY e.nombre ORDER BY total DESC LIMIT 5`;
          }),

          run(q => `SELECT COUNT(*)::int AS prestamos_activos,
                           COALESCE(SUM(me.monto_garantia),0)::float AS total_garantias
                    FROM movimiento_equipos me
                    WHERE me.tipo = 'prestamo' AND me.estado NOT IN ('devuelto')
                      ${cC ? `AND me.id_conductor = ${q(cC)}` : ''}
                      ${cL ? `AND me.id_cliente = ${q(cL)}` : ''}`),

          run(q => {
            const c = [`c.estado != 'finalizado'`];
            if (cC) c.push(`c.conductor_id = ${q(cC)}`);
            if (cL) c.push(`c.cliente_id = ${q(cL)}`);
            return `SELECT COUNT(*)::int AS contratos,
                           COALESCE(SUM(c.monto_total),0)::float AS total_contratos,
                           COALESCE(SUM(c.monto_restante),0)::float AS saldo_pendiente
                    FROM contratos c WHERE ${c.join(' AND ')}`;
          }),

          run(q => `SELECT COUNT(*)::int AS consumos,
                           COALESCE(SUM(cc.monto_consumido),0)::float AS total_consumido
                    FROM consumos_contrato cc
                    JOIN contratos c ON c.id = cc.contrato_id
                    WHERE cc.observaciones = 'entregado'
                      ${cC ? `AND c.conductor_id = ${q(cC)}` : ''}
                      ${cL ? `AND c.cliente_id = ${q(cL)}` : ''}`),

          pool.query(`SELECT COUNT(*)::int AS abiertos
                      FROM inventario_conductor WHERE estado = 'creado'`),

          run(q => `SELECT p.id AS pedido_id, p.nro_pedido, p.estado, p.tipo,
                           p.monto_total, p.monto_pendiente, p.fecha_entrega,
                           u.nombre AS cliente_nombre, c.nombre AS conductor_nombre
                    FROM pedidos p
                    JOIN usuarios u ON u.id = p.usuario_id
                    LEFT JOIN usuarios c ON c.id = p.id_conductor
                    WHERE p.estado NOT IN ('completado', 'cancelado')
                      ${cC ? `AND p.id_conductor = ${q(cC)}` : ''}
                      ${cL ? `AND p.usuario_id = ${q(cL)}` : ''}
                      ${cT ? `AND p.tipo = ${q(cT)}` : ''}
                      ${cE ? `AND p.estado = ${q(cE)}` : ''}
                    ORDER BY p.fecha_entrega DESC LIMIT 15`),
        ]);

      const ventasActual = parseFloat(r4.rows[0]?.total) || 0;
      const ventasAnterior = parseFloat(r8.rows[0]?.total) || 0;
      const variacion = ventasAnterior > 0
        ? ((ventasActual - ventasAnterior) / ventasAnterior) * 100
        : (ventasActual > 0 ? 100 : 0);

      const filtros = {};
      if (desde) filtros.desde = desde;
      if (hasta) filtros.hasta = hasta;
      if (conductor) filtros.conductor = Number(conductor);
      if (estado) filtros.estado = estado;
      if (tipo) filtros.tipo = tipo;
      if (cliente) filtros.cliente = Number(cliente);

      res.json({
        filtros_aplicados: filtros,
        ventas_hoy: parseFloat(r0.rows[0]?.total) || 0,
        pedidos_pendientes: r1.rows[0]?.count || 0,
        deudores: {
          clientes: r2.rows[0]?.clients || 0,
          total_deuda: parseFloat(r2.rows[0]?.total_deuda) || 0,
        },
        productos_top: r3.rows,
        ingresos_mes: ventasActual,
        ventas_semana: r5.rows,
        pedidos_por_estado: r6.rows,
        stock_bajo: r7.rows,
        vs_mes_anterior: {
          ventas_actual: ventasActual,
          ventas_anterior: ventasAnterior,
          variacion_porcentaje: Math.round(variacion * 100) / 100,
        },
        clientes_top: r9.rows,
        pedidos_completados_hoy: r10.rows[0]?.count || 0,
        gastos_hoy: parseFloat(r11.rows[0]?.total) || 0,
        gastos_mes: parseFloat(r12.rows[0]?.total) || 0,
        gastos_por_conductor: r13.rows,
        equipos: {
          resumen: r14.rows[0] || {},
          top_ventas: r15.rows,
          prestamos_activos: {
            cantidad: r16.rows[0]?.prestamos_activos || 0,
            total_garantias: parseFloat(r16.rows[0]?.total_garantias) || 0,
          },
        },
        contratos: {
          activos: r17.rows[0] || {},
          consumos: r18.rows[0] || {},
        },
        inventario: {
          abiertos: r19.rows[0]?.abiertos || 0,
        },
        pedidos_activos: r20.rows,
      });
    } catch (error) {
      console.error('Error en dashboard:', error);
      res.status(500).json({ error: 'Error al obtener datos del dashboard' });
    }
  },
};

module.exports = DashboardController;
