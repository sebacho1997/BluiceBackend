const pool = require('../config/db');

const ReconciliacionController = {
  async getReconciliacion(req, res) {
    try {
      const { fecha } = req.query;
      const fechaFiltro = fecha
        ? `p.fecha_entrega::date = '${fecha}'::date`
        : 'p.fecha_entrega::date = CURRENT_DATE';

      const conductores = await pool.query(
        `SELECT id, nombre FROM usuarios WHERE tipo_usuario = 'conductor' AND activado = true ORDER BY nombre`
      );

      const resultado = [];

      for (const conductor of conductores.rows) {
        const pedidos = await pool.query(
          `SELECT p.id, p.nro_pedido, p.monto_total, p.monto_pagado, p.monto_pendiente,
                  p.estado, p.fecha_entrega, u.nombre AS cliente_nombre
           FROM pedidos p
           JOIN usuarios u ON u.id = p.usuario_id
           WHERE p.id_conductor = $1
             AND ${fechaFiltro}
             AND p.estado IN ('entregado', 'completado', 'pagado')
             AND COALESCE(u.su, false) = false
           ORDER BY p.fecha_entrega`,
          [conductor.id]
        );

        const pedidoIds = pedidos.rows.map(p => p.id);
        if (pedidoIds.length === 0) {
          resultado.push({
            conductor: { id: conductor.id, nombre: conductor.nombre },
            total_ventas: 0,
            total_cobrado: 0,
            total_efectivo: 0,
            total_qr: 0,
            total_otros: 0,
            total_pendiente: 0,
            diferencia: 0,
            pedidos: [],
          });
          continue;
        }

        const pagos = await pool.query(
          `SELECT pedido_id, metodo_pago, SUM(monto_pagado) AS total
           FROM pagos_pedido
           WHERE pedido_id = ANY($1::int[])
           GROUP BY pedido_id, metodo_pago`,
          [pedidoIds]
        );

        const pagosPorPedido = {};
        let totalEfectivo = 0;
        let totalQr = 0;
        let totalOtros = 0;

        for (const pago of pagos.rows) {
          const pid = pago.pedido_id;
          if (!pagosPorPedido[pid]) pagosPorPedido[pid] = {};
          const monto = parseFloat(pago.total) || 0;
          pagosPorPedido[pid][pago.metodo_pago] = monto;
          if (pago.metodo_pago === 'efectivo') totalEfectivo += monto;
          else if (pago.metodo_pago === 'qr') totalQr += monto;
          else totalOtros += monto;
        }

        let totalVentas = 0;
        let totalCobrado = 0;
        let totalPendiente = 0;

        const pedidosData = pedidos.rows.map(p => {
          const venta = parseFloat(p.monto_total) || 0;
          const cobrado = parseFloat(p.monto_pagado) || 0;
          const pendiente = parseFloat(p.monto_pendiente) || 0;
          totalVentas += venta;
          totalCobrado += cobrado;
          totalPendiente += pendiente;

          return {
            id: p.id,
            nro_pedido: p.nro_pedido,
            cliente: p.cliente_nombre,
            estado: p.estado,
            fecha_entrega: p.fecha_entrega,
            total: venta,
            cobrado,
            pendiente,
            pagos: pagosPorPedido[p.id] || {},
          };
        });

        resultado.push({
          conductor: { id: conductor.id, nombre: conductor.nombre },
          total_ventas: totalVentas,
          total_cobrado: totalCobrado,
          total_efectivo: totalEfectivo,
          total_qr: totalQr,
          total_otros: totalOtros,
          total_pendiente: totalPendiente,
          diferencia: totalVentas - totalCobrado,
          pedidos: pedidosData,
        });
      }

      res.json({
        fecha: fecha || new Date().toISOString().split('T')[0],
        conductores: resultado,
      });
    } catch (error) {
      console.error('Error en reconciliacion:', error);
      res.status(500).json({ error: 'Error al obtener datos de reconciliacion' });
    }
  },
};

module.exports = ReconciliacionController;
