const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const pool = require('../config/db');

router.get('/reporte-contratos-personalizado/:conductorId/:fechaInicio/:fechaFin', async (req, res) => {
  const { conductorId, fechaInicio, fechaFin } = req.params;

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

    // Contratos asignados del conductor
    const contratosRes = await pool.query(`
      SELECT c.id, c.cliente_id, u.nombre AS cliente_nombre,
             c.monto_total, c.monto_restante, c.fecha_inicio, c.fecha_fin, c.estado
      FROM contratos c
      JOIN usuarios u ON u.id = c.cliente_id
      WHERE c.conductor_id = $1
        AND c.estado = 'asignado'
      ORDER BY c.id
    `, [conductorId]);

    const contratos = contratosRes.rows;
    if (!contratos.length) return res.status(404).send('No hay contratos asignados para este conductor');

    const contratoIds = contratos.map(c => c.id);

    // Consumos dentro del rango de fechas
    const consumosRes = await pool.query(`
      SELECT cc.id AS consumo_id, cc.contrato_id, cc.fecha, cc.monto_consumido, cc.observaciones
      FROM consumos_contrato cc
      WHERE cc.contrato_id = ANY($1)
        AND cc.fecha BETWEEN $2 AND $3
      ORDER BY cc.fecha
    `, [contratoIds, fechaInicio, fechaFin]);

    const consumosMap = {};
    consumosRes.rows.forEach(cons => {
      if (!consumosMap[cons.contrato_id]) consumosMap[cons.contrato_id] = [];
      consumosMap[cons.contrato_id].push(cons);
    });

    const consumoIds = consumosRes.rows.map(c => c.consumo_id);
    const detallesRes = await pool.query(`
      SELECT cd.consumo_id, pr.nombre AS producto_nombre, cd.cantidad
      FROM consumo_detalle cd
      JOIN productos pr ON pr.idproducto = cd.producto_id
      WHERE cd.consumo_id = ANY($1)
    `, [consumoIds]);

    const detallesMap = {};
    detallesRes.rows.forEach(d => {
      if (!detallesMap[d.consumo_id]) detallesMap[d.consumo_id] = [];
      detallesMap[d.consumo_id].push(d);
    });

    // Contenido PDF
    const contentContratos = contratos.map(c => {
      const consumos = consumosMap[c.id] || [];

      const consumosContent = consumos.map(cons => {
        const productos = detallesMap[cons.consumo_id] || [];
        const productosTable = {
          table: {
            widths: ['*', 60],
            body: [
              [{ text: 'Producto', style: 'tableHeader' }, { text: 'Cantidad', style: 'tableHeader' }],
              ...productos.map(p => [p.producto_nombre, p.cantidad.toString()])
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 5, 0, 10]
        };

        return {
          stack: [
            { text: `Consumo ID: ${cons.consumo_id} | Fecha: ${cons.fecha}`, style: 'subHeader' },
            productosTable,
            { text: `Monto Consumido: Bs${cons.monto_consumido} | Observaciones: ${cons.observaciones || '-'}`, margin: [0, 0, 0, 5] }
          ]
        };
      });

      return {
        stack: [
          { text: `Cliente: ${c.cliente_nombre}`, style: 'contratoCliente' },
          { text: `Contrato ID: ${c.id} | Monto Total: Bs${c.monto_total} | Restante: Bs${c.monto_restante} | Periodo: ${c.fecha_inicio} a ${c.fecha_fin}`, style: 'contratoInfo' },
          ...consumosContent,
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 1, lineColor: '#CCCCCC' }], margin: [0, 5, 0, 5] }
        ]
      };
    });

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: `Reporte de Contratos y Consumos | ${fechaInicio} a ${fechaFin}`, style: 'header', alignment: 'center' },
        { text: `Conductor: ${conductorNombre}`, style: 'subHeader', alignment: 'center' },
        '\n',
        ...contentContratos
      ],
      styles: {
        header: { fontSize: 20, bold: true, color: '#2E86C1' },
        subHeader: { fontSize: 14, italics: true, color: '#555555' },
        contratoCliente: { fontSize: 12, bold: true, color: '#1F618D', margin: [0, 5, 0, 0] },
        contratoInfo: { fontSize: 10, color: '#555555', margin: [0, 0, 0, 5] },
        tableHeader: { bold: true, fillColor: '#D6EAF8' }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_contratos_personalizado_${conductorNombre}_${fechaInicio}_a_${fechaFin}.pdf`);
      res.send(result);
    });
    pdfDoc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando PDF de contratos personalizado');
  }
});

module.exports = router;
