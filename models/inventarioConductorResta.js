const pool = require('../config/db');

const InventarioConductorResta = {
  // Crear inventario resta
  async crearInventario(conductorId, productos) {
    try {
      const res = await pool.query(
        'INSERT INTO inventario_conductor_resta (conductor_id) VALUES ($1) RETURNING id, fecha_creacion',
        [conductorId]
      );
      const inventarioId = res.rows[0].id;

      for (let p of productos) {
        await pool.query(
          'INSERT INTO inventario_conductor_detalle_resta (inventario_id, producto_id, cantidad) VALUES ($1, $2, $3)',
          [inventarioId, p.producto_id, p.cantidad]
        );
      }

      return { inventarioId, fecha_creacion: res.rows[0].fecha_creacion };
    } catch (error) {
      console.error('Error creando inventario resta:', error);
      return null;
    }
  },

  // Verifica si hay inventario hoy
  async existeInventarioHoy(conductorId) {
    try {
      const query = `
        SELECT COUNT(*) AS count
        FROM inventario_conductor_resta
        WHERE conductor_id = $1
          AND DATE(fecha_creacion) = CURRENT_DATE
      `;
      const result = await pool.query(query, [conductorId]);
      return Number(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Error en InventarioConductorResta.existeInventarioHoy:', error);
      throw error;
    }
  },

  // Obtener inventario del día
  async getInventarioHoy(conductorId) {
    try {
      const res = await pool.query(`
        SELECT d.id AS detalle_id, d.producto_id, p.nombre AS producto_nombre, d.cantidad, d.inventario_id
        FROM inventario_conductor_resta ic
        JOIN inventario_conductor_detalle_resta d ON d.inventario_id = ic.id
        JOIN productos p ON p.idproducto = d.producto_id
        WHERE ic.conductor_id = $1
          AND DATE(ic.fecha_creacion) = CURRENT_DATE
          AND ic.estado = $2
        ORDER BY d.id ASC
      `, [conductorId, "creado"]);
      return res.rows;
    } catch (error) {
      console.error("Error getInventarioHoy (resta):", error);
      return [];
    }
  },

  // Obtener todos los inventarios de un conductor
  async obtenerInventarios(conductorId) {
    try {
      const res = await pool.query(
        'SELECT * FROM inventario_conductor_resta WHERE conductor_id = $1 ORDER BY fecha_creacion DESC',
        [conductorId]
      );
      return res.rows;
    } catch (error) {
      console.error('Error obteniendo inventarios resta:', error);
      return [];
    }
  },

  // Obtener detalle de un inventario
  async obtenerDetalleInventario(inventarioId) {
    try {
      const res = await pool.query(
        'SELECT * FROM inventario_conductor_detalle_resta WHERE inventario_id = $1',
        [inventarioId]
      );
      return res.rows;
    } catch (error) {
      console.error('Error obteniendo detalle del inventario resta:', error);
      return [];
    }
  },

  // Cerrar inventario
  async cerrarInventario(inventarioId) {
    try {
      const res = await pool.query(
        'UPDATE inventario_conductor_resta SET estado = $1 WHERE id = $2 RETURNING *',
        ['cerrado', inventarioId]
      );
      return res.rows[0];
    } catch (error) {
      console.error('Error cerrando inventario resta:', error);
      return null;
    }
  },

  async restarProductos(inventarioId, productos) {
  try {
    console.log("InventarioId:", inventarioId);
    console.log("Productos recibidos:", productos);

    for (let p of productos) {
      const res = await pool.query(
        'SELECT cantidad FROM inventario_conductor_detalle_resta WHERE inventario_id = $1 AND producto_id = $2',
        [inventarioId, p.producto_id]
      );
      console.log(`Producto ${p.producto_id}, cantidad actual:`, res.rows);

      if (res.rows.length > 0) {
        const nuevaCantidad = res.rows[0].cantidad - p.cantidad;
        console.log(`Restando ${p.cantidad}, nueva cantidad:`, nuevaCantidad < 0 ? 0 : nuevaCantidad);
        await pool.query(
          'UPDATE inventario_conductor_detalle_resta SET cantidad = $1 WHERE inventario_id = $2 AND producto_id = $3',
          [nuevaCantidad < 0 ? 0 : nuevaCantidad, inventarioId, p.producto_id]
        );
      } else {
        console.log(`Producto no encontrado, insertando negativo:`, p);
        await pool.query(
          'INSERT INTO inventario_conductor_detalle_resta (inventario_id, producto_id, cantidad) VALUES ($1, $2, $3)',
          [inventarioId, p.producto_id, p.cantidad * -1]
        );
      }
    }
    return true;
  } catch (error) {
    console.error('Error restando inventario:', error);
    return false;
  }
},

  // Actualizar inventario y sus detalles
async actualizarInventario(inventarioId, productos) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let p of productos) {
      // Verificar si ya existe el detalle
      const res = await client.query(
        'SELECT id FROM inventario_conductor_detalle_resta WHERE inventario_id = $1 AND producto_id = $2',
        [inventarioId, p.producto_id]
      );

      if (res.rows.length > 0) {
        // Actualizar cantidad existente
        await client.query(
          'UPDATE inventario_conductor_detalle_resta SET cantidad = $1 WHERE inventario_id = $2 AND producto_id = $3',
          [p.cantidad, inventarioId, p.producto_id]
        );
      } else {
        // Insertar nuevo detalle
        await client.query(
          'INSERT INTO inventario_conductor_detalle_resta (inventario_id, producto_id, cantidad) VALUES ($1, $2, $3)',
          [inventarioId, p.producto_id, p.cantidad]
        );
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error actualizando inventario resta:', error);
    return false;
  } finally {
    client.release();
  }
}

};

module.exports = InventarioConductorResta;
