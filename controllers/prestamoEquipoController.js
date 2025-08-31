const PrestamoEquipo = require('../models/prestamoEquipo');

const prestamoEquipoController = {
  async create(req, res) {
    
    try {
      const { id_cliente, equipo, estado_entrega,cantidad } = req.body;
      console.log("controller.js: id_cliente:"+id_cliente+" equipo:"+equipo+" estado_entrega:"+estado_entrega+" cantidad:"+cantidad);
      const nuevoPrestamo = await PrestamoEquipo.create({ id_cliente, equipo, estado_entrega,cantidad });
      res.status(201).json(nuevoPrestamo);
    } catch (error) {
      console.error('Error al crear préstamo:', error);
      res.status(500).json({ error: 'No se pudo crear el préstamo' });
    }
  },

  async getAll(req, res) {
    try {
      const prestamos = await PrestamoEquipo.findAll();
      res.json(prestamos);
    } catch (error) {
      console.error('Error al obtener préstamos:', error);
      res.status(500).json({ error: 'No se pudieron obtener los préstamos' });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const prestamo = await PrestamoEquipo.findById(id);
      if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado' });
      res.json(prestamo);
    } catch (error) {
      console.error('Error al obtener préstamo:', error);
      res.status(500).json({ error: 'No se pudo obtener el préstamo' });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { equipo, estado_entrega, estado_devolucion, fecha_devolucion,cantidad,estado_prestamo } = req.body;
      const prestamoActualizado = await PrestamoEquipo.update(id, {
        equipo,
        estado_entrega,
        estado_devolucion,
        fecha_devolucion,
        cantidad,
        estado_prestamo
      });
      if (!prestamoActualizado) return res.status(404).json({ error: 'Préstamo no encontrado' });
      res.json(prestamoActualizado);
    } catch (error) {
      console.error('Error al actualizar préstamo:', error);
      res.status(500).json({ error: 'No se pudo actualizar el préstamo' });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const eliminado = await PrestamoEquipo.delete(id);
      if (!eliminado) return res.status(404).json({ error: 'Préstamo no encontrado' });
      res.json({ message: 'Préstamo eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar préstamo:', error);
      res.status(500).json({ error: 'No se pudo eliminar el préstamo' });
    }
  }
};

module.exports = prestamoEquipoController;
