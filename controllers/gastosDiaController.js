const GastosDia = require('../models/gastosDia.js');

const gastosDiaController = {
  async create(req, res) {
    try {
      const gasto = await GastosDia.create(req.body);
      res.json(gasto);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al crear gasto' });
    }
  },
  async listarHoy(req, res) {
  try {
    const { id_conductor } = req.query; // suponiendo que lo envías como query param
    if (!id_conductor) return res.status(400).json({ error: "Falta id_conductor" });
    
    const gastos = await GastosDia.listarHoyConductor(id_conductor);
    res.json(gastos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
},
  async findAll(req, res) {
    try {
      const { id_conductor } = req.query;
      if (!id_conductor) return res.status(400).json({ error: "Falta id_conductor" });
      const gastos = await GastosDia.findAll(id_conductor);
      res.json(gastos);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener gastos' });
    }
  },

  async findById(req, res) {
    try {
      const gasto = await GastosDia.findById(req.params.id);
      if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
      res.json(gasto);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener gasto' });
    }
  },

  async update(req, res) {
    try {
      const gasto = await GastosDia.update(req.params.id, req.body);
      res.json(gasto);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al actualizar gasto' });
    }
  },

  async delete(req, res) {
    try {
      const gasto = await GastosDia.delete(req.params.id);
      res.json(gasto);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al eliminar gasto' });
    }
  }
};

module.exports = gastosDiaController;
