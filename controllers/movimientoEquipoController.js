const MovimientoEquipo = require('../models/movimientoEquipo');

const movimientoEquipoController = {
  async create(req, res) {
    try {
      const { tipo, id_equipo, id_cliente, id_conductor, cantidad, monto, con_garantia, monto_garantia } = req.body;
      const movimiento = await MovimientoEquipo.create({
        tipo,
        id_equipo,
        id_cliente,
        id_conductor,
        cantidad,
        monto,
        con_garantia,
        monto_garantia,
      });
      res.status(201).json(movimiento);
    } catch (error) {
      if (error.code === 'STOCK_INSUFICIENTE') {
        return res.status(400).json({
          error: 'Stock insuficiente',
          stock_disponible: error.stock_disponible,
        });
      }
      console.error('Error al crear movimiento de equipo:', error);
      res.status(500).json({ error: error.message || 'No se pudo crear el movimiento' });
    }
  },

  async getAll(req, res) {
    try {
      const { tipo } = req.query;
      const movimientos = await MovimientoEquipo.findAll(tipo);
      res.json(movimientos);
    } catch (error) {
      console.error('Error al obtener movimientos:', error);
      res.status(500).json({ error: 'No se pudieron obtener los movimientos' });
    }
  },

  async getById(req, res) {
    try {
      const movimiento = await MovimientoEquipo.findById(req.params.id);
      if (!movimiento) return res.status(404).json({ error: 'Movimiento no encontrado' });
      res.json(movimiento);
    } catch (error) {
      console.error('Error al obtener movimiento:', error);
      res.status(500).json({ error: 'No se pudo obtener el movimiento' });
    }
  },

  async entregar(req, res) {
    try {
      const { nro_recibo } = req.body;
      const movimiento = await MovimientoEquipo.entregar(req.params.id, nro_recibo);
      res.json(movimiento);
    } catch (error) {
      console.error('Error al entregar prestamo:', error);
      res.status(400).json({ error: error.message || 'No se pudo entregar el prestamo' });
    }
  },

  async devolver(req, res) {
    try {
      const { estado_devolucion } = req.body;
      const movimiento = await MovimientoEquipo.devolver(req.params.id, estado_devolucion);
      res.json(movimiento);
    } catch (error) {
      console.error('Error al devolver prestamo:', error);
      res.status(400).json({ error: error.message || 'No se pudo devolver el prestamo' });
    }
  },

  async delete(req, res) {
    try {
      const eliminado = await MovimientoEquipo.delete(req.params.id);
      res.json({ message: 'Movimiento eliminado correctamente', eliminado });
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      res.status(400).json({ error: error.message || 'No se pudo eliminar el movimiento' });
    }
  },
};

module.exports = movimientoEquipoController;