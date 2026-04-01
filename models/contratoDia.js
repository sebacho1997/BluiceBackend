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

router.get('/reporte-deudas-cliente/:clienteId', async (req, res) => {
  const { clienteId } = req.params;
  const printer = createPrinter();

  try {
    const clienteRes = await pool.query(
      `SELECT id, nombre, telefono, email
       FROM usuarios
       WHERE id = $1 AND tipo_usuario = 'cliente'`,
      [clienteId]
    );

    if (!clienteRes.rows.length) {
      return res.status(404).send('Cliente no encontrado');
    }

    const cliente = clienteRes.rows[0];

    const pedidosRes = await pool.query(
      `SELECT p.id AS pedido_id, p.monto_total, p.monto_pagado,
              p.monto_pendiente, p.fecha_creacion::date AS fecha_creacion, p.estado
       FROM pedidos p
       WHERE p.usuario_id = $1
         AND p.monto_pendiente > 0
       ORDER BY p.fecha_creacion`,
      [clienteId]
    );

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send('Este cliente no tiene pedidos con deudas');
    }

    const pedidoIds = pedidos.map((p) => p.pedido_id);

    const productosRes = await pool.query(
      `SELECT pd.pedido_id, pr.nombre AS producto_nombre,
              pd.cantidad, pd.preciounitario, (pd.cantidad * pd.preciounitario) AS subtotal
       FROM pedidoproducto pd
       JOIN productos pr ON pr.idproducto = pd.producto_id
       WHERE pd.pedido_id = ANY($1)`,
      [pedidoIds]
    );

    const productosMap = {};
    productosRes.rows.forEach((row) => {
      if (!productosMap[row.pedido_id]) productosMap[row.pedido_id] = [];
      productosMap[row.pedido_id].push({
        ...row,
        cantidad: Number(row.cantidad || 0),
        preciounitario: Number(row.preciounitario || 0),
        subtotal: Number(row.subtotal || 0)
      });
    });

    const enrichedPedidos = pedidos.map((pedido) => {
      const productos = productosMap[pedido.pedido_id] || [];
      const total = Number(pedido.monto_total || 0);
      const pagado = Number(pedido.monto_pagado || 0);
      const pendiente = Number(pedido.monto_pendiente || 0);
      const antiguedadDias = Math.max(
        0,
        DateTimeNowDiffInDays(new Date(pedido.fecha_creacion))
      );

      return {
        ...pedido,
        productos,
        total,
        pagado,
        pendiente,
        antiguedadDias
      };
    });

    const deudaTotal = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pendiente, 0);
    const totalPagado = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pagado, 0);
    const totalFacturado = enrichedPedidos.reduce((sum, pedido) => sum + pedido.total, 0);
    const pedidoMasAntiguo = [...enrichedPedidos].sort((a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion))[0];
    const antiguedadMaxima = Math.max(...enrichedPedidos.map((pedido) => pedido.antiguedadDias));

    const detalleRows = enrichedPedidos.map((pedido) => [
      formatDate(pedido.fecha_creacion),
      `#${pedido.pedido_id}`,
      pedido.estado,
      `${pedido.antiguedadDias} dias`,
      formatCurrency(pedido.total),
      formatCurrency(pedido.pagado),
      formatCurrency(pedido.pendiente)
    ]);

    const topPendientesRows = [...enrichedPedidos]
      .sort((a, b) => b.pendiente - a.pendiente)
      .slice(0, 5)
      .map((pedido) => [
        `#${pedido.pedido_id}`,
        formatDate(pedido.fecha_creacion),
        `${pedido.antiguedadDias} dias`,
        formatCurrency(pedido.pendiente)
      ]);

    const content = [
      sectionTitle('Resumen de deuda'),
      buildSummaryTable([
        { label: 'Pedidos con saldo', value: String(enrichedPedidos.length) },
        { label: 'Deuda total', value: formatCurrency(deudaTotal), tone: 'danger' },
        { label: 'Total facturado', value: formatCurrency(totalFacturado), tone: 'warning' },
        { label: 'Total pagado', value: formatCurrency(totalPagado), tone: 'success' },
        {
          label: 'Pedido mas antiguo',
          value: pedidoMasAntiguo ? formatDate(pedidoMasAntiguo.fecha_creacion) : '-',
          helper: pedidoMasAntiguo ? `#${pedidoMasAntiguo.pedido_id}` : ''
        },
        { label: 'Antiguedad maxima', value: `${antiguedadMaxima} dias`, tone: 'danger' }
      ], 3),
      sectionTitle('Pedidos con mayor saldo pendiente'),
      buildDataTable(
        ['Pedido', 'Fecha', 'Antiguedad', 'Pendiente'],
        topPendientesRows,
        [60, 85, 80, 100]
      ),
      sectionTitle('Detalle de pedidos pendientes'),
      buildDataTable(
        ['Fecha', 'Pedido', 'Estado', 'Antiguedad', 'Total', 'Pagado', 'Pendiente'],
        detalleRows,
        [70, 55, 65, 75, 85, 85, 85]
      )
    ];

    enrichedPedidos.forEach((pedido) => {
      content.push(sectionTitle(`Productos del pedido #${pedido.pedido_id}`));
      content.push(
        buildDataTable(
          ['Producto', 'Cantidad', 'P. Unitario', 'Subtotal'],
          pedido.productos.map((producto) => [
            producto.producto_nombre,
            String(producto.cantidad),
            formatCurrency(producto.preciounitario),
            formatCurrency(producto.subtotal)
          ]),
          ['*', 70, 90, 90]
        )
      );
    });

    const docDefinition = buildDocDefinition({
      title: 'Reporte de Deuda del Cliente',
      subtitleLines: [
        `Cliente: ${cliente.nombre}`,
        `Telefono: ${cliente.telefono || '-'} | Email: ${cliente.email || '-'}`,
        `Fecha de corte: ${formatDate(new Date())}`
      ],
      content
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
          subjectName: cliente.nombre,
          reportType: 'deuda',
          reportDate: new Date()
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generando reporte de deudas del cliente');
  }
});

function DateTimeNowDiffInDays(date) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = startOfToday - startOfDate;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

module.exports = router;
