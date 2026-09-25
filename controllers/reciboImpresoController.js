const pool = require('../config/db');
const { actualizarDatosRecibo, listarRecibos } = require('../models/reciboImpreso');
const {
  createPrinter,
  buildReportFilename,
  formatCurrency,
  formatDate,
  buildDataTable,
  buildDocDefinition,
  sectionTitle
} = require('../models/reportPdfUtils');

// Para contrato y boliche NO se guardan precios ni totales: solo se guarda el
// detalle (nombre y cantidad). Solo el recibo "particular" conserva los montos.
function sanitizarDatos(datos, tipo) {
  if (!datos) return null;

  const copia = JSON.parse(JSON.stringify(datos));
  const sinMontos = tipo === 'contrato' || tipo === 'boliche';

  if (sinMontos) {
    if (Array.isArray(copia.productos)) {
      copia.productos = copia.productos.map((p) => {
        if (!p || typeof p !== 'object') return {};
        return {
          nombre: p.nombre,
          cantidad: p.cantidad,
        };
      });
    }
    delete copia.monto_total;
    delete copia.monto_pagado;
    delete copia.monto_pendiente;
  }

  return copia;
}

const ReciboImpresoController = {
  async guardar(req, res) {
    try {
      const { pedido_id, numero_recibo, tipo, datos_recibo } = req.body;
      if (!pedido_id) {
        return res.status(400).json({ error: 'pedido_id es requerido' });
      }

      const tipoRecibo = (tipo || 'particular').toString().toLowerCase();
      const datos = sanitizarDatos(datos_recibo, tipoRecibo);

      const recibo = await actualizarDatosRecibo({
        tabla: 'recibos_impresos',
        pedido_id,
        numero_recibo: String(numero_recibo || ''),
        tipo: tipoRecibo,
        datos_recibo: datos,
      });

      res.status(201).json(recibo);
    } catch (error) {
      console.error('Error al guardar recibo:', error);
      res.status(500).json({ error: 'Error al guardar recibo' });
    }
  },

  async guardarMovimiento(req, res) {
    try {
      const { id_movimiento, numero_recibo, tipo, datos_recibo } = req.body;
      if (!id_movimiento) {
        return res.status(400).json({ error: 'id_movimiento es requerido' });
      }

      const tipoRecibo = (tipo || 'garantia').toString().toLowerCase();
      const datos = sanitizarDatos(datos_recibo, tipoRecibo);

      const recibo = await actualizarDatosRecibo({
        tabla: 'recibos_movimiento',
        id_movimiento,
        numero_recibo: String(numero_recibo || ''),
        tipo: tipoRecibo,
        datos_recibo: datos,
      });

      res.status(201).json(recibo);
    } catch (error) {
      console.error('Error al guardar recibo de movimiento:', error);
      res.status(500).json({ error: 'Error al guardar recibo de movimiento' });
    }
  },

  async listarPorPedido(req, res) {
    try {
      const { pedido_id } = req.params;
      const result = await pool.query(
        `SELECT * FROM recibos_impresos WHERE pedido_id = $1 ORDER BY created_at DESC`,
        [pedido_id]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error al listar recibos:', error);
      res.status(500).json({ error: 'Error al listar recibos' });
    }
  },

  // GET /api/recibos?tipo=&mes=&busqueda=&conductor_id=&limite=
  async listar(req, res) {
    try {
      const { tipo, mes, busqueda, conductor_id, limite } = req.query;
      const recibos = await listarRecibos({
        tipo,
        mes,
        busqueda,
        conductor_id,
        limite,
      });
      res.json(recibos);
    } catch (error) {
      console.error('Error al listar todos los recibos:', error);
      res.status(500).json({ error: 'Error al listar los recibos' });
    }
  },

  // GET /api/recibos/pdf?tipo=&mes=&busqueda=&conductor_id=
  async listarPdf(req, res) {
    const printer = createPrinter();
    try {
      const { tipo, mes, busqueda, conductor_id } = req.query;
      const recibos = await listarRecibos({
        tipo,
        mes,
        busqueda,
        conductor_id,
        limite: 5000,
      });

      if (!recibos.length) {
        return res.status(404).send('No hay recibos para los filtros seleccionados');
      }

      const tituloTipo = tipo ? String(tipo).toUpperCase() : 'TODOS';
      const rows = recibos.map((r) => {
        const datos = r.datos_recibo || {};
        const monto =
          datos.monto_total ?? datos.monto_garantia ?? 0;
        const pagado =
          r.tipo === 'garantia'
            ? datos.monto_garantia ?? 0
            : datos.monto_pagado ?? 0;
        return [
          String(r.numero_recibo || '-'),
          String(r.tipo || '-').toUpperCase(),
          String(r.conductor_nombre || 'Sin conductor'),
          String(datos.cliente_nombre || '-'),
          formatDate(r.created_at),
          formatCurrency(monto),
          formatCurrency(pagado)
        ];
      });

      const docDefinition = buildDocDefinition({
        title: 'Reporte de Recibos',
        subtitleLines: [
          `Tipo: ${tituloTipo}${mes ? ` | Mes: ${mes}` : ''}`,
          `Total de recibos: ${recibos.length}`
        ],
        content: [
          sectionTitle('Detalle de recibos'),
          buildDataTable(
            ['Nro.', 'Tipo', 'Conductor', 'Cliente', 'Fecha', 'Monto', 'Pagado'],
            rows,
            [65, 75, 110, '*', 75, 80, 80]
          )
        ]
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
            entityType: 'recibos',
            subjectName: 'recibos',
            reportType: tipo || 'todos',
            reportDate: mes || new Date().toISOString().split('T')[0]
          })}`
        );
        res.send(result);
      });
      pdfDoc.end();
    } catch (error) {
      console.error('Error al generar PDF de recibos:', error);
      res.status(500).send('Error generando reporte de recibos');
    }
  },
};

module.exports = ReciboImpresoController;
