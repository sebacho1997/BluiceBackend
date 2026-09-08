const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { createPrinter, buildReportFilename } = require('./reportPdfUtils');

// GET /api/reporte-lista-clientes
// PDF con todos los clientes: nombre, teléfono, email y dirección(es).
router.get('/reporte-lista-clientes', async (req, res) => {
  const printer = createPrinter();

  try {
    const clientesRes = await pool.query(`
      SELECT u.id, u.nombre, u.telefono, u.email,
        COALESCE(
          (
            SELECT STRING_AGG(d.direccion, ' | ')
            FROM (
              SELECT DISTINCT direccion
              FROM direcciones
              WHERE id_usuario = u.id
                AND direccion IS NOT NULL
                AND direccion <> ''
            ) d
          ),
          'Sin dirección registrada'
        ) AS direcciones
      FROM usuarios u
      WHERE u.tipo_usuario = 'cliente'
        AND u.activado = true
        AND COALESCE(u.su, false) = false
      ORDER BY u.nombre
    `);

    const clientes = clientesRes.rows;
    if (!clientes.length) {
      return res.status(404).send('No hay clientes registrados');
    }

    const tableBody = [
      [
        { text: '#', style: 'tableHeader' },
        { text: 'Nombre', style: 'tableHeader' },
        { text: 'Teléfono', style: 'tableHeader' },
        { text: 'Email', style: 'tableHeader' },
        { text: 'Dirección', style: 'tableHeader' },
      ],
      ...clientes.map((c, i) => [
        (i + 1).toString(),
        c.nombre || '-',
        c.telefono || '-',
        c.email || '-',
        c.direcciones || 'Sin dirección registrada',
      ]),
    ];

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Lista de Clientes', style: 'header', alignment: 'center' },
        {
          text: `Fecha: ${new Date().toLocaleDateString('es-BO')} | Total: ${clientes.length} cliente(s)\n\n`,
          alignment: 'center',
        },
        {
          table: {
            headerRows: 1,
            widths: [30, 150, 90, 170, '*'],
            body: tableBody,
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: '#2E86C1' },
        tableHeader: { bold: true, fillColor: '#D6EAF8' },
      },
    };

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
          subjectName: 'lista',
          reportType: 'general',
          reportDate: new Date(),
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando la lista de clientes');
  }
});

module.exports = router;
