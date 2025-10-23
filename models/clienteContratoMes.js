const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const pool = require('../config/db');

// 📌 Reporte mensual de contratos por cliente
router.get('/reporte-contratos-cliente-mes/:clienteId/:anio/:mes', async (req, res) => {
  const { clienteId, anio, mes } = req.params; // ejemplo: anio=2025, mes=9

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
    // Nombre del cliente
    const clienteRes = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'cliente'`,
      [clienteId]
    );
    const clienteNombre = clienteRes.rows.length ? clienteRes.rows[0].nombre : 'Desconocido';

    // Contratos del cliente
    const contratosRes = await pool.query(
      `SELECT id AS contrato_id FROM contratos WHERE cliente_id = $1`,
      [clienteId]
    );
    const contratoIds = contratosRes.rows.map(c => c.contrato_id);
    if (!contratoIds.length) return res.status(404).send('No hay contratos para este cliente');

    // Consumos por contrato en el mes
    const consumosRes = await pool.query(
      `SELECT cc.id AS consumo_id, cc.contrato_id, cc.monto_consumido, cc.fecha_entrega
       FROM consumos_contrato cc
       WHERE cc.contrato_id = ANY($1)
         AND EXTRACT(YEAR FROM cc.fecha_entrega) = $2
         AND EXTRACT(MONTH FROM cc.fecha_entrega) = $3
       ORDER BY cc.contrato_id, cc.id`,
      [contratoIds, anio, mes]
    );
    const consumos = consumosRes.rows;
    const consumoIds = consumos.map(c => c.consumo_id);
    if (!consumoIds.length) return res.status(404).send('No hay consumos en este mes');

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
    const contentContratos = [];
    let contratoAnterior = null;

    consumos.forEach(c => {
      if (c.contrato_id !== contratoAnterior) {
        contentContratos.push({
          text: `Contrato ID: ${c.contrato_id}`,
          style: 'contratoHeader',
          margin: [0, 10, 0, 5]
        });
        contratoAnterior = c.contrato_id;
      }

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

      contentContratos.push({
        stack: [
          { text: `Consumo ID: ${c.consumo_id} | Fecha: ${new Date(c.fecha_entrega).toLocaleDateString()}`, style: 'consumoId' },
          productosTable,
          { text: `Monto Consumido: Bs${c.monto_consumido}`, style: 'totalesConsumo' },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 1, lineColor: '#CCCCCC' }], margin: [0, 5, 0, 5] }
        ]
      });
    });

    // Resumen de productos totales
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
        { text: `Reporte Mensual de Contratos - ${mes}/${anio}`, style: 'header', alignment: 'center' },
        { text: `Cliente: ${clienteNombre}`, style: 'subHeader', alignment: 'center' },
        '\n',
        ...contentContratos,
        { text: 'Resumen Total de Productos', style: 'header', margin: [0, 10, 0, 5] },
        resumenTable
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: '#2E86C1' },
        subHeader: { fontSize: 14, italics: true, color: '#555555' },
        contratoHeader: { fontSize: 14, bold: true, color: '#D35400', margin: [0, 5, 0, 5] },
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
      res.setHeader('Content-Disposition', `attachment; filename=reporte_mensual_contratos_${clienteNombre}_${mes}_${anio}.pdf`);
      res.send(result);
    });
    pdfDoc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando PDF de contratos del mes');
  }
});

module.exports = router;
