const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const pool = require('../config/db');

// 📌 Reporte por mes
router.get('/reporte-detalle-mes/:conductorId/:mes', async (req, res) => {
  const { conductorId, mes } = req.params;

  // Validar mes
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).send("El mes debe estar en formato YYYY-MM");
  }

  // Fuentes internas del sistema
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
    // Obtener nombre del conductor
    const conductorRes = await pool.query(
      `SELECT nombre FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'`,
      [conductorId]
    );
    const conductorNombre = conductorRes.rows.length ? conductorRes.rows[0].nombre : 'Desconocido';

    // 📌 Pedidos del mes
    const pedidosRes = await pool.query(`
      SELECT p.id AS pedido_id, p.usuario_id AS cliente_id, u.nombre AS cliente_nombre,
             p.monto_total, p.monto_pendiente, p.monto_pagado, p.fecha_entrega::date
      FROM pedidos p
      JOIN usuarios u ON u.id = p.usuario_id AND u.tipo_usuario = 'cliente'
      WHERE p.id_conductor = $1
        AND p.estado IN ('entregado', 'completado')
        AND TO_CHAR(p.fecha_entrega, 'YYYY-MM') = $2
      ORDER BY p.fecha_entrega, p.id
    `, [conductorId, mes]);

    const pedidos = pedidosRes.rows;
    const pedidoIds = pedidos.map(p => p.pedido_id);
    if (!pedidoIds.length) return res.status(404).send(`No hay pedidos para el mes ${mes}`);

    // Productos por pedido
    const productosRes = await pool.query(`
      SELECT pd.pedido_id, pr.idproducto AS producto_id, pr.nombre AS producto_nombre,
             pd.cantidad, pd.preciounitario, (pd.cantidad * pd.preciounitario) AS subtotal
      FROM pedidoproducto pd
      JOIN productos pr ON pr.idproducto = pd.producto_id
      WHERE pd.pedido_id = ANY($1)
    `, [pedidoIds]);

    const productosMap = {};
    productosRes.rows.forEach(pd => {
      if (!productosMap[pd.pedido_id]) productosMap[pd.pedido_id] = [];
      productosMap[pd.pedido_id].push(pd);
    });

    // Pagos
    const pagosRes = await pool.query(`
      SELECT pedido_id, metodo_pago, SUM(monto_pagado) AS total
      FROM pagos_pedido
      WHERE pedido_id = ANY($1)
      GROUP BY pedido_id, metodo_pago
    `, [pedidoIds]);

    const pagosMap = {};
    pagosRes.rows.forEach(pg => {
      if (!pagosMap[pg.pedido_id]) pagosMap[pg.pedido_id] = { efectivo: 0, qr: 0 };
      if (pg.metodo_pago.toLowerCase() === 'efectivo') pagosMap[pg.pedido_id].efectivo = parseFloat(pg.total);
      if (pg.metodo_pago.toLowerCase() === 'qr') pagosMap[pg.pedido_id].qr = parseFloat(pg.total);
    });

    // Gastos del mes
    const gastosRes = await pool.query(`
      SELECT COALESCE(SUM(monto),0) AS total_gastos
      FROM gastos_dia
      WHERE id_conductor = $1
        AND TO_CHAR(fecha_gasto, 'YYYY-MM') = $2
    `, [conductorId, mes]);
    const totalGastos = parseFloat(gastosRes.rows[0].total_gastos);

    let totalEfectivo = 0, totalQr = 0, totalVentas = 0, pendienteCobro = 0;

    const contentPedidos = pedidos.map(p => {
      const productos = productosMap[p.pedido_id] || [];
      const pago = pagosMap[p.pedido_id] || { efectivo: 0, qr: 0 };
      const totalPedido = productos.reduce((sum, pr) => sum + parseFloat(pr.subtotal), 0);
      const pendientePedido = Math.max(totalPedido - (pago.efectivo + pago.qr), 0);

      totalEfectivo += pago.efectivo;
      totalQr += pago.qr;
      totalVentas += totalPedido;
      pendienteCobro += pendientePedido;

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
          { text: `Fecha: ${p.fecha_entrega.toLocaleDateString()} | Cliente: ${p.cliente_nombre}`, style: 'pedidoCliente' },
          { text: `Pedido ID: ${p.pedido_id}`, style: 'pedidoId' },
          productosTable,
          { text: `Total: Bs${totalPedido.toString()} | Efectivo: Bs${pago.efectivo.toString()} | QR: Bs${pago.qr.toString()} | Pendiente: Bs${pendientePedido.toString()}`, style: 'totalesPedido' },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 780, y2: 0, lineWidth: 1, lineColor: '#CCCCCC' }], margin: [0, 5, 0, 5] }
        ]
      };
    });

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Reporte Mensual de Ventas', style: 'header', alignment: 'center' },
        { text: `Conductor: ${conductorNombre}`, style: 'subHeader', alignment: 'center' },
        { text: `Mes: ${mes}\n\n`, alignment: 'center' },
        ...contentPedidos,
        { text: 'Totales Generales', style: 'header', margin: [0, 10, 0, 5] },
        {
          table: {
            widths: ['*', 120],
            body: [
              ['Total Efectivo', `Bs${totalEfectivo.toFixed(2)}`],
              ['Total QR', `Bs${totalQr.toFixed(2)}`],
              ['Total Gastos', `Bs${totalGastos.toFixed(2)}`],
              ['Efectivo Neto', `Bs${(totalEfectivo - totalGastos).toFixed(2)}`],
              ['Total Ventas', `Bs${totalVentas.toFixed(2)}`],
              ['Pendiente de Cobro', `Bs${pendienteCobro.toFixed(2)}`],
              ['Total Final', `Bs${(totalEfectivo - totalGastos + totalQr + pendienteCobro).toFixed(2)}`]
            ]
          },
          layout: 'lightHorizontalLines'
        }
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
    let chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_mensual_${conductorNombre}_${mes}.pdf`);
      res.send(result);
    });
    pdfDoc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generando PDF mensual');
  }
});

module.exports = router;
