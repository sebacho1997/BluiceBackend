const Configuracion = require('../models/configuracion');

const configController = {
  async getAll(req, res) {
    const config = await Configuracion.getAll();
    res.json(config);
  },

  async update(req, res) {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de entries con clave y valor' });
    }
    await Configuracion.bulkUpdate(entries);
    const config = await Configuracion.getAll();
    res.json(config);
  }
};

module.exports = configController;
