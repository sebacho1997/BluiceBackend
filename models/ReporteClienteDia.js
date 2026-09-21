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
  buildDocDefinition,
  sectionTitle
} = require('./reportPdfUtils');

router.get('/reporte-deudas-clientes', async (req, res) => {
  const printer = createPrinter();

  try {
    const pedidosRes = await pool.query(`
      SELECT p.id AS pedido_id, p.usuario_id AS cliente_id, u.nombre AS cliente_nombre,
             u.telefono, u.email, p.monto_total, p.monto_pagado, p.monto_pendiente,
             p.fecha_creacion, p.estado, p.tipo
      FROM pedidos p
      JOIN usuarios u ON u.id = p.usuario_id AND u.tipo_usuario = 'cliente'
      WHERE p.monto_pendiente > 0
        AND COALESCE(u.su, false) = false
        AND p.estado = 'entregado'
      ORDER BY u.id, p.fecha_creacion
    `);

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send('No hay pedidos con deudas');
    }

    const pedidoIds = pedidos.map(p => p.pedido_id);

    const productosRes = await pool.query(`
      SELECT pd.pedido_id, pr.nombre AS producto_nombre,
             pd.cantidad, pd.preciounitario,
             (pd.cantidad * pd.preciounitario) AS subtotal
      FROM pedidoproducto pd
      JOIN productos pr ON pr.idproducto = pd.producto_id
      WHERE pd.pedido_id = ANY($1)
    `, [pedidoIds]);

    const productosMap = {};
    productosRes.rows.forEach(pd => {
      if (!productosMap[pd.pedido_id]) productosMap[pd.pedido_id] = [];
      productosMap[pd.pedido_id].push({
        producto_nombre: pd.producto_nombre,
        cantidad: Number(pd.cantidad || 0),
        preciounitario: Number(pd.preciounitario || 0),
        subtotal: Number(pd.subtotal || 0)
      });
    });

    const clientesMap = {};
    pedidos.forEach(p => {
      if (!clientesMap[p.cliente_id]) {
        clientesMap[p.cliente_id] = {
          cliente_nombre: p.cliente_nombre,
          telefono: p.telefono,
          email: p.email,
          pedidos: []
        };
      }
      clientesMap[p.cliente_id].pedidos.push(p);
    });

    const clientesRows = [];
    let deudaTotalGeneral = 0;
    let totalFacturadoGeneral = 0;
    let totalPagadoGeneral = 0;

    for (const clienteId in clientesMap) {
      const cliente = clientesMap[clienteId];
      let deudaCliente = 0;
      let facturadoCliente = 0;
      let pagadoCliente = 0;

      cliente.pedidos.forEach(p => {
        const pendiente = parseFloat(p.monto_pendiente);
        const total = parseFloat(p.monto_total);
        const pagado = parseFloat(p.monto_pagado);
        deudaCliente += pendiente;
        facturadoCliente += total;
        pagadoCliente += pagado;
        deudaTotalGeneral += pendiente;
        totalFacturadoGeneral += total;
        totalPagadoGeneral += pagado;
      });

      clientesRows.push([
        cliente.cliente_nombre,
        cliente.telefono || '-',
        String(cliente.pedidos.length),
        formatCurrency(facturadoCliente),
        formatCurrency(pagadoCliente),
        formatCurrency(deudaCliente)
      ]);
    }

    clientesRows.sort((a, b) => {
      const deudaA = parseFloat(a[5].replace('Bs', ''));
      const deudaB = parseFloat(b[5].replace('Bs', ''));
      return deudaB - deudaA;
    });

    const detalleRows = pedidos.map(p => [
      formatDate(p.fecha_creacion),
      `#${p.pedido_id}`,
      p.cliente_nombre,
      p.estado,
      (p.tipo || 'particular').toUpperCase(),
      formatCurrency(parseFloat(p.monto_total)),
      formatCurrency(parseFloat(p.monto_pagado)),
      formatCurrency(parseFloat(p.monto_pendiente))
    ]);

    const docDefinition = buildDocDefinition({
      title: 'Reporte de Deudas por Cliente',
      subtitleLines: [`Fecha de corte: ${formatDate(new Date())}`],
      content: [
        sectionTitle('Resumen general'),
        buildSummaryTable([
          { label: 'Clientes con deuda', value: String(Object.keys(clientesMap).length) },
          { label: 'Pedidos pendientes', value: String(pedidos.length) },
          { label: 'Deuda total', value: formatCurrency(deudaTotalGeneral), tone: 'danger' },
          { label: 'Total facturado', value: formatCurrency(totalFacturadoGeneral), tone: 'warning' },
          { label: 'Total pagado', value: formatCurrency(totalPagadoGeneral), tone: 'success' }
        ], 3),
        sectionTitle('Deuda por cliente'),
        buildDataTable(
          ['Cliente', 'Telefono', 'Pedidos', 'Facturado', 'Pagado', 'Pendiente'],
          clientesRows.length ? clientesRows : [['Sin datos', '-', '-', '-', '-', '-']],
          ['*', 80, 55, 90, 90, 90]
        ),
        sectionTitle('Detalle de pedidos pendientes'),
        buildDataTable(
          ['Fecha', 'Pedido', 'Cliente', 'Estado', 'Tipo', 'Total', 'Pagado', 'Pendiente'],
          detalleRows,
          [65, 50, '*', 65, 55, 80, 80, 80]
        )
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
          entityType: 'clientes',
          subjectName: 'deudas',
          reportType: 'general',
          reportDate: new Date()
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando reporte de deudas por cliente');
  }
});

module.exports = router;
