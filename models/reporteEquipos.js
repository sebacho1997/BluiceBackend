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

router.get('/reporte-equipos', async (req, res) => {
  const printer = createPrinter();

  try {
    const equiposRes = await pool.query(
      `SELECT id, nombre, descripcion, precio, stock FROM equipos ORDER BY nombre`
    );
    const equipos = equiposRes.rows;
    if (!equipos.length) return res.status(404).send('No hay equipos registrados');

    const movimientosRes = await pool.query(
      `SELECT me.*, e.nombre AS equipo_nombre, e.precio AS equipo_precio,
              uc.nombre AS cliente_nombre, uco.nombre AS conductor_nombre
       FROM movimiento_equipos me
       JOIN equipos e ON e.id = me.id_equipo
       LEFT JOIN usuarios uc ON uc.id = me.id_cliente
       LEFT JOIN usuarios uco ON uco.id = me.id_conductor
       WHERE COALESCE(uc.su, false) = false
       ORDER BY me.fecha_registro DESC
       LIMIT 500`
    );
    const movimientos = movimientosRes.rows;

    const totalStock = equipos.reduce((sum, e) => sum + Number(e.stock || 0), 0);
    const valorInventario = equipos.reduce((sum, e) => sum + (Number(e.precio || 0) * Number(e.stock || 0)), 0);
    const ventas = movimientos.filter(m => m.tipo === 'venta');
    const prestamos = movimientos.filter(m => m.tipo === 'prestamo');
    const ingresosVentas = ventas.reduce((sum, m) => sum + Number(m.monto || 0), 0);

    const equiposRows = equipos.map(e => [
      e.nombre,
      e.descripcion || '-',
      formatCurrency(e.precio),
      String(e.stock),
      formatCurrency(Number(e.precio || 0) * Number(e.stock || 0))
    ]);

    const ventasRows = ventas.slice(0, 100).map(m => [
      formatDate(m.fecha_registro),
      m.equipo_nombre,
      m.cliente_nombre || '-',
      String(m.cantidad),
      formatCurrency(m.monto),
      m.estado
    ]);

    const prestamosRows = prestamos.slice(0, 100).map(m => [
      formatDate(m.fecha_registro),
      m.equipo_nombre,
      m.cliente_nombre || '-',
      m.conductor_nombre || '-',
      String(m.cantidad),
      m.con_garantia ? formatCurrency(m.monto_garantia) : '-',
      m.estado,
      m.fecha_entrega ? formatDate(m.fecha_entrega) : '-',
      m.fecha_devolucion ? formatDate(m.fecha_devolucion) : '-'
    ]);

    const content = [
      sectionTitle('Resumen de inventario'),
      buildSummaryTable([
        { label: 'Total equipos', value: String(equipos.length) },
        { label: 'Stock total', value: String(totalStock) },
        { label: 'Valor del inventario', value: formatCurrency(valorInventario), tone: 'warning' },
        { label: 'Ventas realizadas', value: String(ventas.length), tone: 'success' },
        { label: 'Ingresos por ventas', value: formatCurrency(ingresosVentas), tone: 'success' },
        { label: 'Prestamos activos', value: String(prestamos.filter(m => m.estado !== 'devuelto').length), tone: 'danger' }
      ], 3),
      sectionTitle('Catalogo de equipos'),
      buildDataTable(
        ['Equipo', 'Descripcion', 'Precio Unitario', 'Stock', 'Valor Total'],
        equiposRows.length ? equiposRows : [['Sin datos', '-', '-', '-', '-']],
        ['*', '*', 90, 60, 90]
      ),
      sectionTitle('Ventas de equipos'),
      buildDataTable(
        ['Fecha', 'Equipo', 'Cliente', 'Cantidad', 'Monto', 'Estado'],
        ventasRows.length ? ventasRows : [['Sin datos', '-', '-', '-', '-', '-']],
        [70, '*', '*', 55, 80, 70]
      ),
      sectionTitle('Prestamos de equipos'),
      buildDataTable(
        ['Fecha', 'Equipo', 'Cliente', 'Conductor', 'Cant.', 'Garantia', 'Estado', 'Entrega', 'Devolucion'],
        prestamosRows.length ? prestamosRows : [['Sin datos', '-', '-', '-', '-', '-', '-', '-', '-']],
        [60, '*', 80, 80, 40, 70, 65, 60, 60]
      )
    ];

    const docDefinition = buildDocDefinition({
      title: 'Reporte de Equipos',
      subtitleLines: [`Catalogo, ventas y prestamos`],
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
          subjectName: 'general',
          reportType: 'inventario',
          reportDate: new Date()
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando reporte de equipos');
  }
});

module.exports = router;
