const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const {
  createPrinter,
  buildReportFilename,
  buildSummaryTable,
  buildDataTable,
  buildDocDefinition,
  sectionTitle
} = require('./reportPdfUtils');

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
          'Sin direccion registrada'
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

    const clientesRows = clientes.map((c, i) => [
      String(i + 1),
      c.nombre || '-',
      c.telefono || '-',
      c.email || '-',
      c.direcciones || 'Sin direccion registrada'
    ]);

    const docDefinition = buildDocDefinition({
      title: 'Lista de Clientes',
      subtitleLines: [`Total: ${clientes.length} cliente(s)`],
      content: [
        sectionTitle('Listado completo'),
        buildDataTable(
          ['#', 'Nombre', 'Telefono', 'Email', 'Direccion'],
          clientesRows,
          [30, 140, 90, 160, '*']
        )
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
          entityType: 'clientes',
          subjectName: 'lista',
          reportType: 'general',
          reportDate: new Date()
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
