const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const pool = require('../config/db');

router.get('/reporte-consumos-dia/:conductorId', async (req, res) => {
  const { conductorId } = req.params;

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
    // Nombre del conductor
    const conductorRes = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
      [conductorId]
    );
    const conductorNombre = conductorRes.rows.length ? conductorRes.rows[0].nombre : 'Desconocido';

    // Contratos asignados al conductor
    const contratosRes = await pool.query(
      `SELECT id AS contrato_id, cliente_id FROM contratos WHERE conductor_id = $1`,
      [conductorId]
    );
    const contratoIds = contratosRes.rows.map(c => c.contrato_id);
    if (!contratoIds.length) return res.status(404).send('No hay contratos asignados a este conductor');

    // Consumos entregados hoy
    const consumosRes = await pool.query(
      `SELECT cc.id AS consumo_id, cc.contrato_id, cc.monto_consumido, cc.fecha_entrega,
              u.nombre AS cliente_nombre
       FROM consumos_contrato cc
       JOIN contratos c ON c.id = cc.contrato_id
       JOIN usuarios u ON u.id = c.cliente_id
       WHERE cc.contrato_id = ANY($1)
         AND cc.fecha_entrega = CURRENT_DATE
       ORDER BY cc.id`,
      [contratoIds]
    );

    const consumos = consumosRes.rows;
    const consumoIds = consumos.map(c => c.consumo_id);
    if (!consumoIds.length) return res.status(404).send('No hay consumos entregados hoy');

    // Detalle de productos por consumo
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

    // Construir contenido del PDF
    let totalProductos = {};

    const contentConsumidos = consumos.map(c => {
      const detalles = detalleMap[c.consumo_id] || [];

      detalles.forEach(d => {
        if (!totalProductos[d.producto_nombre]) totalProductos[d.producto_nombre] = 0;
        totalProductos[d.producto_nombre] += parseInt(d.cantidad);
      });

      const productosTable = {
        table: {
          widths: ['*', 80],
          body: [
            [{ text: 'Producto', style: 'tableHeader' }, { text: 'Cantidad', style: 'tableHeader' }],
            ...detalles.map(d => [d.producto_nombre, d.cantidad.toString()])
          ]
        },
        layout: 'lightHorizontalLines',
        margin: [0, 5, 0, 10]
      };

      return {
        stack: [
          { text: `Cliente: ${c.cliente_nombre}`, style: 'consumoCliente' },
          { text: `Consumo ID: ${c.consumo_id}`, style: 'consumoId' },
          productosTable,
          { text: `Monto Consumido: Bs${c.monto_consumido}`, style: 'totalesConsumo' },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 1, lineColor: '#CCCCCC' }], margin: [0, 5, 0, 5] }
        ]
      };
    });

    // Tabla resumen de productos totales
    const resumenTable = {
      table: {
        widths: ['*', 80],
        body: [
          [{ text: 'Producto', style: 'tableHeader' }, { text: 'Cantidad Total', style: 'tableHeader' }],
          ...Object.entries(totalProductos).map(([nombre, cant]) => [nombre, cant.toString()])
        ]
      },
      layout: 'lightHorizontalLines',
      margin: [0, 5, 0, 10]
    };

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Reporte Diario de Entregas', style: 'header', alignment: 'center' },
        { text: `Conductor: ${conductorNombre}`, style: 'subHeader', alignment: 'center' },
        { text: `Fecha: ${new Date().toLocaleDateString()}\n\n`, alignment: 'center' },
        ...contentConsumidos,
        { text: 'Resumen Total de Productos', style: 'header', margin: [0, 10, 0, 5] },
        resumenTable
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: '#2E86C1' },
        subHeader: { fontSize: 14, italics: true, color: '#555555' },
        consumoCliente: { fontSize: 12, bold: true, color: '#1F618D', margin: [0, 5, 0, 0] },
        consumoId: { fontSize: 10, color: '#555555', margin: [0, 0, 0, 5] },
        totalesConsumo: { fontSize: 10, margin: [0, 2, 0, 5] },
        tableHeader: { bold: true, fillColor: '#D6EAF8' }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_diario_${conductorNombre}.pdf`);
      res.send(result);
    });
    pdfDoc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando PDF de consumos del día');
  }
});

module.exports = router;
