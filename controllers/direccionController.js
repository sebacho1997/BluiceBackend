const Direccion = require('../models/Direccion');

const direccionController = {
  async create(req, res) {
    try {
      const { id } = req.params;  // este es el id del usuario
      const { direccion, latitud, longitud, info_extra } = req.body;

      const nuevaDireccion = await Direccion.create({
        usuario_id: id,
        direccion,
        latitud,
        longitud,
        info_extra
      });

      res.status(201).json(nuevaDireccion);
    } catch (error) {
      console.error('Error al crear dirección:', error);
      res.status(500).json({ message: 'No se pudo crear la dirección' });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const direccion = await Direccion.getById(id);
      if (!direccion) return res.status(404).json({ error: 'Dirección no encontrada' });
      res.json(direccion);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener la dirección' });
    }
  },

  async getByUserId(req, res) {
    try {
      const { usuario_id } = req.params;
      const direcciones = await Direccion.getByUserId(usuario_id);
      res.json(direcciones);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener las direcciones' });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { direccion, latitud, longitud, info_extra } = req.body;
      const direccionActualizada = await Direccion.update(id, {
        direccion,
        latitud,
        longitud,
        info_extra
      });
      if (!direccionActualizada) return res.status(404).json({ error: 'Dirección no encontrada' });
      res.json(direccionActualizada);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al actualizar la dirección' });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const eliminado = await Direccion.delete(id);
      if (!eliminado) return res.status(404).json({ error: 'Dirección no encontrada' });
      res.json({ mensaje: 'Dirección eliminada' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al eliminar la dirección' });
    }
  }
};

module.exports = direccionController;
