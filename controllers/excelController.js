const pool = require('../config/db');
const ExcelJS = require('exceljs');

const ExcelController = {
  async exportReconciliacion(req, res) {
    try {
      const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
      const fechaFiltro = `p.fecha_entrega::date = '${fecha}'::date`;

      const conductores = await pool.query(
        `SELECT id, nombre FROM usuarios WHERE tipo_usuario = 'conductor' AND activado = true ORDER BY nombre`
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Blu Ice';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet(`Cuadre ${fecha}`);

      sheet.columns = [
        { header: 'Conductor', key: 'conductor', width: 25 },
        { header: 'Ventas', key: 'ventas', width: 15 },
        { header: 'Cobrado', key: 'cobrado', width: 15 },
        { header: 'Efectivo', key: 'efectivo', width: 15 },
        { header: 'QR', key: 'qr', width: 15 },
        { header: 'Otros', key: 'otros', width: 15 },
        { header: 'Pendiente', key: 'pendiente', width: 15 },
        { header: 'Diferencia', key: 'diferencia', width: 15 },
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

      let totalVentas = 0, totalCobrado = 0, totalEfectivo = 0, totalQr = 0, totalOtros = 0;

      for (const conductor of conductores.rows) {
        const pedidos = await pool.query(
          `SELECT p.id, p.monto_total, p.monto_pagado
           FROM pedidos p
           JOIN usuarios u ON u.id = p.usuario_id
           WHERE p.id_conductor = $1
             AND ${fechaFiltro}
             AND p.estado IN ('entregado', 'completado', 'pagado')
             AND COALESCE(u.su, false) = false`,
          [conductor.id]
        );

        let ventas = 0, cobrado = 0, efectivo = 0, qr = 0, otros = 0;

        const pedidoIds = pedidos.rows.map(p => p.id);
        if (pedidoIds.length > 0) {
          const pagos = await pool.query(
            `SELECT metodo_pago, SUM(monto_pagado) AS total
             FROM pagos_pedido
             WHERE pedido_id = ANY($1::int[])
             GROUP BY metodo_pago`,
            [pedidoIds]
          );

          for (const pago of pagos.rows) {
            const monto = parseFloat(pago.total) || 0;
            if (pago.metodo_pago === 'efectivo') efectivo += monto;
            else if (pago.metodo_pago === 'qr') qr += monto;
            else otros += monto;
          }

          for (const p of pedidos.rows) {
            ventas += parseFloat(p.monto_total) || 0;
            cobrado += parseFloat(p.monto_pagado) || 0;
          }
        }

        const pendiente = ventas - cobrado;
        const diferencia = ventas - cobrado;

        totalVentas += ventas;
        totalCobrado += cobrado;
        totalEfectivo += efectivo;
        totalQr += qr;
        totalOtros += otros;

        sheet.addRow({
          conductor: conductor.nombre,
          ventas, cobrado, efectivo, qr, otros, pendiente, diferencia,
        });
      }

      const totalRow = sheet.addRow({
        conductor: 'TOTAL',
        ventas: totalVentas,
        cobrado: totalCobrado,
        efectivo: totalEfectivo,
        qr: totalQr,
        otros: totalOtros,
        pendiente: totalVentas - totalCobrado,
        diferencia: totalVentas - totalCobrado,
      });
      totalRow.font = { bold: true };
      totalRow.getCell('conductor').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="cuadre_${fecha}.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error exportando Excel:', error);
      res.status(500).json({ error: 'Error al exportar Excel' });
    }
  },
};

module.exports = ExcelController;
