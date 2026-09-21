const pool = require('../config/db');

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

      const result = await pool.query(
        `INSERT INTO recibos_impresos (pedido_id, numero_recibo, tipo, datos_recibo)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
        [pedido_id, numero_recibo || null, tipoRecibo, datos ? JSON.stringify(datos) : null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error al guardar recibo:', error);
      res.status(500).json({ error: 'Error al guardar recibo' });
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
};

module.exports = ReciboImpresoController;
