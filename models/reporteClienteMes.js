const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const pool = require('../config/db');

// 📌 Reporte mensual de pedidos por cliente
router.get('/reporte-cliente-mes/:clienteId/:mes', async (req, res) => {
  const { clienteId, mes } = req.params;

  // Validar formato del mes
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).send("El mes debe estar en formato YYYY-MM");
  }

  const fonts = {
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    }
  };
  const printer = new PdfPrinter(fonts);

  try {
    // Obtener nombre del cliente
    const clienteRes = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'cliente'`,
      [clienteId]
    );
    const clienteNombre = clienteRes.rows.length ? clienteRes.rows[0].nombre : 'Desconocido';

    // 📌 Obtener pedidos del cliente en el mes
    const pedidosRes = await pool.query(`
      SELECT p.id AS pedido_id, p.monto_total, p.fecha_entrega::date, p.estado,
             COALESCE(p.monto_pagado, 0) AS monto_pagado,
             COALESCE(p.monto_pendiente, 0) AS monto_pendiente
      FROM pedidos p
      WHERE p.usuario_id = $1
        AND TO_CHAR(p.fecha_entrega, 'YYYY-MM') = $2
      ORDER BY p.fecha_entrega, p.id
    `, [clienteId, mes]);

    const pedidos = pedidosRes.rows;
    const pedidoIds = pedidos.map(p => p.pedido_id);
    if (!pedidoIds.length) return res.status(404).send(`No hay pedidos del cliente para el mes ${mes}`);

    // 📦 Productos por pedido
    const productosRes = await pool.query(`
      SELECT pd.pedido_id, pr.idproducto AS producto_id, pr.nombre AS producto_nombre,
             pd.cantidad, pd.preciounitario, (pd.cantidad * pd.preciounitario) AS subtotal
      FROM pedidoproducto pd
      JOIN productos pr ON pr.idproducto = pd.producto_id
      WHERE pd.pedido_id = ANY($1)
    `, [pedidoIds]);

    const productosMap = {};
    productosRes.rows.forEach(pd => {
      if (!productosMap[pd.pedido_id]) productosMap[pd.pedido_id] = [];
      productosMap[pd.pedido_id].push(pd);
    });

    // 💰 Pagos por pedido
    const pagosRes = await pool.query(`
      SELECT pedido_id, metodo_pago, SUM(monto_pagado) AS total
      FROM pagos_pedido
      WHERE pedido_id = ANY($1)
      GROUP BY pedido_id, metodo_pago
    `, [pedidoIds]);

    const pagosMap = {};
    pagosRes.rows.forEach(pg => {
      if (!pagosMap[pg.pedido_id]) pagosMap[pg.pedido_id] = { efectivo: 0, qr: 0 };
      if (pg.metodo_pago.toLowerCase() === 'efectivo') pagosMap[pg.pedido_id].efectivo = parseFloat(pg.total);
      if (pg.metodo_pago.toLowerCase() === 'qr') pagosMap[pg.pedido_id].qr = parseFloat(pg.total);
    });

    // 🔢 Totales generales
    let totalEfectivo = 0, totalQr = 0, totalVentas = 0, totalPendiente = 0;

    const contentPedidos = pedidos.map(p => {
      const productos = productosMap[p.pedido_id] || [];
      const pago = pagosMap[p.pedido_id] || { efectivo: 0, qr: 0 };
      const totalPedido = productos.reduce((sum, pr) => sum + parseFloat(pr.subtotal), 0);
      const pendientePedido = Math.max(totalPedido - (pago.efectivo + pago.qr), 0);

      totalEfectivo += pago.efectivo;
      totalQr += pago.qr;
      totalVentas += totalPedido;
      totalPendiente += pendientePedido;

      const productosTable = {
        table: {
          widths: ['*', 60, 80, 80],
          body: [
            [
              { text: 'Producto', style: 'tableHeader' },
              { text: 'Cantidad', style: 'tableHeader' },
              { text: 'Precio Unitario', style: 'tableHeader' },
              { text: 'Subtotal', style: 'tableHeader' }
            ],
            ...productos.map(pr => [
              pr.producto_nombre,
              pr.cantidad.toString(),
              `Bs${pr.preciounitario.toFixed(2)}`,
              `Bs${pr.subtotal.toFixed(2)}`
            ])
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 5, 0, 10]
      };

      return {
        stack: [
          { text: `Fecha: ${p.fecha_entrega.toLocaleDateString()} | Pedido ID: ${p.pedido_id}`, style: 'pedidoCliente' },
          productosTable,
          { text: `Total: Bs${totalPedido.toFixed(2)} | Efectivo: Bs${pago.efectivo.toFixed(2)} | QR: Bs${pago.qr.toFixed(2)} | Pendiente: Bs${pendientePedido.toFixed(2)}`, style: 'totalesPedido' },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 1, lineColor: '#CCCCCC' }], margin: [0, 5, 0, 5] }
        ]
      };
    });

    // 📄 Documento PDF
    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Reporte Mensual de Pedidos del Cliente', style: 'header', alignment: 'center' },
        { text: `Cliente: ${clienteNombre}`, style: 'subHeader', alignment: 'center' },
        { text: `Mes: ${mes}\n\n`, alignment: 'center' },
        ...contentPedidos,
        { text: 'Totales Generales del Mes', style: 'header', margin: [0, 10, 0, 5] },
        {
          table: {
            widths: ['*', 120],
            body: [
              ['Total Efectivo', `Bs${totalEfectivo.toFixed(2)}`],
              ['Total QR', `Bs${totalQr.toFixed(2)}`],
              ['Total Ventas', `Bs${totalVentas.toFixed(2)}`],
              ['Pendiente de Pago', `Bs${totalPendiente.toFixed(2)}`]
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: '#2E86C1' },
        subHeader: { fontSize: 14, italics: true, color: '#555555' },
        pedidoCliente: { fontSize: 12, bold: true, color: '#1F618D', margin: [0, 5, 0, 0] },
        totalesPedido: { fontSize: 10, margin: [0, 2, 0, 5] },
        tableHeader: { bold: true, fillColor: '#D6EAF8' }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_cliente_${clienteNombre}_${mes}.pdf`);
      res.send(result);
    });
    pdfDoc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando PDF mensual del cliente');
  }
});

module.exports = router;
