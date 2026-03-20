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

router.get('/reporte-cliente-personalizado/:clienteId/:fechaInicio/:fechaFin', async (req, res) => {
  const { clienteId, fechaInicio, fechaFin } = req.params;
  const printer = createPrinter();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
    return res.status(400).send('Las fechas deben estar en formato YYYY-MM-DD');
  }

  try {
    const clienteRes = await pool.query(
      `SELECT nombre, telefono, email FROM usuarios WHERE id = $1 AND tipo_usuario = 'cliente'`,
      [clienteId]
    );
    const cliente = clienteRes.rows[0];
    const clienteNombre = cliente ? cliente.nombre : 'Desconocido';

    const pedidosRes = await pool.query(
      `SELECT p.id AS pedido_id, p.fecha_entrega::date AS fecha_entrega, p.estado
       FROM pedidos p
       WHERE p.usuario_id = $1
         AND p.fecha_entrega::date BETWEEN $2::date AND $3::date
       ORDER BY p.fecha_entrega, p.id`,
      [clienteId, fechaInicio, fechaFin]
    );

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send(`No hay pedidos del cliente en el rango ${fechaInicio} a ${fechaFin}`);
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

    const productosMap = {};
    const pagosMap = {};
    const resumenPorDia = {};
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
      const pagado = pago.efectivo + pago.qr;
      const pendientePedido = Math.max(totalPedido - pagado, 0);
      const dayKey = pedido.fecha_entrega.toISOString().split('T')[0];

      if (!resumenPorDia[dayKey]) {
        resumenPorDia[dayKey] = { pedidos: 0, comprado: 0, pagado: 0, pendiente: 0 };
      }
      resumenPorDia[dayKey].pedidos += 1;
      resumenPorDia[dayKey].comprado += totalPedido;
      resumenPorDia[dayKey].pagado += pagado;
      resumenPorDia[dayKey].pendiente += pendientePedido;

      return { ...pedido, totalPedido, pagado, pendientePedido };
    });

    const totalComprado = enrichedPedidos.reduce((sum, pedido) => sum + pedido.totalPedido, 0);
    const totalPagado = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pagado, 0);
    const totalPendiente = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pendientePedido, 0);
    const diasConActividad = Object.keys(resumenPorDia).length;
    const promedioPedido = totalComprado / enrichedPedidos.length;

    const resumenRows = Object.entries(resumenPorDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, data]) => [
        formatDate(day),
        String(data.pedidos),
        formatCurrency(data.comprado),
        formatCurrency(data.pagado),
        formatCurrency(data.pendiente)
      ]);

    const topProductosRows = Object.entries(topProductos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([producto, cantidad]) => [producto, String(cantidad)]);

    const detalleRows = enrichedPedidos.map((pedido) => [
      formatDate(pedido.fecha_entrega),
      `#${pedido.pedido_id}`,
      pedido.estado,
      formatCurrency(pedido.totalPedido),
      formatCurrency(pedido.pagado),
      formatCurrency(pedido.pendientePedido)
    ]);

    const docDefinition = buildDocDefinition({
      title: 'Reporte Personalizado de Cliente',
      subtitleLines: [
        `Cliente: ${clienteNombre}`,
        `Rango: ${fechaInicio} a ${fechaFin}`,
        cliente ? `Telefono: ${cliente.telefono || '-'} | Email: ${cliente.email || '-'}` : ''
      ].filter(Boolean),
      content: [
        sectionTitle('Resumen del rango'),
        buildSummaryTable([
          { label: 'Dias con actividad', value: String(diasConActividad) },
          { label: 'Pedidos del rango', value: String(enrichedPedidos.length) },
          { label: 'Monto comprado', value: formatCurrency(totalComprado), tone: 'warning' },
          { label: 'Monto pagado', value: formatCurrency(totalPagado), tone: 'success' },
          { label: 'Saldo pendiente', value: formatCurrency(totalPendiente), tone: 'danger' },
          { label: 'Promedio por pedido', value: formatCurrency(promedioPedido) }
        ], 3),
        sectionTitle('Evolucion por fecha'),
        buildDataTable(
          ['Fecha', 'Pedidos', 'Comprado', 'Pagado', 'Pendiente'],
          resumenRows,
          [75, 60, 95, 95, 95]
        ),
        sectionTitle('Productos mas comprados'),
        buildDataTable(
          ['Producto', 'Cantidad'],
          topProductosRows.length ? topProductosRows : [['Sin datos', '-']],
          ['*', 80]
        ),
        sectionTitle('Detalle de pedidos'),
        buildDataTable(
          ['Fecha', 'Pedido', 'Estado', 'Total', 'Pagado', 'Pendiente'],
          detalleRows,
          [70, 55, 70, 90, 90, 90]
        )
      ]
    });

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_cliente_${clienteNombre}_${fechaInicio}_a_${fechaFin}.pdf`);
      res.send(result);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generando PDF personalizado del cliente');
  }
});

module.exports = router;
