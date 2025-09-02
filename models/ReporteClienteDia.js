const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const pool = require('../config/db');

router.get('/reporte-deudas-clientes', async (req, res) => {
  // Fuentes internas
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
    // Obtener deudas por cliente
    const clientesRes = await pool.query(`
      SELECT 
        u.id AS cliente_id,
        u.nombre AS cliente_nombre,
        u.telefono,
        u.email,
        SUM(p.monto_total) AS total_pedidos,
        SUM(p.monto_pagado) AS total_pagado,
        SUM(p.monto_pendiente) AS total_pendiente
      FROM usuarios u
      JOIN pedidos p ON u.id = p.usuario_id
      WHERE u.tipo_usuario = 'cliente'
      GROUP BY u.id, u.nombre, u.telefono, u.email
      HAVING SUM(p.monto_pendiente) > 0
      ORDER BY total_pendiente DESC
    `);

    const clientes = clientesRes.rows;
    if (!clientes.length) {
      return res.status(404).send('No hay clientes con deudas pendientes');
    }

    // Construir tabla PDF
    const tablaClientes = {
      table: {
        widths: [40, '*', 80, 120, 80, 80, 80],
        body: [
          [
            { text: 'ID', style: 'tableHeader' },
            { text: 'Cliente', style: 'tableHeader' },
            { text: 'Teléfono', style: 'tableHeader' },
            { text: 'Email', style: 'tableHeader' },
            { text: 'Total Pedidos', style: 'tableHeader' },
            { text: 'Pagado', style: 'tableHeader' },
            { text: 'Pendiente', style: 'tableHeader' }
          ],
          ...clientes.map(c => [
            c.cliente_id.toString(),
            c.cliente_nombre,
            c.telefono || '',
            c.email,
            `Bs${parseFloat(c.total_pedidos).toFixed(2)}`,
            `Bs${parseFloat(c.total_pagado).toFixed(2)}`,
            { text: `Bs${parseFloat(c.total_pendiente).toFixed(2)}`, color: 'red', bold: true }
          ])
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 5, 0, 15]
    };

    // Totales generales
    const totalGeneral = clientes.reduce((acc, c) => acc + parseFloat(c.total_pendiente), 0);

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Reporte de Deudas por Cliente', style: 'header', alignment: 'center' },
        { text: `Fecha: ${new Date().toLocaleDateString()}\n\n`, alignment: 'center' },
        tablaClientes,
        {
          text: `Deuda Total General: Bs${totalGeneral.toFixed(2)}`,
          style: 'totales',
          alignment: 'right',
          margin: [0, 20, 0, 0]
        }
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: '#2E86C1' },
        subHeader: { fontSize: 14, italics: true, color: '#555555' },
        tableHeader: { bold: true, fillColor: '#D6EAF8' },
        totales: { fontSize: 14, bold: true, color: 'red' }
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
