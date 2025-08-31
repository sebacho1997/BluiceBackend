const PdfPrinter = require('pdfmake');
const ReporteModel = require('../models/ReporteModel');

class ReporteController {
  static async generarReporte(req, res) {
    const { conductorId } = req.params;
    console.log('Conductor ID:', conductorId);

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
      const conductor = await ReporteModel.getConductorById(conductorId);
      const conductorNombre = conductor ? conductor.nombre : 'Desconocido';

      const pedidos = await ReporteModel.getPedidosDia(conductorId);
      if (!pedidos.length) return res.status(404).send('No hay pedidos para este conductor hoy');

      const pedidoIds = pedidos.map(p => p.pedido_id);
      const productosMap = await ReporteModel.getProductosPorPedidos(pedidoIds);
      const pagosMap = await ReporteModel.getPagosPorPedidos(pedidoIds);

      const contentPedidos = pedidos.map(p => {
        const productos = productosMap[p.pedido_id] || [];
        const pago = pagosMap[p.pedido_id] || { efectivo: 0, qr: 0 };
        const totalPedido = productos.reduce((sum, pr) => sum + parseFloat(pr.subtotal), 0);
        const pendientePedido = Math.max(totalPedido - (pago.efectivo + pago.qr), 0);

        const productosTable = {
          table: {
            widths: ['*', 60, 80, 80],
            body: [
              [
                { text: 'Producto', style: 'tableHeader' },
                { text: 'Cantidad', style: 'tableHeader' },
                { text: 'Precio Unitario', style: 'tableHeader' },
                { text: 'Subtotal', style: 'tableHeader' }
              ],
              ...productos.map(pr => [
                pr.producto_nombre,
                pr.cantidad.toString(),
                pr.preciounitario.toString(),
                pr.subtotal.toString()
              ])
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 5, 0, 10]
        };

        return {
          stack: [
            { text: `Cliente: ${p.cliente_nombre}`, style: 'pedidoCliente' },
            { text: `Pedido ID: ${p.pedido_id}`, style: 'pedidoId' },
            productosTable,
            { text: `Total: $${totalPedido.toString()} | Efectivo: $${pago.efectivo.toString()} | QR: $${pago.qr.toString()} | Pendiente: $${pendientePedido.toString()}`, style: 'totalesPedido' },
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 1, lineColor: '#CCCCCC' }], margin: [0, 5, 0, 5] }
          ]
        };
      });

      const docDefinition = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [40, 40, 40, 40],
        content: [
          { text: 'Reporte Diario de Ventas', style: 'header', alignment: 'center' },
          { text: `Conductor: ${conductorNombre}`, style: 'subHeader', alignment: 'center' },
          { text: `Fecha: ${new Date().toLocaleDateString()}\n\n`, alignment: 'center' },
          ...contentPedidos
        ],
        styles: {
          header: { fontSize: 20, bold: true, color: '#2E86C1' },
          subHeader: { fontSize: 14, italics: true, color: '#555555' },
          pedidoCliente: { fontSize: 12, bold: true, color: '#1F618D', margin: [0, 5, 0, 0] },
          pedidoId: { fontSize: 10, color: '#555555', margin: [0, 0, 0, 5] },
          totalesPedido: { fontSize: 10, margin: [0, 2, 0, 5] },
          tableHeader: { bold: true, fillColor: '#D6EAF8' }
        }
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_${conductorNombre}.pdf`);
      pdfDoc.pipe(res);
      pdfDoc.end();

    } catch (err) {
      console.error(err);
      res.status(500).send('Error generando PDF');
    }
  }
}

module.exports = ReporteController;
