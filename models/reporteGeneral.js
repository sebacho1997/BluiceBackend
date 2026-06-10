const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const {
  createPrinter,
  buildReportFilename,
  formatCurrency,
  formatDate,
  buildSummaryTable,
  buildDataTable,
  buildOrderDetailBlock,
  buildDocDefinition,
  sectionTitle
} = require('./reportPdfUtils');

async function generarReporteGeneral({ res, reportType, reportDateForFilename, subtitleLines, whereSql, params }) {
  const printer = createPrinter();

  try {
    const pedidosRes = await pool.query(
      `SELECT p.id AS pedido_id, p.nro_pedido, p.estado, p.direccion, p.info_extra,
       u.nombre AS cliente_nombre,
       CASE
         WHEN p.usuario_id = 31 AND p.id_conductor = 30 THEN 'VENTA LOCAL'
         ELSE COALESCE(c.nombre, 'Sin conductor')
       END AS conductor_nombre,
       CASE
         WHEN p.usuario_id = 31 AND p.id_conductor = 30 THEN 'VENTA LOCAL'
         ELSE 'PEDIDO'
       END AS canal,
       p.fecha_entrega::date AS fecha_entrega
FROM pedidos p
JOIN usuarios u ON u.id = p.usuario_id AND u.tipo_usuario = 'cliente'
LEFT JOIN usuarios c ON c.id = p.id_conductor AND c.tipo_usuario = 'conductor'
WHERE COALESCE(u.su, false) = false
  AND p.estado IN ('entregado', 'completado')
         ${whereSql}
       ORDER BY p.fecha_entrega, p.id`,
      params
    );

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) return res.status(404).send('No hay pedidos para el periodo seleccionado');

    const pedidoIds = pedidos.map((p) => p.pedido_id);

    const productosRes = await pool.query(
      `SELECT pd.pedido_id, pr.nombre AS producto_nombre, pd.cantidad, pd.preciounitario,
              (pd.cantidad * pd.preciounitario) AS subtotal
       FROM pedidoproducto pd
       JOIN productos pr ON pr.idproducto = pd.producto_id
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

    const productosMap = {};
    const pagosMap = {};
    const resumenPorDia = {};
    const resumenPorConductor = {};
    const topProductos = {};

    productosRes.rows.forEach((row) => {
      if (!productosMap[row.pedido_id]) productosMap[row.pedido_id] = [];
      const normalized = {
        producto_nombre: row.producto_nombre,
        cantidad: Number(row.cantidad || 0),
        preciounitario: Number(row.preciounitario || 0),
        subtotal: Number(row.subtotal || 0)
      };
      productosMap[row.pedido_id].push(normalized);
      topProductos[row.producto_nombre] = (topProductos[row.producto_nombre] || 0) + normalized.cantidad;
    });

    pagosRes.rows.forEach((row) => {
      if (!pagosMap[row.pedido_id]) pagosMap[row.pedido_id] = { efectivo: 0, qr: 0, otros: 0, rows: [] };
      const total = Number(row.total || 0);
      const metodoLower = (row.metodo_pago || '').toLowerCase().trim();

      if (metodoLower === 'efectivo') pagosMap[row.pedido_id].efectivo += total;
      else if (metodoLower === 'qr') pagosMap[row.pedido_id].qr += total;
      else pagosMap[row.pedido_id].otros += total;

      pagosMap[row.pedido_id].rows.push([row.metodo_pago || 'Sin metodo', formatCurrency(total)]);
    });

    const enrichedPedidos = pedidos.map((pedido) => {
      const productos = productosMap[pedido.pedido_id] || [];
      const pago = pagosMap[pedido.pedido_id] || { efectivo: 0, qr: 0, otros: 0, rows: [] };
      const totalPedido = productos.reduce((sum, p) => sum + p.subtotal, 0);
      const cobradoPedido = pago.efectivo + pago.qr + pago.otros;
      const pendientePedido = Math.max(totalPedido - cobradoPedido, 0);
      const totalUnidades = productos.reduce((sum, p) => sum + p.cantidad, 0);

      const dayKey = pedido.fecha_entrega.toISOString().split('T')[0];
      const conductorKey = pedido.conductor_nombre || 'Sin conductor';

      if (!resumenPorDia[dayKey]) {
        resumenPorDia[dayKey] = { pedidos: 0, unidades: 0, ventas: 0, efectivo: 0, qr: 0, otros: 0, pendiente: 0 };
      }
      resumenPorDia[dayKey].pedidos += 1;
      resumenPorDia[dayKey].unidades += totalUnidades;
      resumenPorDia[dayKey].ventas += totalPedido;
      resumenPorDia[dayKey].efectivo += pago.efectivo;
      resumenPorDia[dayKey].qr += pago.qr;
      resumenPorDia[dayKey].otros += pago.otros;
      resumenPorDia[dayKey].pendiente += pendientePedido;

      if (!resumenPorConductor[conductorKey]) {
        resumenPorConductor[conductorKey] = { pedidos: 0, unidades: 0, ventas: 0, cobrado: 0, pendiente: 0 };
      }
      resumenPorConductor[conductorKey].pedidos += 1;
      resumenPorConductor[conductorKey].unidades += totalUnidades;
      resumenPorConductor[conductorKey].ventas += totalPedido;
      resumenPorConductor[conductorKey].cobrado += cobradoPedido;
      resumenPorConductor[conductorKey].pendiente += pendientePedido;

      return { ...pedido, productos, pago, totalPedido, cobradoPedido, pendientePedido, totalUnidades };
    });

    const totalVentas = enrichedPedidos.reduce((sum, p) => sum + p.totalPedido, 0);
    const totalEfectivo = enrichedPedidos.reduce((sum, p) => sum + p.pago.efectivo, 0);
    const totalQr = enrichedPedidos.reduce((sum, p) => sum + p.pago.qr, 0);
    const totalOtros = enrichedPedidos.reduce((sum, p) => sum + p.pago.otros, 0);
    const totalCobrado = totalEfectivo + totalQr + totalOtros;
    const totalPendiente = enrichedPedidos.reduce((sum, p) => sum + p.pendientePedido, 0);
    const totalProductos = enrichedPedidos.reduce((sum, p) => sum + p.totalUnidades, 0);

    const resumenRows = Object.entries(resumenPorDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, d]) => [
        formatDate(day),
        String(d.pedidos),
        String(d.unidades),
        formatCurrency(d.ventas),
        formatCurrency(d.efectivo),
        formatCurrency(d.qr),
        formatCurrency(d.otros),
        formatCurrency(d.pendiente)
      ]);

    const conductoresRows = Object.entries(resumenPorConductor)
      .sort((a, b) => b[1].ventas - a[1].ventas)
      .map(([c, d]) => [c, String(d.pedidos), String(d.unidades), formatCurrency(d.ventas), formatCurrency(d.cobrado), formatCurrency(d.pendiente)]);

    const topProductosRows = Object.entries(topProductos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([p, cant]) => [p, String(cant)]);

    const detalleRows = enrichedPedidos.map((p) => [
      formatDate(p.fecha_entrega),
      p.conductor_nombre || 'Sin conductor',
      p.cliente_nombre,
      `#${p.nro_pedido || p.pedido_id}`,
      String(p.totalUnidades),
      formatCurrency(p.totalPedido),
      formatCurrency(p.cobradoPedido),
      formatCurrency(p.pendientePedido)
    ]);

    const pedidosPorDia = enrichedPedidos.reduce((acc, p) => {
      const key = p.fecha_entrega.toISOString().split('T')[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});

    const detailContent = [];
    Object.entries(pedidosPorDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([day, list]) => {
        detailContent.push(sectionTitle(`Detalle del dia ${formatDate(day)}`));
        list.forEach((p) => {
          detailContent.push(
            buildOrderDetailBlock({
              title: `${p.conductor_nombre || 'Sin conductor'} | ${p.cliente_nombre} | Pedido #${p.nro_pedido || p.pedido_id}`,
              metaLines: [
                `Fecha ${formatDate(p.fecha_entrega)} | Estado ${p.estado || '-'}`,
                p.direccion ? `Direccion: ${p.direccion}` : '',
                p.info_extra ? `Referencia: ${p.info_extra}` : ''
              ],
              productRows: p.productos.map((x) => [x.producto_nombre, String(x.cantidad), formatCurrency(x.preciounitario), formatCurrency(x.subtotal)]),
              paymentRows: p.pago.rows,
              summaryPairs: [
                { label: 'Unidades', value: String(p.totalUnidades) },
                { label: 'Total', value: formatCurrency(p.totalPedido) },
                { label: 'Efectivo', value: formatCurrency(p.pago.efectivo), style: 'successText' },
                { label: 'QR', value: formatCurrency(p.pago.qr), style: 'successText' },
                { label: 'Otros', value: formatCurrency(p.pago.otros), style: 'successText' },
                { label: 'Pendiente', value: formatCurrency(p.pendientePedido), style: 'dangerText' }
              ]
            })
          );
        });
      });

    const docDefinition = buildDocDefinition({
      title: 'Reporte General de Ventas',
      subtitleLines,
      content: [
        sectionTitle('Resumen general'),
        buildSummaryTable([
          { label: 'Pedidos', value: String(enrichedPedidos.length) },
          { label: 'Productos vendidos', value: String(totalProductos) },
          { label: 'Ventas', value: formatCurrency(totalVentas), tone: 'warning' },
          { label: 'Cobrado', value: formatCurrency(totalCobrado), tone: 'success' },
          { label: 'Efectivo', value: formatCurrency(totalEfectivo), tone: 'success' },
          { label: 'QR', value: formatCurrency(totalQr), tone: 'success' },
          { label: 'Otros', value: formatCurrency(totalOtros) },
          { label: 'Por cobrar', value: formatCurrency(totalPendiente), tone: 'danger' }
        ], 4),
        sectionTitle('Resumen por fecha'),
        buildDataTable(
          ['Fecha', 'Pedidos', 'Unidades', 'Ventas', 'Efectivo', 'QR', 'Otros', 'Pendiente'],
          resumenRows,
          [70, 55, 60, 85, 85, 85, 85, 85]
        ),
        sectionTitle('Resumen por conductor'),
        buildDataTable(
          ['Conductor', 'Pedidos', 'Unidades', 'Ventas', 'Cobrado', 'Pendiente'],
          conductoresRows.length ? conductoresRows : [['Sin datos', '-', '-', '-', '-', '-']],
          ['*', 55, 60, 90, 90, 90]
        ),
        sectionTitle('Productos mas vendidos'),
        buildDataTable(['Producto', 'Cantidad'], topProductosRows.length ? topProductosRows : [['Sin datos', '-']], ['*', 80]),
        sectionTitle('Detalle consolidado del periodo'),
        buildDataTable(
          ['Fecha', 'Conductor', 'Cliente', 'Pedido', 'Unidades', 'Total', 'Cobrado', 'Pendiente'],
          detalleRows,
          [65, 95, '*', 55, 55, 80, 80, 80]
        ),
        ...detailContent
      ]
    });

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${buildReportFilename({
          entityType: 'general',
          subjectName: 'ventas',
          reportType,
          reportDate: reportDateForFilename
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (e) {
    console.error(e);
    res.status(500).send('Error generando reporte general');
  }
}

router.get('/reporte-general-mes/:mes', async (req, res) => {
  const { mes } = req.params;
  if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).send('El mes debe estar en formato YYYY-MM');

  return generarReporteGeneral({
    res,
    reportType: 'mensual',
    reportDateForFilename: mes,
    subtitleLines: [`Periodo: ${mes}`],
    whereSql: `AND TO_CHAR(p.fecha_entrega, 'YYYY-MM') = $1`,
    params: [mes]
  });
});

router.get('/reporte-general-personalizado/:startDate/:endDate', async (req, res) => {
  const { startDate, endDate } = req.params;

  return generarReporteGeneral({
    res,
    reportType: 'personalizado',
    reportDateForFilename: `${startDate}_a_${endDate}`,
    subtitleLines: [`Rango: ${startDate} a ${endDate}`],
    whereSql: `AND p.fecha_entrega::date BETWEEN $1 AND $2`,
    params: [startDate, endDate]
  });
});

module.exports = router;