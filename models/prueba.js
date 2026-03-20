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
  sectionTitle,
  divider
} = require('./reportPdfUtils');

router.get('/reporte-detalle/:conductorId', async (req, res) => {
  const { conductorId } = req.params;
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
         AND p.estado IN ('entregado', 'completado')
         AND p.fecha_entrega::date = CURRENT_DATE
       ORDER BY p.fecha_entrega, p.id`,
      [conductorId]
    );

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send('No hay pedidos para este conductor hoy');
    }

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

    const gastosRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_gastos
       FROM gastos_dia
       WHERE id_conductor = $1
         AND fecha_gasto::date = CURRENT_DATE`,
      [conductorId]
    );

    const productosMap = {};
    const pagosMap = {};
    const topProductos = {};

    productosRes.rows.forEach((row) => {
      if (!productosMap[row.pedido_id]) productosMap[row.pedido_id] = [];
      const normalized = {
        ...row,
        cantidad: Number(row.cantidad || 0),
        preciounitario: Number(row.preciounitario || 0),
        subtotal: Number(row.subtotal || 0)
      };
      productosMap[row.pedido_id].push(normalized);
      topProductos[row.producto_nombre] = (topProductos[row.producto_nombre] || 0) + normalized.cantidad;
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

      return { ...pedido, productos, pago, totalPedido, pendientePedido };
    });

    const totalVentas = enrichedPedidos.reduce((sum, pedido) => sum + pedido.totalPedido, 0);
    const totalEfectivo = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pago.efectivo, 0);
    const totalQr = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pago.qr, 0);
    const pendienteCobro = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pendientePedido, 0);
    const totalGastos = Number(gastosRes.rows[0].total_gastos || 0);
    const totalProductos = enrichedPedidos.reduce(
      (sum, pedido) => sum + pedido.productos.reduce((acc, producto) => acc + producto.cantidad, 0),
      0
    );
    const ticketPromedio = totalVentas / enrichedPedidos.length;

    const topProductosRows = Object.entries(topProductos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([producto, cantidad]) => [producto, String(cantidad)]);

    const content = [];

    content.push(sectionTitle('Resumen del dia'));
    content.push(
      buildSummaryTable([
        { label: 'Pedidos entregados', value: String(enrichedPedidos.length) },
        { label: 'Ventas del dia', value: formatCurrency(totalVentas), tone: 'warning' },
        { label: 'Cobrado', value: formatCurrency(totalEfectivo + totalQr), tone: 'success' },
        { label: 'Pendiente', value: formatCurrency(pendienteCobro), tone: 'danger' },
        { label: 'Gastos', value: formatCurrency(totalGastos) },
        { label: 'Efectivo neto', value: formatCurrency(totalEfectivo - totalGastos), tone: 'success' },
        { label: 'Productos entregados', value: String(totalProductos) },
        { label: 'Ticket promedio', value: formatCurrency(ticketPromedio) }
      ], 4)
    );

    content.push(sectionTitle('Productos mas movidos'));
    content.push(
      buildDataTable(
        ['Producto', 'Cantidad'],
        topProductosRows.length ? topProductosRows : [['Sin datos', '-']],
        ['*', 80]
      )
    );

    content.push(sectionTitle('Detalle de pedidos'));

    enrichedPedidos.forEach((pedido) => {
      content.push({
        stack: [
          { text: pedido.cliente_nombre, style: 'blockTitle' },
          {
            text: `Pedido #${pedido.pedido_id} | Fecha ${formatDate(pedido.fecha_entrega)} | Efectivo ${formatCurrency(
              pedido.pago.efectivo
            )} | QR ${formatCurrency(pedido.pago.qr)}`,
            style: 'blockMeta'
          }
        ]
      });

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

      content.push({
        columns: [
          { text: `Total pedido: ${formatCurrency(pedido.totalPedido)}`, style: 'emphasis' },
          { text: `Pendiente: ${formatCurrency(pedido.pendientePedido)}`, alignment: 'right', style: 'dangerText' }
        ]
      });
      content.push(divider());
    });

    const docDefinition = buildDocDefinition({
      title: 'Reporte Diario de Conductor',
      subtitleLines: [
        `Conductor: ${conductorNombre}`,
        `Fecha operativa: ${formatDate(new Date())}`
      ],
      content
    });

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_diario_${conductorNombre}.pdf`);
      res.send(result);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generando reporte diario del conductor');
  }
});

module.exports = router;
