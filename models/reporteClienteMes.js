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

router.get('/reporte-cliente-mes/:clienteId/:mes', async (req, res) => {
  const { clienteId, mes } = req.params;
  const printer = createPrinter();

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).send('El mes debe estar en formato YYYY-MM');
  }

  try {
    const clienteRes = await pool.query(
      `SELECT nombre, telefono, email FROM usuarios WHERE id = $1 AND tipo_usuario = 'cliente'`,
      [clienteId]
    );
    const cliente = clienteRes.rows[0];
    const clienteNombre = cliente ? cliente.nombre : 'Desconocido';

    const pedidosRes = await pool.query(
      `SELECT p.id AS pedido_id, p.nro_pedido, p.fecha_entrega::date AS fecha_entrega,
              p.estado, p.direccion, p.info_extra
       FROM pedidos p
       WHERE p.usuario_id = $1
         AND TO_CHAR(p.fecha_entrega, 'YYYY-MM') = $2
       ORDER BY p.fecha_entrega, p.id`,
      [clienteId, mes]
    );

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send(`No hay pedidos del cliente para el mes ${mes}`);
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
      if (!pagosMap[row.pedido_id]) pagosMap[row.pedido_id] = { efectivo: 0, qr: 0, rows: [] };
      const total = Number(row.total || 0);
      const metodo = (row.metodo_pago || '').toLowerCase();
      if (metodo === 'efectivo') pagosMap[row.pedido_id].efectivo = total;
      if (metodo === 'qr') pagosMap[row.pedido_id].qr = total;
      pagosMap[row.pedido_id].rows.push([row.metodo_pago || 'Sin metodo', formatCurrency(total)]);
    });

    const enrichedPedidos = pedidos.map((pedido) => {
      const productos = productosMap[pedido.pedido_id] || [];
      const pago = pagosMap[pedido.pedido_id] || { efectivo: 0, qr: 0, rows: [] };
      const totalPedido = productos.reduce((sum, producto) => sum + producto.subtotal, 0);
      const pagado = pago.efectivo + pago.qr;
      const pendientePedido = Math.max(totalPedido - pagado, 0);
      const dayKey = pedido.fecha_entrega.toISOString().split('T')[0];
      const totalUnidades = productos.reduce((sum, producto) => sum + producto.cantidad, 0);

      if (!resumenPorDia[dayKey]) {
        resumenPorDia[dayKey] = { pedidos: 0, unidades: 0, comprado: 0, pagado: 0, pendiente: 0 };
      }
      resumenPorDia[dayKey].pedidos += 1;
      resumenPorDia[dayKey].unidades += totalUnidades;
      resumenPorDia[dayKey].comprado += totalPedido;
      resumenPorDia[dayKey].pagado += pagado;
      resumenPorDia[dayKey].pendiente += pendientePedido;

      return { ...pedido, totalPedido, pagado, pendientePedido, productos, pago, totalUnidades };
    });

    const totalComprado = enrichedPedidos.reduce((sum, pedido) => sum + pedido.totalPedido, 0);
    const totalPagado = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pagado, 0);
    const totalPendiente = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pendientePedido, 0);
    const ticketPromedio = totalComprado / enrichedPedidos.length;

    const resumenRows = Object.entries(resumenPorDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, data]) => [
        formatDate(day),
        String(data.pedidos),
        String(data.unidades),
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
      `#${pedido.nro_pedido || pedido.pedido_id}`,
      pedido.estado,
      String(pedido.totalUnidades),
      formatCurrency(pedido.totalPedido),
      formatCurrency(pedido.pagado),
      formatCurrency(pedido.pendientePedido)
    ]);

    const pedidosPorDia = enrichedPedidos.reduce((acc, pedido) => {
      const key = pedido.fecha_entrega.toISOString().split('T')[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(pedido);
      return acc;
    }, {});

    const detailContent = [];
    Object.entries(pedidosPorDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([day, pedidosDelDia]) => {
        detailContent.push(sectionTitle(`Detalle del dia ${formatDate(day)}`));
        pedidosDelDia.forEach((pedido) => {
          detailContent.push(
            buildOrderDetailBlock({
              title: `Pedido #${pedido.nro_pedido || pedido.pedido_id}`,
              metaLines: [
                `Fecha ${formatDate(pedido.fecha_entrega)} | Estado ${pedido.estado || '-'}`,
                pedido.direccion ? `Direccion: ${pedido.direccion}` : '',
                pedido.info_extra ? `Referencia: ${pedido.info_extra}` : ''
              ],
              productRows: pedido.productos.map((producto) => [
                producto.producto_nombre,
                String(producto.cantidad),
                formatCurrency(producto.preciounitario),
                formatCurrency(producto.subtotal)
              ]),
              paymentRows: pedido.pago.rows,
              summaryPairs: [
                { label: 'Items', value: String(pedido.productos.length) },
                { label: 'Unidades', value: String(pedido.totalUnidades) },
                { label: 'Pagado', value: formatCurrency(pedido.pagado), style: 'successText' },
                { label: 'Pendiente', value: formatCurrency(pedido.pendientePedido), style: 'dangerText' }
              ]
            })
          );
        });
      });

    const docDefinition = buildDocDefinition({
      title: 'Reporte Mensual de Cliente',
      subtitleLines: [
        `Cliente: ${clienteNombre}`,
        `Mes: ${mes}`,
        cliente ? `Telefono: ${cliente.telefono || '-'} | Email: ${cliente.email || '-'}` : ''
      ].filter(Boolean),
      content: [
        sectionTitle('Resumen del cliente'),
        buildSummaryTable([
          { label: 'Pedidos del mes', value: String(enrichedPedidos.length) },
          { label: 'Monto comprado', value: formatCurrency(totalComprado), tone: 'warning' },
          { label: 'Monto pagado', value: formatCurrency(totalPagado), tone: 'success' },
          { label: 'Saldo pendiente', value: formatCurrency(totalPendiente), tone: 'danger' },
          { label: 'Ticket promedio', value: formatCurrency(ticketPromedio) }
        ], 3),
        sectionTitle('Resumen por fecha'),
        buildDataTable(
          ['Fecha', 'Pedidos', 'Unidades', 'Comprado', 'Pagado', 'Pendiente'],
          resumenRows,
          [70, 55, 60, 90, 90, 90]
        ),
        sectionTitle('Productos mas comprados'),
        buildDataTable(
          ['Producto', 'Cantidad'],
          topProductosRows.length ? topProductosRows : [['Sin datos', '-']],
          ['*', 80]
        ),
        sectionTitle('Detalle de pedidos'),
        buildDataTable(
          ['Fecha', 'Pedido', 'Estado', 'Unidades', 'Total', 'Pagado', 'Pendiente'],
          detalleRows,
          [65, 55, 70, 55, 85, 85, 85]
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
          subjectName: clienteNombre,
          reportType: 'mensual',
          reportDate: mes
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generando PDF mensual del cliente');
  }
});

module.exports = router;
