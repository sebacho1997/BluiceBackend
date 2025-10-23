const InventarioConductorResta = require('../models/inventarioConductorResta');

// Controller para inventario_conductor_resta
const InventarioConductorRestaController = {

  // Crear inventario
  async crearInventario(req, res) {
    const { conductorId, productos } = req.body;
    console.log('entro a crear inventario resta');

    if (!conductorId || !Array.isArray(productos)) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    try {
      const inventario = await InventarioConductorResta.crearInventario(conductorId, productos);
      if (inventario) {
        return res.status(201).json(inventario);
      } else {
        return res.status(500).json({ message: 'Error creando inventario' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  },
  async restarInventarioPedido(req, res) {
  const { inventarioId, productos } = req.body;

  if (!inventarioId || !productos) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  const exito = await InventarioConductorResta.restarProductos(inventarioId, productos);

  if (exito) return res.json({ mensaje: 'Inventario actualizado correctamente' });
  return res.status(500).json({ error: 'Error actualizando inventario' });
},


  // Verificar si existe inventario hoy
  async existeInventarioHoy(req, res) {
    const { conductorId } = req.params;

    try {
      const existe = await InventarioConductorResta.existeInventarioHoy(conductorId);
      return res.json({ existe });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  },

  // Obtener inventario del día
  async getInventarioHoy(req, res) {
    const { conductorId } = req.params;
    console.log('conductor id en inventario hoy:'+ conductorId);
    try {
      const inventario = await InventarioConductorResta.getInventarioHoy(conductorId);
      console.log(inventario);
      return res.json(inventario);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  },

  // Obtener todos los inventarios de un conductor
  async obtenerInventarios(req, res) {
    const { conductorId } = req.params;

    try {
      const inventarios = await InventarioConductorResta.obtenerInventarios(conductorId);
      return res.json(inventarios);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  },

  // Obtener detalle de un inventario
  async obtenerDetalleInventario(req, res) {
    const { inventarioId } = req.params;

    try {
      const detalle = await InventarioConductorResta.obtenerDetalleInventario(inventarioId);
      return res.json(detalle);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  },

  // Actualizar inventario y sus detalles
  async actualizarInventario(req, res) {
    const { inventarioId, productos } = req.body;

    if (!inventarioId || !Array.isArray(productos)) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    try {
      const exito = await InventarioConductorResta.actualizarInventario(inventarioId, productos);
      if (exito) {
        return res.json({ message: 'Inventario actualizado con éxito' });
      } else {
        return res.status(500).json({ message: 'Error actualizando inventario' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  },

  // Cerrar inventario
  async cerrarInventario(req, res) {
    const { inventarioId } = req.params;

    try {
      const inventario = await InventarioConductorResta.cerrarInventario(inventarioId);
      if (inventario) {
        return res.json(inventario);
      } else {
        return res.status(500).json({ message: 'Error cerrando inventario' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error en el servidor' });
    }
  },
};

module.exports = InventarioConductorRestaController;
