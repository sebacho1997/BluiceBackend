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

router.get('/reporte-consumos-personalizado/:conductorId/:fechaInicio/:fechaFin', async (req, res) => {
  const { conductorId, fechaInicio, fechaFin } = req.params;
  const printer = createPrinter();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
    return res.status(400).send('Las fechas deben estar en formato YYYY-MM-DD');
  }

  try {
    const conductorRes = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
      [conductorId]
    );
    const conductorNombre = conductorRes.rows.length ? conductorRes.rows[0].nombre : 'Desconocido';

    const contratosRes = await pool.query(
      `SELECT id AS contrato_id, cliente_id FROM contratos WHERE conductor_id = $1`,
      [conductorId]
    );
    const contratoIds = contratosRes.rows.map(c => c.contrato_id);
    if (!contratoIds.length) return res.status(404).send('No hay contratos asignados a este conductor');

    const consumosRes = await pool.query(
      `SELECT cc.id AS consumo_id, cc.contrato_id, cc.monto_consumido, cc.fecha_entrega,
              u.nombre AS cliente_nombre
       FROM consumos_contrato cc
       JOIN contratos c ON c.id = cc.contrato_id
       JOIN usuarios u ON u.id = c.cliente_id
       WHERE cc.contrato_id = ANY($1)
         AND COALESCE(u.su, false) = false
         AND cc.fecha_entrega BETWEEN $2 AND $3
       ORDER BY cc.contrato_id, cc.fecha_entrega, cc.id`,
      [contratoIds, fechaInicio, fechaFin]
    );

    const consumos = consumosRes.rows;
    const consumoIds = consumos.map(c => c.consumo_id);
    if (!consumoIds.length) return res.status(404).send('No hay consumos en este rango de fechas');

    const detalleRes = await pool.query(
      `SELECT cd.consumo_id, p.idproducto AS producto_id, p.nombre AS producto_nombre, cd.cantidad
       FROM consumo_detalle cd
       JOIN productos p ON p.idproducto = cd.producto_id
       WHERE cd.consumo_id = ANY($1)`,
      [consumoIds]
    );

    const detalleMap = {};
    detalleRes.rows.forEach(d => {
      if (!detalleMap[d.consumo_id]) detalleMap[d.consumo_id] = [];
      detalleMap[d.consumo_id].push(d);
    });

    let totalProductos = {};
    let totalUnidades = 0;
    let totalMontoConsumido = 0;
    const consumosPorContrato = {};

    consumos.forEach(c => {
      if (!consumosPorContrato[c.contrato_id]) {
        consumosPorContrato[c.contrato_id] = {
          cliente_nombre: c.cliente_nombre,
          consumos: [],
          montoTotal: 0,
          unidadesTotal: 0
        };
      }

      const detalles = detalleMap[c.consumo_id] || [];
      let unidadesConsumo = 0;

      detalles.forEach(d => {
        if (!totalProductos[d.producto_nombre]) totalProductos[d.producto_nombre] = 0;
        totalProductos[d.producto_nombre] += parseInt(d.cantidad);
        totalUnidades += parseInt(d.cantidad);
        unidadesConsumo += parseInt(d.cantidad);
      });

      const montoConsumo = parseFloat(c.monto_consumido || 0);
      totalMontoConsumido += montoConsumo;

      consumosPorContrato[c.contrato_id].consumos.push({
        consumo_id: c.consumo_id,
        fecha_entrega: c.fecha_entrega,
        monto_consumido: montoConsumo,
        unidades: unidadesConsumo,
        detalles: detalles
      });
      consumosPorContrato[c.contrato_id].montoTotal += montoConsumo;
      consumosPorContrato[c.contrato_id].unidadesTotal += unidadesConsumo;
    });

    const contratosRows = Object.entries(consumosPorContrato)
      .sort((a, b) => b[1].montoTotal - a[1].montoTotal)
      .map(([contratoId, data]) => [
        `#${contratoId}`,
        data.cliente_nombre,
        String(data.consumos.length),
        String(data.unidadesTotal),
        formatCurrency(data.montoTotal)
      ]);

    const topProductosRows = Object.entries(totalProductos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nombre, cant]) => [nombre, String(cant)]);

    const content = [
      sectionTitle('Resumen del rango'),
      buildSummaryTable([
        { label: 'Consumos realizados', value: String(consumos.length) },
        { label: 'Unidades entregadas', value: String(totalUnidades) },
        { label: 'Monto total consumido', value: formatCurrency(totalMontoConsumido), tone: 'warning' },
        { label: 'Contratos activos', value: String(Object.keys(consumosPorContrato).length) }
      ], 4),
      sectionTitle('Resumen por contrato'),
      buildDataTable(
        ['Contrato', 'Cliente', 'Consumos', 'Unidades', 'Monto'],
        contratosRows.length ? contratosRows : [['Sin datos', '-', '-', '-', '-']],
        [60, '*', 65, 65, 90]
      ),
      sectionTitle('Productos mas entregados'),
      buildDataTable(
        ['Producto', 'Cantidad'],
        topProductosRows.length ? topProductosRows : [['Sin datos', '-']],
        ['*', 80]
      )
    ];

    Object.entries(consumosPorContrato)
      .sort((a, b) => a[0] - b[0])
      .forEach(([contratoId, data]) => {
        content.push(sectionTitle(`Contrato #${contratoId} - ${data.cliente_nombre}`));

        const consumoRows = data.consumos.map(c => [
          formatDate(c.fecha_entrega),
          `#${c.consumo_id}`,
          String(c.unidades),
          formatCurrency(c.monto_consumido)
        ]);

        content.push(buildDataTable(
          ['Fecha', 'Consumo', 'Unidades', 'Monto'],
          consumoRows,
          [70, 55, 60, 90]
        ));

        data.consumos.forEach(c => {
          if (c.detalles.length) {
            const detRows = c.detalles.map(d => [
              d.producto_nombre,
              String(d.cantidad)
            ]);
            content.push(buildDataTable(
              ['Producto', 'Cantidad'],
              detRows,
              ['*', 80]
            ));
          }
        });
      });

    const docDefinition = buildDocDefinition({
      title: 'Reporte Personalizado de Consumos',
      subtitleLines: [
        `Conductor: ${conductorNombre}`,
        `Rango: ${fechaInicio} a ${fechaFin}`
      ],
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
          reportType: 'consumos_personalizado',
          reportDate: `${fechaInicio}_a_${fechaFin}`
        })}`
      );
      res.send(result);
    });
    pdfDoc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando PDF de consumos personalizado');
  }
});

module.exports = router;
