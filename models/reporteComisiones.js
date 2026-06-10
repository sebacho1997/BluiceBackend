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
  buildDocDefinition,
  sectionTitle
} = require('./reportPdfUtils');

async function generarReporteComisiones({ res, conductorId, conductorNombre, subtitleLines, reportType, reportDateForFilename, whereSql, params }) {
  const printer = createPrinter();

  try {
    const rowsRes = await pool.query(
      `SELECT pr.nombre AS producto_nombre,
              SUM(pd.cantidad)::int AS unidades,
              SUM(pd.cantidad * pd.preciounitario) AS total_bs
       FROM pedidos p
       JOIN usuarios u ON u.id = p.usuario_id AND u.tipo_usuario = 'cliente'
       JOIN pedidoproducto pd ON pd.pedido_id = p.id
       JOIN productos pr ON pr.idproducto = pd.producto_id
       WHERE p.id_conductor = $1
         AND COALESCE(u.su, false) = false
         AND p.estado IN ('entregado', 'completado')
         ${whereSql}
       GROUP BY pr.nombre
       ORDER BY unidades DESC, producto_nombre ASC`,
      [conductorId, ...params]
    );

    const rows = rowsRes.rows;
    if (!rows.length) return res.status(404).send('No hay entregas en el periodo seleccionado');

    const totalUnidades = rows.reduce((sum, r) => sum + Number(r.unidades || 0), 0);
    const totalBs = rows.reduce((sum, r) => sum + Number(r.total_bs || 0), 0);

    const tableRows = rows.map((r) => [
      r.producto_nombre,
      String(Number(r.unidades || 0)),
      formatCurrency(Number(r.total_bs || 0))
    ]);

    const docDefinition = buildDocDefinition({
      title: 'Reporte de Comisiones (Productos Entregados)',
      subtitleLines: [
        `Conductor: ${conductorNombre}`,
        ...subtitleLines
      ],
      content: [
        sectionTitle('Resumen'),
        buildSummaryTable([
          { label: 'Productos (unidades)', value: String(totalUnidades) },
          { label: 'Total Bs (referencia)', value: formatCurrency(totalBs), tone: 'warning' }
        ], 3),
        sectionTitle('Detalle por producto'),
        buildDataTable(
          ['Producto', 'Unidades entregadas', 'Total Bs'],
          tableRows,
          ['*', 120, 120]
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
          entityType: 'comisiones',
          subjectName: conductorNombre,
          reportType,
          reportDate: reportDateForFilename
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (e) {
    console.error(e);
    res.status(500).send('Error generando reporte de comisiones');
  }
}

router.get('/reporte-comisiones-mes/:conductorId/:mes', async (req, res) => {
  const { conductorId, mes } = req.params;
  if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).send('El mes debe estar en formato YYYY-MM');

  const conductorRes = await pool.query(
    `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
    [conductorId]
  );
  const conductorNombre = conductorRes.rows.length ? conductorRes.rows[0].nombre : 'Desconocido';

  return generarReporteComisiones({
    res,
    conductorId,
    conductorNombre,
    subtitleLines: [`Periodo: ${mes}`],
    reportType: 'mensual',
    reportDateForFilename: mes,
    whereSql: `AND TO_CHAR(p.fecha_entrega, 'YYYY-MM') = $2`,
    params: [mes]
  });
});

router.get('/reporte-comisiones-personalizado/:conductorId/:startDate/:endDate', async (req, res) => {
  const { conductorId, startDate, endDate } = req.params;

  const conductorRes = await pool.query(
    `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
    [conductorId]
  );
  const conductorNombre = conductorRes.rows.length ? conductorRes.rows[0].nombre : 'Desconocido';

  return generarReporteComisiones({
    res,
    conductorId,
    conductorNombre,
    subtitleLines: [`Rango: ${startDate} a ${endDate}`],
    reportType: 'personalizado',
    reportDateForFilename: `${startDate}_a_${endDate}`,
    whereSql: `AND p.fecha_entrega::date BETWEEN $2 AND $3`,
    params: [startDate, endDate]
  });
});

module.exports = router;