const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const {
  createPrinter,
  buildReportFilename,
  formatDate,
  buildSummaryTable,
  buildDataTable,
  buildDocDefinition,
  sectionTitle
} = require('./reportPdfUtils');

router.get('/reporte-inventario-conductor/:conductorId', async (req, res) => {
  const { conductorId } = req.params;
  const printer = createPrinter();

  try {
    const conductorRes = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
      [conductorId]
    );
    const conductorNombre = conductorRes.rows.length ? conductorRes.rows[0].nombre : 'Desconocido';

    const salidasRes = await pool.query(
      `SELECT ic.id, ic.estado, ic.fecha_creacion
       FROM inventario_conductor ic
       WHERE ic.conductor_id = $1
       ORDER BY ic.fecha_creacion DESC
       LIMIT 100`,
      [conductorId]
    );

    const salidas = salidasRes.rows;
    if (!salidas.length) return res.status(404).send('No hay inventarios de salida para este conductor');

    const salidaIds = salidas.map(s => s.id);

    const detalleSalidaRes = await pool.query(
      `SELECT icd.inventario_id, p.nombre AS producto_nombre, icd.cantidad
       FROM inventario_conductor_detalle icd
       JOIN productos p ON p.idproducto = icd.producto_id
       WHERE icd.inventario_id = ANY($1)
       ORDER BY icd.inventario_id, p.nombre`,
      [salidaIds]
    );

    const detalleSalidaMap = {};
    detalleSalidaRes.rows.forEach(d => {
      if (!detalleSalidaMap[d.inventario_id]) detalleSalidaMap[d.inventario_id] = [];
      detalleSalidaMap[d.inventario_id].push(d);
    });

    const restasRes = await pool.query(
      `SELECT icr.id, icr.estado, icr.fecha_creacion
       FROM inventario_conductor_resta icr
       WHERE icr.conductor_id = $1
       ORDER BY icr.fecha_creacion DESC
       LIMIT 100`,
      [conductorId]
    );
    const restas = restasRes.rows;
    const restaIds = restas.map(r => r.id);

    let detalleRestaMap = {};
    if (restaIds.length) {
      const detalleRestaRes = await pool.query(
        `SELECT icrd.inventario_id, p.nombre AS producto_nombre, icrd.cantidad
         FROM inventario_conductor_detalle_resta icrd
         JOIN productos p ON p.idproducto = icrd.producto_id
         WHERE icrd.inventario_id = ANY($1)
         ORDER BY icrd.inventario_id, p.nombre`,
        [restaIds]
      );
      detalleRestaRes.rows.forEach(d => {
        if (!detalleRestaMap[d.inventario_id]) detalleRestaMap[d.inventario_id] = [];
        detalleRestaMap[d.inventario_id].push(d);
      });
    }

    const devolucionesRes = await pool.query(
      `SELECT dc.id, dc.fecha_creacion
       FROM devolucion_conductor dc
       WHERE dc.conductor_id = $1
       ORDER BY dc.fecha_creacion DESC
       LIMIT 100`,
      [conductorId]
    );
    const devoluciones = devolucionesRes.rows;
    const devolucionIds = devoluciones.map(d => d.id);

    let detalleDevolucionMap = {};
    if (devolucionIds.length) {
      const detalleDevRes = await pool.query(
        `SELECT dcd.devolucion_id, p.nombre AS producto_nombre, dcd.cantidad
         FROM devolucion_conductor_detalle dcd
         JOIN productos p ON p.idproducto = dcd.producto_id
         WHERE dcd.devolucion_id = ANY($1)
         ORDER BY dcd.devolucion_id, p.nombre`,
        [devolucionIds]
      );
      detalleDevRes.rows.forEach(d => {
        if (!detalleDevolucionMap[d.devolucion_id]) detalleDevolucionMap[d.devolucion_id] = [];
        detalleDevolucionMap[d.devolucion_id].push(d);
      });
    }

    const salidasAbiertas = salidas.filter(s => s.estado === 'creado').length;
    const restasAbiertas = restas.filter(r => r.estado === 'creado').length;

    const resumenSalidas = salidas.map(s => {
      const detalles = detalleSalidaMap[s.id] || [];
      const totalUnidades = detalles.reduce((sum, d) => sum + Number(d.cantidad || 0), 0);
      return [
        `#${s.id}`,
        formatDate(s.fecha_creacion),
        s.estado,
        String(detalles.length),
        String(totalUnidades)
      ];
    });

    const resumenRestas = restas.map(r => {
      const detalles = detalleRestaMap[r.id] || [];
      const totalUnidades = detalles.reduce((sum, d) => sum + Number(d.cantidad || 0), 0);
      return [
        `#${r.id}`,
        formatDate(r.fecha_creacion),
        r.estado,
        String(detalles.length),
        String(totalUnidades)
      ];
    });

    const resumenDevoluciones = devoluciones.map(d => {
      const detalles = detalleDevolucionMap[d.id] || [];
      const totalUnidades = detalles.reduce((sum, dd) => sum + Number(dd.cantidad || 0), 0);
      return [
        `#${d.id}`,
        formatDate(d.fecha_creacion),
        String(detalles.length),
        String(totalUnidades)
      ];
    });

    const content = [
      sectionTitle('Resumen general'),
      buildSummaryTable([
        { label: 'Salidas totales', value: String(salidas.length) },
        { label: 'Salidas abiertas', value: String(salidasAbiertas), tone: salidasAbiertas > 0 ? 'warning' : 'success' },
        { label: 'Registros de resta', value: String(restas.length) },
        { label: 'Restas abiertas', value: String(restasAbiertas), tone: restasAbiertas > 0 ? 'warning' : 'success' },
        { label: 'Devoluciones', value: String(devoluciones.length) }
      ], 3),
      sectionTitle('Inventarios de salida'),
      buildDataTable(
        ['ID', 'Fecha', 'Estado', 'Productos', 'Unidades'],
        resumenSalidas.length ? resumenSalidas : [['Sin datos', '-', '-', '-', '-']],
        [40, 75, 65, 65, 60]
      ),
      sectionTitle('Registros de resta'),
      buildDataTable(
        ['ID', 'Fecha', 'Estado', 'Productos', 'Unidades'],
        resumenRestas.length ? resumenRestas : [['Sin datos', '-', '-', '-', '-']],
        [40, 75, 65, 65, 60]
      ),
      sectionTitle('Devoluciones de conductor'),
      buildDataTable(
        ['ID', 'Fecha', 'Productos', 'Unidades'],
        resumenDevoluciones.length ? resumenDevoluciones : [['Sin datos', '-', '-', '-']],
        [40, 75, 65, 60]
      )
    ];

    salidas.slice(0, 20).forEach(s => {
      const detalles = detalleSalidaMap[s.id] || [];
      if (detalles.length) {
        content.push(sectionTitle(`Detalle salida #${s.id} (${formatDate(s.fecha_creacion)})`));
        content.push(buildDataTable(
          ['Producto', 'Cantidad'],
          detalles.map(d => [d.producto_nombre, String(d.cantidad)]),
          ['*', 80]
        ));
      }
    });

    const docDefinition = buildDocDefinition({
      title: 'Reporte de Inventario del Conductor',
      subtitleLines: [`Conductor: ${conductorNombre}`],
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
          entityType: 'conductor',
          subjectName: conductorNombre,
          reportType: 'inventario',
          reportDate: new Date()
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando reporte de inventario del conductor');
  }
});

module.exports = router;
