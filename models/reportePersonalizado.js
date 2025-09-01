const pool = require('../config/db');
const PdfPrinter = require('pdfmake');

const fonts = {
  Roboto: {
    normal: 'node_modules/pdfmake/fonts/Roboto-Regular.ttf',
    bold: 'node_modules/pdfmake/fonts/Roboto-Medium.ttf',
    italics: 'node_modules/pdfmake/fonts/Roboto-Italic.ttf',
    bolditalics: 'node_modules/pdfmake/fonts/Roboto-MediumItalic.ttf',
  },
};
const printer = new PdfPrinter(fonts);

exports.reporteDetallePersonalizado = async (req, res) => {
  try {
    const { conductorId, startDate, endDate } = req.params;

    // Ventas
    const ventasQuery = `
      SELECT p.nombre, SUM(dp.cantidad) as cantidad, SUM(dp.cantidad * dp.precio_unitario) as total
      FROM pedidos pe
      INNER JOIN detalle_pedidos dp ON pe.id = dp.id_pedido
      INNER JOIN productos p ON dp.id_producto = p.id
      WHERE pe.id_conductor = $1
        AND pe.fecha::date BETWEEN $2::date AND $3::date
      GROUP BY p.nombre
      ORDER BY p.nombre;
    `;
    const ventasResult = await pool.query(ventasQuery, [conductorId, startDate, endDate]);

    // Total ventas
    const totalVentasQuery = `
      SELECT SUM(dp.cantidad * dp.precio_unitario) as total_ventas
      FROM pedidos pe
      INNER JOIN detalle_pedidos dp ON pe.id = dp.id_pedido
      WHERE pe.id_conductor = $1
        AND pe.fecha::date BETWEEN $2::date AND $3::date
    `;
    const totalVentasResult = await pool.query(totalVentasQuery, [conductorId, startDate, endDate]);

    // Gastos
    const gastosQuery = `
      SELECT SUM(monto) as total_gastos
      FROM gastos
      WHERE id_conductor = $1
        AND fecha::date BETWEEN $2::date AND $3::date
    `;
    const gastosResult = await pool.query(gastosQuery, [conductorId, startDate, endDate]);

    const totalVentas = totalVentasResult.rows[0].total_ventas || 0;
    const totalGastos = gastosResult.rows[0].total_gastos || 0;
    const totalNeto = totalVentas - totalGastos;

    // PDF
    const docDefinition = {
      content: [
        { text: `Reporte Detallado Conductor #${conductorId}`, style: 'header' },
        { text: `Desde: ${startDate}   Hasta: ${endDate}`, margin: [0, 0, 0, 20] },
        { text: 'Ventas por Producto', style: 'subheader' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: [
              ['Producto', 'Cantidad', 'Total'],
              ...ventasResult.rows.map(v => [
                v.nombre,
                v.cantidad,
                `Bs ${v.total}`
              ])
            ]
          },
          margin: [0, 0, 0, 20]
        },
        { text: `Total Ventas: Bs ${totalVentas}`, bold: true },
        { text: `Total Gastos: Bs ${totalGastos}`, bold: true, margin: [0, 10, 0, 0] },
        { text: `Total Neto: Bs ${totalNeto}`, bold: true, margin: [0, 10, 0, 0] }
      ],
      styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 13, bold: true, margin: [0, 10, 0, 5] }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error('Error en ReporteController.reporteDetallePersonalizado:', error);
    res.status(500).json({ error: 'Error generando reporte' });
  }
};
