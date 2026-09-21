const DevolucionEquipo = require('../models/devolucionEquipo');

const DevolucionEquipoController = {
  async crear(req, res) {
    try {
      const { id_movimiento, id_conductor, id_cliente, estado_devolucion } = req.body;
      if (!id_movimiento || !id_conductor || !id_cliente) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
      }
      const devolucion = await DevolucionEquipo.crear({
        id_movimiento,
        id_conductor,
        id_cliente,
        estado_devolucion,
      });
      res.status(201).json(devolucion);
    } catch (error) {
      console.error('Error al crear devolución de equipo:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  },

  async listarPorConductor(req, res) {
    try {
      const { conductor_id } = req.params;
      if (!conductor_id) {
        return res.status(400).json({ error: 'Falta el id del conductor' });
      }
      const devoluciones = await DevolucionEquipo.findByConductor(conductor_id);
      res.json(devoluciones);
    } catch (error) {
      console.error('Error al listar devoluciones de equipo:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  },

  async listarTodas(req, res) {
    try {
      const devoluciones = await DevolucionEquipo.findAll();
      res.json(devoluciones);
    } catch (error) {
      console.error('Error al listar todas las devoluciones de equipo:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  },
};

module.exports = DevolucionEquipoController;
