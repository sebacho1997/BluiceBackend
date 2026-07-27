const pool = require('../config/db');

const ReciboImpresoController = {
  async guardar(req, res) {
    try {
      const { pedido_id, numero_recibo, tipo, datos_recibo } = req.body;
      if (!pedido_id) {
        return res.status(400).json({ error: 'pedido_id es requerido' });
      }

      const result = await pool.query(
        `INSERT INTO recibos_impresos (pedido_id, numero_recibo, tipo, datos_recibo)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
        [pedido_id, numero_recibo || null, tipo || 'credito', datos_recibo ? JSON.stringify(datos_recibo) : null]
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
