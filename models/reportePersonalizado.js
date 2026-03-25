const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const {
  createPrinter,
  formatCurrency,
  formatDate,
  buildSummaryTable,
  buildDataTable,
  buildDocDefinition,
  sectionTitle
} = require('./reportPdfUtils');

router.get('/reporte-detalle-personalizado/:conductorId/:startDate/:endDate', async (req, res) => {
  const { conductorId, startDate, endDate } = req.params;
  const printer = createPrinter();

  try {
    const conductorRes = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
      [conductorId]
    );
    const conductorNombre = conductorRes.rows.length ? conductorRes.rows[0].nombre : 'Desconocido';

    const pedidosRes = await pool.query(
      `SELECT p.id AS pedido_id, u.nombre AS cliente_nombre, p.fecha_entrega::date AS fecha_entrega
       FROM pedidos p
       JOIN usuarios u ON u.id = p.usuario_id AND u.tipo_usuario = 'cliente'
       WHERE p.id_conductor = $1
         AND COALESCE(u.su, false) = false
         AND p.estado IN ('entregado', 'completado')
         AND p.fecha_entrega::date BETWEEN $2 AND $3
       ORDER BY p.fecha_entrega, p.id`,
      [conductorId, startDate, endDate]
    );

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send('No hay pedidos para este conductor en ese rango');
    }

    const pedidoIds = pedidos.map((p) => p.pedido_id);

    const productosRes = await pool.query(
      `SELECT pd.pedido_id, pd.cantidad, pd.preciounitario, (pd.cantidad * pd.preciounitario) AS subtotal
       FROM pedidoproducto pd
       WHERE pd.pedido_id = ANY($1)`,
      [pedidoIds]
    );

    const pagosRes = await pool.query(
      `SELECT pedido_id, metodo_pago, SUM(monto_pagado) AS total
       FROM pagos_pedido
       WHERE pedido_id = ANY($1)
       GROUP BY pedido_id, metodo_pago`,
      [pedidoIds]
    );

    const gastosRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_gastos
       FROM gastos_dia
       WHERE id_conductor = $1
         AND fecha_gasto::date BETWEEN $2 AND $3`,
      [conductorId, startDate, endDate]
    );

    const productosMap = {};
    const pagosMap = {};
    const resumenPorDia = {};

    productosRes.rows.forEach((row) => {
      if (!productosMap[row.pedido_id]) productosMap[row.pedido_id] = [];
      productosMap[row.pedido_id].push({
        cantidad: Number(row.cantidad || 0),
        preciounitario: Number(row.preciounitario || 0),
        subtotal: Number(row.subtotal || 0)
      });
    });

    pagosRes.rows.forEach((row) => {
      if (!pagosMap[row.pedido_id]) pagosMap[row.pedido_id] = { efectivo: 0, qr: 0 };
      if ((row.metodo_pago || '').toLowerCase() === 'efectivo') pagosMap[row.pedido_id].efectivo = Number(row.total || 0);
      if ((row.metodo_pago || '').toLowerCase() === 'qr') pagosMap[row.pedido_id].qr = Number(row.total || 0);
    });

    const enrichedPedidos = pedidos.map((pedido) => {
      const productos = productosMap[pedido.pedido_id] || [];
      const pago = pagosMap[pedido.pedido_id] || { efectivo: 0, qr: 0 };
      const totalPedido = productos.reduce((sum, producto) => sum + producto.subtotal, 0);
      const pendientePedido = Math.max(totalPedido - (pago.efectivo + pago.qr), 0);
      const dayKey = pedido.fecha_entrega.toISOString().split('T')[0];

      if (!resumenPorDia[dayKey]) {
        resumenPorDia[dayKey] = { pedidos: 0, ventas: 0, cobrado: 0, pendiente: 0 };
      }
      resumenPorDia[dayKey].pedidos += 1;
      resumenPorDia[dayKey].ventas += totalPedido;
      resumenPorDia[dayKey].cobrado += pago.efectivo + pago.qr;
      resumenPorDia[dayKey].pendiente += pendientePedido;

      return { ...pedido, totalPedido, pendientePedido, pago };
    });

    const totalVentas = enrichedPedidos.reduce((sum, pedido) => sum + pedido.totalPedido, 0);
    const totalCobrado = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pago.efectivo + pedido.pago.qr, 0);
    const totalEfectivo = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pago.efectivo, 0);
    const pendienteCobro = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pendientePedido, 0);
    const totalGastos = Number(gastosRes.rows[0].total_gastos || 0);
    const diasConActividad = Object.keys(resumenPorDia).length;
    const promedioDia = diasConActividad ? totalVentas / diasConActividad : 0;
    const promedioPedido = totalVentas / enrichedPedidos.length;

    const resumenRows = Object.entries(resumenPorDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, data]) => [
        formatDate(day),
        String(data.pedidos),
        formatCurrency(data.ventas),
        formatCurrency(data.cobrado),
        formatCurrency(data.pendiente)
      ]);

    const detalleRows = enrichedPedidos.map((pedido) => [
      formatDate(pedido.fecha_entrega),
      pedido.cliente_nombre,
      `#${pedido.pedido_id}`,
      formatCurrency(pedido.totalPedido),
      formatCurrency(pedido.pago.efectivo + pedido.pago.qr),
      formatCurrency(pedido.pendientePedido)
    ]);

    const docDefinition = buildDocDefinition({
      title: 'Reporte Personalizado de Conductor',
      subtitleLines: [
        `Conductor: ${conductorNombre}`,
        `Rango: ${startDate} a ${endDate}`
      ],
      content: [
        sectionTitle('Resumen ejecutivo'),
        buildSummaryTable([
          { label: 'Dias con actividad', value: String(diasConActividad) },
          { label: 'Pedidos cerrados', value: String(enrichedPedidos.length) },
          { label: 'Ventas del rango', value: formatCurrency(totalVentas), tone: 'warning' },
          { label: 'Cobrado', value: formatCurrency(totalCobrado), tone: 'success' },
          { label: 'Pendiente', value: formatCurrency(pendienteCobro), tone: 'danger' },
          { label: 'Gastos', value: formatCurrency(totalGastos) },
          { label: 'Promedio por dia', value: formatCurrency(promedioDia) },
          { label: 'Promedio por pedido', value: formatCurrency(promedioPedido) },
          { label: 'Efectivo neto', value: formatCurrency(totalEfectivo - totalGastos), tone: 'success' }
        ], 3),
        sectionTitle('Evolucion por fecha'),
        buildDataTable(
          ['Fecha', 'Pedidos', 'Ventas', 'Cobrado', 'Pendiente'],
          resumenRows,
          [75, 60, 95, 95, 95]
        ),
        sectionTitle('Detalle consolidado'),
        buildDataTable(
          ['Fecha', 'Cliente', 'Pedido', 'Total', 'Cobrado', 'Pendiente'],
          detalleRows,
          [70, '*', 55, 90, 90, 90]
        )
      ]
    });

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_personalizado_${conductorNombre}.pdf`);
      res.send(result);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generando PDF personalizado');
  }
});

module.exports = router;
