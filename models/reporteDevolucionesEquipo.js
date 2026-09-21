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

router.get('/reporte-devoluciones-equipos', async (req, res) => {
  const printer = createPrinter();

  try {
    const devolucionesRes = await pool.query(
      `SELECT de.*, me.tipo, me.cantidad, me.monto, me.con_garantia, me.monto_garantia,
              e.nombre AS equipo_nombre, e.descripcion AS equipo_descripcion,
              uc.nombre AS cliente_nombre, uco.nombre AS conductor_nombre
       FROM devolucion_equipo de
       JOIN movimiento_equipos me ON me.id = de.id_movimiento
       JOIN equipos e ON e.id = me.id_equipo
       LEFT JOIN usuarios uc ON uc.id = de.id_cliente
       LEFT JOIN usuarios uco ON uco.id = de.id_conductor
       ORDER BY de.fecha_devolucion DESC
       LIMIT 200`
    );
    const devoluciones = devolucionesRes.rows;

    const movimientosPendientes = await pool.query(
      `SELECT me.*, e.nombre AS equipo_nombre,
              uc.nombre AS cliente_nombre, uco.nombre AS conductor_nombre
       FROM movimiento_equipos me
       JOIN equipos e ON e.id = me.id_equipo
       LEFT JOIN usuarios uc ON uc.id = me.id_cliente
       LEFT JOIN usuarios uco ON uco.id = me.id_conductor
       WHERE me.tipo = 'prestamo'
         AND me.estado NOT IN ('devuelto')
       ORDER BY me.fecha_registro DESC`
    );
    const pendientes = movimientosPendientes.rows;

    const totalDevueltos = devoluciones.length;
    const prestamosPendientes = pendientes.length;
    const montosGarantia = devoluciones
      .filter(d => d.con_garantia)
      .reduce((sum, d) => sum + Number(d.monto_garantia || 0), 0);

    const devolucionesRows = devoluciones.map(d => [
      formatDate(d.fecha_devolucion),
      d.equipo_nombre,
      d.cliente_nombre || '-',
      d.conductor_nombre || '-',
      String(d.cantidad),
      d.estado_devolucion || '-',
      d.tipo,
      d.con_garantia ? formatCurrency(d.monto_garantia) : '-'
    ]);

    const pendientesRows = pendientes.map(p => [
      formatDate(p.fecha_registro),
      p.equipo_nombre,
      p.cliente_nombre || '-',
      p.conductor_nombre || '-',
      String(p.cantidad),
      p.con_garantia ? formatCurrency(p.monto_garantia) : '-',
      p.estado,
      p.nro_recibo || '-'
    ]);

    const content = [
      sectionTitle('Resumen de devoluciones'),
      buildSummaryTable([
        { label: 'Devoluciones realizadas', value: String(totalDevueltos), tone: 'success' },
        { label: 'Prestamos pendientes', value: String(prestamosPendientes), tone: prestamosPendientes > 0 ? 'danger' : 'success' },
        { label: 'Total garantias', value: formatCurrency(montosGarantia) }
      ], 3),
      sectionTitle('Devoluciones de equipo'),
      buildDataTable(
        ['Fecha', 'Equipo', 'Cliente', 'Conductor', 'Cant.', 'Condicion', 'Tipo', 'Garantia'],
        devolucionesRows.length ? devolucionesRows : [['Sin datos', '-', '-', '-', '-', '-', '-', '-']],
        [65, '*', 80, 80, 40, 80, 55, 70]
      ),
      sectionTitle('Prestamos pendientes de devolucion'),
      buildDataTable(
        ['Registro', 'Equipo', 'Cliente', 'Conductor', 'Cant.', 'Garantia', 'Estado', 'Recibo'],
        pendientesRows.length ? pendientesRows : [['Sin datos', '-', '-', '-', '-', '-', '-', '-']],
        [65, '*', 80, 80, 40, 70, 65, 65]
      )
    ];

    const docDefinition = buildDocDefinition({
      title: 'Reporte de Devoluciones de Equipos',
      subtitleLines: [`Fecha de corte: ${formatDate(new Date())}`],
      content
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
          entityType: 'equipos',
          subjectName: 'devoluciones',
          reportType: 'general',
          reportDate: new Date()
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando reporte de devoluciones de equipos');
  }
});

module.exports = router;
