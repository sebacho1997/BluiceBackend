const Equipo = require('../models/equipo');

const equipoController = {
  async create(req, res) {
    const { nombre, descripcion, precio, stock } = req.body;
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre del equipo es requerido' });
    }
    const equipo = await Equipo.create({
      nombre: nombre.trim(),
      descripcion: descripcion || '',
      precio: Number(precio) || 0,
      stock: Number(stock) || 0,
    });
    res.status(201).json(equipo);
  },

  async getAll(req, res) {
    const equipos = await Equipo.findAll();
    res.json(equipos);
  },

  async getById(req, res) {
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(equipo);
  },

  async update(req, res) {
    const { nombre, descripcion, precio, stock } = req.body;
    const equipo = await Equipo.update(req.params.id, {
      nombre,
      descripcion,
      precio: Number(precio) || 0,
      stock: Number(stock) || 0,
    });
    if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(equipo);
  },

  async delete(req, res) {
    const eliminado = await Equipo.delete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json({ message: 'Equipo eliminado correctamente' });
  },
};

module.exports = equipoController;