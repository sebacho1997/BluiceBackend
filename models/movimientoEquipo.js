const pool = require('../config/db');

// Resta stock de un equipo validando que haya disponible.
async function restarStock(client, idEquipo, cantidad) {
  const eqRes = await client.query(
    'SELECT stock FROM equipos WHERE id = $1 FOR UPDATE',
    [idEquipo]
  );
  if (eqRes.rows.length === 0) {
    const e = new Error('Equipo no existe');
    e.code = 'EQUIPO_NO_EXISTE';
    throw e;
  }
  const stock = Number(eqRes.rows[0].stock);
  if (stock < cantidad) {
    const e = new Error('Stock insuficiente');
    e.code = 'STOCK_INSUFICIENTE';
    e.stock_disponible = stock;
    throw e;
  }
  await client.query(
    'UPDATE equipos SET stock = stock - $1 WHERE id = $2',
    [cantidad, idEquipo]
  );
}

const MovimientoEquipo = {
  // Crea una venta (descuenta stock al instante, estado completado) o un
  // préstamo (estado pendiente_entrega, el stock se descuenta al entregar).
  async create({ tipo, id_equipo, id_cliente, id_conductor, cantidad, monto, con_garantia, monto_garantia }) {
    if (tipo !== 'venta' && tipo !== 'prestamo') {
      throw new Error('Tipo invalido: debe ser venta o prestamo');
    }
    const clienteRes = await pool.query('SELECT id FROM usuarios WHERE id = $1', [id_cliente]);
    if (clienteRes.rows.length === 0) {
      throw new Error('Cliente no existe');
    }
    if (id_conductor) {
      const condRes = await pool.query("SELECT id FROM usuarios WHERE id = $1 AND tipo_usuario = 'conductor'", [id_conductor]);
      if (condRes.rows.length === 0) {
        throw new Error('Conductor no existe');
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const cantidadNum = Number(cantidad);
      if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
        throw new Error('Cantidad invalida');
      }

      if (tipo === 'venta') {
        await restarStock(client, id_equipo, cantidadNum);
      } else {
        const eqRes = await client.query('SELECT stock FROM equipos WHERE id = $1 FOR UPDATE', [id_equipo]);
        if (eqRes.rows.length === 0) throw new Error('Equipo no existe');
      }

      const esPrestamo = tipo === 'prestamo';
      const conGarantia = esPrestamo ? Boolean(con_garantia) : false;
      const montoGarantia = conGarantia ? Number(monto_garantia) || 0 : 0;
      const montoTotal = esPrestamo ? 0 : Number(monto) || 0;
      const estado = esPrestamo ? 'pendiente_entrega' : 'completado';
      const fechaEntrega = esPrestamo ? null : new Date();

      const result = await client.query(
        `INSERT INTO movimiento_equipos
           (tipo, id_equipo, id_cliente, id_conductor, cantidad, monto, con_garantia, monto_garantia, estado, fecha_entrega)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [tipo, id_equipo, id_cliente, id_conductor || null, cantidadNum, montoTotal, conGarantia, montoGarantia, estado, fechaEntrega]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async findAll(tipo) {
    let query = `SELECT m.*, e.nombre AS equipo_nombre, e.descripcion AS equipo_descripcion,
              e.precio AS equipo_precio, e.stock AS equipo_stock,
              u.nombre AS cliente_nombre, u.telefono AS cliente_telefono,
              c.nombre AS conductor_nombre
       FROM movimiento_equipos m
       JOIN equipos e ON e.id = m.id_equipo
       JOIN usuarios u ON u.id = m.id_cliente
       LEFT JOIN usuarios c ON c.id = m.id_conductor`;
    const params = [];
    if (tipo === 'venta' || tipo === 'prestamo') {
      params.push(tipo);
      query += ` WHERE m.tipo = $${params.length}`;
    }
    query += ' ORDER BY m.id DESC';
    const result = await pool.query(query, params);
    return result.rows;
  },

  async findById(id) {
    const result = await pool.query(
      `SELECT m.*, e.nombre AS equipo_nombre, e.descripcion AS equipo_descripcion,
              e.precio AS equipo_precio, e.stock AS equipo_stock,
              u.nombre AS cliente_nombre, u.telefono AS cliente_telefono,
              c.nombre AS conductor_nombre
       FROM movimiento_equipos m
       JOIN equipos e ON e.id = m.id_equipo
       JOIN usuarios u ON u.id = m.id_cliente
       LEFT JOIN usuarios c ON c.id = m.id_conductor
       WHERE m.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Entrega un préstamo pendiente: descuenta stock y marca fecha de entrega.
  async entregar(id, nroRecibo) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT * FROM movimiento_equipos WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const mov = res.rows[0];
      if (!mov) throw new Error('Movimiento no encontrado');
      if (mov.tipo !== 'prestamo') throw new Error('Solo los prestamos se entregan');
      if (mov.estado !== 'pendiente_entrega') {
        throw new Error('El prestamo ya fue entregado o devuelto');
      }

      await restarStock(client, mov.id_equipo, Number(mov.cantidad));

      const upd = await client.query(
        `UPDATE movimiento_equipos
         SET estado = 'prestado', fecha_entrega = $1,
             nro_recibo = COALESCE(NULLIF($2, ''), nro_recibo)
         WHERE id = $3 RETURNING *`,
        [new Date(), nroRecibo || '', id]
      );

      await client.query('COMMIT');
      return upd.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Devuelve un préstamo: repone stock, guarda estado de devolución
  // y crea registro en devolucion_equipo si tiene conductor asignado.
  async devolver(id, estadoDevolucion) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `SELECT * FROM movimiento_equipos WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const mov = res.rows[0];
      if (!mov) throw new Error('Movimiento no encontrado');
      if (mov.tipo !== 'prestamo') throw new Error('Solo los prestamos se devuelven');
      if (mov.estado === 'devuelto') throw new Error('El prestamo ya fue devuelto');

      await client.query(
        'UPDATE equipos SET stock = stock + $1 WHERE id = $2',
        [Number(mov.cantidad), mov.id_equipo]
      );

      const upd = await client.query(
        `UPDATE movimiento_equipos
         SET estado = 'devuelto', fecha_devolucion = $1, estado_devolucion = $2
         WHERE id = $3 RETURNING *`,
        [new Date(), estadoDevolucion || '', id]
      );

      // Si el préstamo tiene conductor asignado, registrar devolución como constancia
      if (mov.id_conductor) {
        await client.query(
          `INSERT INTO devolucion_equipo (id_movimiento, id_conductor, id_cliente, estado_devolucion)
           VALUES ($1, $2, $3, $4)`,
          [id, mov.id_conductor, mov.id_cliente, estadoDevolucion || '']
        );
      }

      await client.query('COMMIT');
      return upd.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Solo se puede eliminar un préstamo que aun no fue entregado (no afecta
  // el inventario). Las ventas y prestamos entregados quedan como historial.
  async delete(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        'SELECT * FROM movimiento_equipos WHERE id = $1 FOR UPDATE',
        [id]
      );
      const mov = res.rows[0];
      if (!mov) throw new Error('Movimiento no encontrado');
      if (mov.estado !== 'pendiente_entrega') {
        throw new Error('Solo se pueden eliminar prestamos sin entregar');
      }
      const del = await client.query(
        'DELETE FROM movimiento_equipos WHERE id = $1 RETURNING *',
        [id]
      );
      await client.query('COMMIT');
      return del.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = MovimientoEquipo;