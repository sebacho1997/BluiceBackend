const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const pool = require('../config/db');

router.get('/reporte-deudas-cliente/:clienteId', async (req, res) => {
  const { clienteId } = req.params;

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
    // Datos del cliente
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

    // Pedidos con deuda de este cliente
    const pedidosRes = await pool.query(`
      SELECT p.id AS pedido_id, p.monto_total, p.monto_pagado, 
             p.monto_pendiente, p.fecha_creacion, p.estado
      FROM pedidos p
      WHERE p.usuario_id = $1
        AND p.monto_pendiente > 0
      ORDER BY p.fecha_creacion
    `, [clienteId]);

    const pedidos = pedidosRes.rows;
    if (!pedidos.length) {
      return res.status(404).send('Este cliente no tiene pedidos con deudas');
    }

    const pedidoIds = pedidos.map(p => p.pedido_id);

    // Productos de los pedidos
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

    let deudaCliente = 0;
    const contentPedidos = [];

    pedidos.forEach(p => {
      deudaCliente += parseFloat(p.monto_pendiente);

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

      contentPedidos.push({
        stack: [
          { text: `Pedido ID: ${p.pedido_id} | Fecha: ${new Date(p.fecha_creacion).toLocaleDateString()} | Estado: ${p.estado}`, style: 'pedidoId' },
          productosTable,
          { text: `Total: Bs${parseFloat(p.monto_total).toFixed(2)} | Pagado: Bs${parseFloat(p.monto_pagado).toFixed(2)} | Pendiente: Bs${parseFloat(p.monto_pendiente).toFixed(2)}`, style: 'totalesPedido' },
          { text: '\n' }
        ]
      });
    });

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Reporte de Deudas del Cliente', style: 'header', alignment: 'center' },
        { text: `Fecha: ${new Date().toLocaleDateString()}\n\n`, alignment: 'center' },
        { text: `Cliente: ${cliente.nombre}`, style: 'clienteHeader' },
        { text: `Teléfono: ${cliente.telefono || ''} | Email: ${cliente.email}\n\n`, fontSize: 10 },
        ...contentPedidos,
        { text: `\nDEUDA TOTAL DEL CLIENTE: Bs${deudaCliente.toFixed(2)}`, style: 'totalesGeneral', alignment: 'right' }
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: '#2E86C1' },
        clienteHeader: { fontSize: 14, bold: true, color: '#1F618D', margin: [0, 10, 0, 5] },
        pedidoId: { fontSize: 10, color: '#555555', margin: [0, 0, 0, 5] },
        totalesPedido: { fontSize: 10, margin: [0, 2, 0, 5] },
        totalesGeneral: { fontSize: 14, bold: true, color: 'red', margin: [0, 5, 0, 10] },
        tableHeader: { bold: true, fillColor: '#D6EAF8' }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_deudas_cliente_${cliente.nombre}.pdf`);
      res.send(result);
    });
    pdfDoc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando reporte de deudas del cliente');
  }
});

module.exports = router;
