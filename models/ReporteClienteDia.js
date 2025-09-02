const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const pool = require('../config/db');

router.get('/reporte-deudas-clientes', async (req, res) => {
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
    // Traer todos los pedidos con deuda y sus clientes
    const pedidosRes = await pool.query(`
      SELECT p.id AS pedido_id, p.usuario_id AS cliente_id, u.nombre AS cliente_nombre,
             u.telefono, u.email, p.monto_total, p.monto_pagado, p.monto_pendiente, 
             p.fecha_creacion
      FROM pedidos p
      JOIN usuarios u ON u.id = p.usuario_id AND u.tipo_usuario = 'cliente'
      WHERE p.monto_pendiente > 0
      ORDER BY u.id, p.fecha_creacion
    `);

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send('No hay pedidos con deudas');
    }

    const pedidoIds = pedidos.map(p => p.pedido_id);

    // Productos por pedido
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
      productosMap[pd.pedido_id].push(pd);
    });

    let deudaTotalGeneral = 0;
    const contentClientes = [];

    // Agrupar pedidos por cliente
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

    for (const clienteId in clientesMap) {
      const cliente = clientesMap[clienteId];
      let deudaCliente = 0;

      contentClientes.push({ text: `Cliente: ${cliente.cliente_nombre}`, style: 'clienteHeader' });
      contentClientes.push({ text: `Teléfono: ${cliente.telefono || ''} | Email: ${cliente.email}\n\n`, fontSize: 10 });

      cliente.pedidos.forEach(p => {
        deudaCliente += parseFloat(p.monto_pendiente);
        deudaTotalGeneral += parseFloat(p.monto_pendiente);

        const productos = productosMap[p.pedido_id] || [];
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
                `Bs${parseFloat(pr.preciounitario).toFixed(2)}`,
                `Bs${parseFloat(pr.subtotal).toFixed(2)}`
              ])
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 5, 0, 10]
        };

        contentClientes.push({
          stack: [
            { text: `Pedido ID: ${p.pedido_id} | Fecha: ${new Date(p.fecha_creacion).toLocaleDateString()}`, style: 'pedidoId' },
            productosTable,
            { text: `Total: Bs${parseFloat(p.monto_total).toFixed(2)} | Pagado: Bs${parseFloat(p.monto_pagado).toFixed(2)} | Pendiente: Bs${parseFloat(p.monto_pendiente).toFixed(2)}`, style: 'totalesPedido' },
            { text: '\n' }
          ]
        });
      });

      contentClientes.push({
        text: `Deuda Total del Cliente: Bs${deudaCliente.toFixed(2)}\n\n`,
        style: 'totalesCliente'
      });
      contentClientes.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 750, y2: 0, lineWidth: 1, lineColor: '#CCCCCC' }] });
    }

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Reporte de Deudas por Cliente', style: 'header', alignment: 'center' },
        { text: `Fecha: ${new Date().toLocaleDateString()}\n\n`, alignment: 'center' },
        ...contentClientes,
        { text: `\nDEUDA TOTAL GENERAL: Bs${deudaTotalGeneral.toFixed(2)}`, style: 'totalesGeneral', alignment: 'right' }
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: '#2E86C1' },
        clienteHeader: { fontSize: 14, bold: true, color: '#1F618D', margin: [0, 10, 0, 5] },
        pedidoId: { fontSize: 10, color: '#555555', margin: [0, 0, 0, 5] },
        totalesPedido: { fontSize: 10, margin: [0, 2, 0, 5] },
        totalesCliente: { fontSize: 12, bold: true, color: 'red', margin: [0, 5, 0, 10] },
        totalesGeneral: { fontSize: 16, bold: true, color: 'red' },
        tableHeader: { bold: true, fillColor: '#D6EAF8' }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_deudas_clientes.pdf');
      res.send(result);
    });
    pdfDoc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando reporte de deudas por cliente');
  }
});

module.exports = router;
