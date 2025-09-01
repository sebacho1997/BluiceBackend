const InventarioConductor = require('../models/InventarioConductor');

const InventarioConductorController = {
  // -----------------------------
  // Métodos Inventario
  // -----------------------------
  async crearInventario(req, res) {
    try {
      const { conductor_id, productos } = req.body;

      if (!conductor_id || !productos || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ message: 'Datos incompletos' });
      }

      const resultado = await InventarioConductor.crearInventario(conductor_id, productos);

      if (resultado) {
        return res.status(201).json({ message: 'Inventario creado', inventario: resultado });
      } else {
        return res.status(500).json({ message: 'Error al crear inventario' });
      }
    } catch (error) {
      console.error('Error en crearInventario:', error);
      res.status(500).json({ message: 'Error del servidor' });
    }
  },
  async getInventarioHoy(req, res) {
  try {
    const { conductor_id } = req.params;
    if (!conductor_id) return res.status(400).json({ error: 'Falta id del conductor' });

    const inventario = await InventarioConductor.getInventarioHoy(conductor_id);
    if (!inventario) return res.status(404).json({ message: 'No hay inventario hoy' });

    res.json(inventario);
  } catch (error) {
    console.error('Error en getInventarioHoy:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
},
  async obtenerInventarios(req, res) {
    try {
      const { conductor_id } = req.params;

      if (!conductor_id) {
        return res.status(400).json({ message: 'Falta el id del conductor' });
      }

      const inventarios = await InventarioConductor.obtenerInventarios(conductor_id);
      res.json(inventarios);
    } catch (error) {
      console.error('Error en obtenerInventarios:', error);
      res.status(500).json({ message: 'Error del servidor' });
    }
  },

  async obtenerDetalle(req, res) {
    try {
      const { inventario_id } = req.params;

      if (!inventario_id) {
        return res.status(400).json({ message: 'Falta el id del inventario' });
      }

      const detalle = await InventarioConductor.obtenerDetalleInventario(inventario_id);
      res.json(detalle);
    } catch (error) {
      console.error('Error en obtenerDetalle:', error);
      res.status(500).json({ message: 'Error del servidor' });
    }
  },
   async existeInventarioHoy(req, res) {
    try {
      const { conductorId } = req.params;
      if (!conductorId) {
        return res.status(400).json({ message: 'Falta el conductorId' });
      }

      const existe = await InventarioConductor.existeInventarioHoy(conductorId);

      return res.status(200).json({ existe });
    } catch (error) {
      console.error('Error en InventarioController.existeInventarioHoy:', error);
      return res.status(500).json({ message: 'Error al verificar inventario' });
    }
  },
  async cerrarInventario(req, res) {
  try {
    const { inventario_id } = req.body;
    if (!inventario_id) return res.status(400).json({ message: 'Falta id del inventario' });

    const resultado = await InventarioConductor.cerrarInventario(inventario_id);
    if (resultado) {
      res.json({ message: 'Inventario cerrado', inventario: resultado });
    } else {
      res.status(500).json({ message: 'Error al cerrar inventario' });
    }
  } catch (error) {
    console.error('Error en cerrarInventario:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
},

  // -----------------------------
  // Métodos Devolución
  // -----------------------------
  async crearDevolucion(req, res) {
    try {
      const { conductor_id, productos } = req.body;

      if (!conductor_id || !productos || productos.length === 0) {
        return res.status(400).json({ message: 'Datos incompletos' });
      }

      const resultado = await InventarioConductor.crearDevolucion(conductor_id, productos);

      if (resultado) {
        res.status(201).json({ message: 'Devolución creada', devolucion: resultado });
      } else {
        res.status(500).json({ message: 'Error al crear devolución' });
      }
    } catch (error) {
      console.error('Error en crearDevolucion:', error);
      res.status(500).json({ message: 'Error del servidor' });
    }
  },

  // Obtener devoluciones de un conductor
  async obtenerDevoluciones(req, res) {
    try {
      const { conductor_id } = req.params;

      if (!conductor_id) return res.status(400).json({ message: 'Falta id del conductor' });

      const devoluciones = await InventarioConductor.obtenerDevoluciones(conductor_id);

      res.json(devoluciones);
    } catch (error) {
      console.error('Error en obtenerDevoluciones:', error);
      res.status(500).json({ message: 'Error del servidor' });
    }
  },

  // Obtener detalle de una devolución
  async obtenerDetalle(req, res) {
    try {
      const { devolucion_id } = req.params;

      if (!devolucion_id) return res.status(400).json({ message: 'Falta id de la devolución' });

      const detalle = await InventarioConductor.obtenerDetalle(devolucion_id);

      res.json(detalle);
    } catch (error) {
      console.error('Error en obtenerDetalle:', error);
      res.status(500).json({ message: 'Error del servidor' });
    }
  }
};

module.exports = InventarioConductorController;
