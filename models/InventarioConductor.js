const pool = require('../config/db');

const InventarioConductor = {
  // Métodos originales
  async crearInventario(conductorId, productos) {
    try {
      const res = await pool.query(
        'INSERT INTO inventario_conductor (conductor_id) VALUES ($1) RETURNING id, fecha_creacion',
        [conductorId]
      );
      const inventarioId = res.rows[0].id;

      for (let p of productos) {
        await pool.query(
          'INSERT INTO inventario_conductor_detalle (inventario_id, producto_id, cantidad) VALUES ($1, $2, $3)',
          [inventarioId, p.producto_id, p.cantidad]
        );
      }

      return { inventarioId, fecha_creacion: res.rows[0].fecha_creacion };
    } catch (error) {
      console.error('Error creando inventario:', error);
      return null;
    }
  },
   async existeInventarioHoy(conductorId) { 
  try {
    const query = `
      SELECT COUNT(*) AS count
      FROM inventario_conductor
      WHERE conductor_id = $1
        AND estado = 'creado'
    `;
    const result = await pool.query(query, [conductorId]);
    return Number(result.rows[0].count) > 0; // Convertimos a número
  } catch (error) {
    console.error('Error en InventarioModel.existeInventarioHoy:', error);
    throw error;
  }
},
 async getInventarioHoy(conductorId) {
  console.log('entra getinventariohoy');
  try {
    const res = await pool.query(`
      SELECT d.id AS detalle_id, d.producto_id, p.nombre AS producto_nombre, d.cantidad,d.inventario_id
      FROM inventario_conductor ic
      JOIN inventario_conductor_detalle d ON d.inventario_id = ic.id
      JOIN productos p ON p.idproducto = d.producto_id
      WHERE ic.conductor_id = $1
        AND ic.estado = $2
      ORDER BY d.id ASC
    `, [conductorId,"creado"]);
    return res.rows; // devuelve un array de {detalle_id, producto_id, producto_nombre, cantidad}
    
  } catch (error) {
    console.error("Error getInventarioHoy:", error);
    return [];
  }
},
  async obtenerInventarios(conductorId) {
    try {
      const res = await pool.query(
        'SELECT * FROM inventario_conductor WHERE conductor_id = $1 ORDER BY fecha_creacion DESC',
        [conductorId]
      );
      return res.rows;
    } catch (error) {
      console.error('Error obteniendo inventarios:', error);
      return [];
    }
  },

  async obtenerDetalleInventario(inventarioId) {
    try {
      const res = await pool.query(
        'SELECT * FROM inventario_conductor_detalle WHERE inventario_id = $1',
        [inventarioId]
      );
      return res.rows;
    } catch (error) {
      console.error('Error obteniendo detalle del inventario:', error);
      return [];
    }
  },
  async cerrarInventario(inventarioId) {
  try {
    const res = await pool.query(
      'UPDATE inventario_conductor SET estado = $1 WHERE id = $2 RETURNING *',
      ['cerrado', inventarioId]
    );
    return res.rows[0];
  } catch (error) {
    console.error('Error cerrando inventario:', error);
    return null;
  }
},

  // -----------------------------
  // Métodos nuevos para Devolución
  // -----------------------------
   async crearDevolucion(conductorId, productos) {
    try {
      // 1. Insertar registro de devolución
      const res = await pool.query(
        `INSERT INTO devolucion_conductor (conductor_id) 
         VALUES ($1) RETURNING id, fecha_creacion`,
        [conductorId]
      );
      const devolucionId = res.rows[0].id;

      // 2. Insertar detalle de productos
      for (let p of productos) {
        await pool.query(
          `INSERT INTO devolucion_conductor_detalle (devolucion_id, producto_id, cantidad)
           VALUES ($1, $2, $3)`,
          [devolucionId, p.producto_id, p.cantidad]
        );
      }

      return { devolucionId, fecha_creacion: res.rows[0].fecha_creacion };
    } catch (error) {
      console.error('Error creando devolución:', error);
      return null;
    }
  },

  // Obtener todas las devoluciones de un conductor
  async obtenerDevoluciones(conductorId) {
    try {
      const res = await pool.query(
        `SELECT * FROM devolucion_conductor 
         WHERE conductor_id = $1 
         ORDER BY fecha_creacion DESC`,
        [conductorId]
      );
      return res.rows;
    } catch (error) {
      console.error('Error obteniendo devoluciones:', error);
      return [];
    }
  },

  // Obtener detalle de una devolución
  async obtenerDetalle(devolucionId) {
    try {
      const res = await pool.query(
        `SELECT dcd.cantidad, p.nombre AS producto_nombre
         FROM devolucion_conductor_detalle dcd
         JOIN productos p ON p.idproducto = dcd.producto_id
         WHERE dcd.devolucion_id = $1`,
        [devolucionId]
      );
      return res.rows;
    } catch (error) {
      console.error('Error obteniendo detalle de devolución:', error);
      return [];
    }
  }
};

module.exports = InventarioConductor;
