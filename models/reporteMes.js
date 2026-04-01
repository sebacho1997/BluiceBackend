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

router.get('/reporte-detalle-mes/:conductorId/:mes', async (req, res) => {
  const { conductorId, mes } = req.params;
  const printer = createPrinter();

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).send('El mes debe estar en formato YYYY-MM');
  }

  try {
    const conductorRes = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
      [conductorId]
    );
    const conductorNombre = conductorRes.rows.length ? conductorRes.rows[0].nombre : 'Desconocido';

    const pedidosRes = await pool.query(
      `SELECT p.id AS pedido_id, p.nro_pedido, p.estado, p.direccion, p.info_extra,
              u.nombre AS cliente_nombre, p.fecha_entrega::date AS fecha_entrega
       FROM pedidos p
       JOIN usuarios u ON u.id = p.usuario_id AND u.tipo_usuario = 'cliente'
       WHERE p.id_conductor = $1
         AND COALESCE(u.su, false) = false
         AND p.estado IN ('entregado', 'completado')
         AND TO_CHAR(p.fecha_entrega, 'YYYY-MM') = $2
       ORDER BY p.fecha_entrega, p.id`,
      [conductorId, mes]
    );

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send(`No hay pedidos para el mes ${mes}`);
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
         AND TO_CHAR(fecha_gasto, 'YYYY-MM') = $2`,
      [conductorId, mes]
    );

    const productosMap = {};
    const pagosMap = {};
    const resumenPorDia = {};
    const clientesMap = {};
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
      const pendientePedido = Math.max(totalPedido - (pago.efectivo + pago.qr), 0);
      const dayKey = pedido.fecha_entrega.toISOString().split('T')[0];
      const totalUnidades = productos.reduce((sum, producto) => sum + producto.cantidad, 0);

      if (!resumenPorDia[dayKey]) {
        resumenPorDia[dayKey] = { pedidos: 0, ventas: 0, efectivo: 0, qr: 0, pendiente: 0, unidades: 0 };
      }
      resumenPorDia[dayKey].pedidos += 1;
      resumenPorDia[dayKey].ventas += totalPedido;
      resumenPorDia[dayKey].efectivo += pago.efectivo;
      resumenPorDia[dayKey].qr += pago.qr;
      resumenPorDia[dayKey].pendiente += pendientePedido;
      resumenPorDia[dayKey].unidades += totalUnidades;

      if (!clientesMap[pedido.cliente_nombre]) {
        clientesMap[pedido.cliente_nombre] = { ventas: 0, pedidos: 0 };
      }
      clientesMap[pedido.cliente_nombre].ventas += totalPedido;
      clientesMap[pedido.cliente_nombre].pedidos += 1;

      return { ...pedido, totalPedido, pendientePedido, pago, productos, totalUnidades };
    });

    const totalVentas = enrichedPedidos.reduce((sum, pedido) => sum + pedido.totalPedido, 0);
    const totalEfectivo = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pago.efectivo, 0);
    const totalQr = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pago.qr, 0);
    const pendienteCobro = enrichedPedidos.reduce((sum, pedido) => sum + pedido.pendientePedido, 0);
    const totalGastos = Number(gastosRes.rows[0].total_gastos || 0);
    const ticketPromedio = totalVentas / enrichedPedidos.length;
    const bestDay = Object.entries(resumenPorDia).sort((a, b) => b[1].ventas - a[1].ventas)[0];

    const resumenRows = Object.entries(resumenPorDia)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, data]) => [
        formatDate(day),
        String(data.pedidos),
        String(data.unidades),
        formatCurrency(data.ventas),
        formatCurrency(data.efectivo),
        formatCurrency(data.qr),
        formatCurrency(data.pendiente)
      ]);

    const clientesRows = Object.entries(clientesMap)
      .sort((a, b) => b[1].ventas - a[1].ventas)
      .slice(0, 5)
      .map(([cliente, data]) => [cliente, String(data.pedidos), formatCurrency(data.ventas)]);

    const topProductosRows = Object.entries(topProductos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([producto, cantidad]) => [producto, String(cantidad)]);

    const detalleRows = enrichedPedidos.map((pedido) => [
      formatDate(pedido.fecha_entrega),
      pedido.cliente_nombre,
      `#${pedido.nro_pedido || pedido.pedido_id}`,
      String(pedido.totalUnidades),
      formatCurrency(pedido.totalPedido),
      formatCurrency(pedido.pago.efectivo + pedido.pago.qr),
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
              title: `${pedido.cliente_nombre} | Pedido #${pedido.nro_pedido || pedido.pedido_id}`,
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
                { label: 'Cobrado', value: formatCurrency(pedido.pago.efectivo + pedido.pago.qr), style: 'successText' },
                { label: 'Pendiente', value: formatCurrency(pedido.pendientePedido), style: 'dangerText' }
              ]
            })
          );
        });
      });

    const docDefinition = buildDocDefinition({
      title: 'Reporte Mensual de Conductor',
      subtitleLines: [
        `Conductor: ${conductorNombre}`,
        `Periodo: ${mes}`
      ],
      content: [
        sectionTitle('Resumen ejecutivo'),
        buildSummaryTable([
          { label: 'Pedidos cerrados', value: String(enrichedPedidos.length) },
          { label: 'Ventas del mes', value: formatCurrency(totalVentas), tone: 'warning' },
          { label: 'Cobrado en efectivo', value: formatCurrency(totalEfectivo), tone: 'success' },
          { label: 'Cobrado por QR', value: formatCurrency(totalQr) },
          { label: 'Pendiente', value: formatCurrency(pendienteCobro), tone: 'danger' },
          { label: 'Gastos', value: formatCurrency(totalGastos) },
          { label: 'Efectivo neto', value: formatCurrency(totalEfectivo - totalGastos), tone: 'success' },
          { label: 'Ticket promedio', value: formatCurrency(ticketPromedio) },
          {
            label: 'Mejor dia',
            value: bestDay ? formatDate(bestDay[0]) : '-',
            helper: bestDay ? formatCurrency(bestDay[1].ventas) : 'Sin datos'
          }
        ], 3),
        sectionTitle('Resumen por dia'),
        buildDataTable(
          ['Fecha', 'Pedidos', 'Unidades', 'Ventas', 'Efectivo', 'QR', 'Pendiente'],
          resumenRows,
          [70, 50, 55, 90, 90, 90, 90]
        ),
        sectionTitle('Clientes con mayor facturacion'),
        buildDataTable(
          ['Cliente', 'Pedidos', 'Ventas'],
          clientesRows.length ? clientesRows : [['Sin datos', '-', '-']],
          ['*', 70, 100]
        ),
        sectionTitle('Productos mas movidos'),
        buildDataTable(
          ['Producto', 'Cantidad'],
          topProductosRows.length ? topProductosRows : [['Sin datos', '-']],
          ['*', 80]
        ),
        sectionTitle('Detalle consolidado del periodo'),
        buildDataTable(
          ['Fecha', 'Cliente', 'Pedido', 'Unidades', 'Total', 'Cobrado', 'Pendiente'],
          detalleRows,
          [65, '*', 55, 55, 85, 85, 85]
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
          subjectName: conductorNombre,
          reportType: 'mensual',
          reportDate: mes
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generando PDF mensual');
  }
});

module.exports = router;
