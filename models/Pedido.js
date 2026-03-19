// models/Pedido.js
const pool = require('../config/db');

const Pedido = {
async create(pedidoData) {
  const { usuario_id, direccion_id, direccion, latitud, longitud, info_extra, estado, productos, id_conductor } = pedidoData;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!Array.isArray(productos) || productos.length === 0) {
      throw new Error('Debe enviar al menos un producto');
    }

    // Insertar pedido con estado pendiente
    const pedidoRes = await client.query(
      `INSERT INTO pedidos 
       (usuario_id, direccion_id, direccion, latitud, longitud, info_extra, estado, monto_total, monto_pagado, monto_pendiente,id_conductor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8)
       RETURNING *`,
      [usuario_id, direccion_id || null, direccion || null, latitud || null, longitud || null, info_extra || null, estado, id_conductor]
    );

    const pedido = pedidoRes.rows[0];
    let montoTotal = 0;

    // Insertar productos, validar stock y calcular monto total
    for (const prod of productos) {
      const cantidadSolicitada = Number(prod.cantidad);
      if (!Number.isInteger(cantidadSolicitada) || cantidadSolicitada <= 0) {
        throw new Error(`Cantidad invalida para el producto ${prod.producto_id}`);
      }

      const prodRes = await client.query(
        'SELECT idproducto, cantidad, preciounitario FROM productos WHERE idproducto = $1 FOR UPDATE',
        [prod.producto_id]
      );
      if (prodRes.rows.length === 0) {
        throw new Error(`Producto con id ${prod.producto_id} no existe`);
      }

      const productoDb = prodRes.rows[0];
      if (Number(productoDb.cantidad) < cantidadSolicitada) {
        const stockError = new Error(`Stock insuficiente para el producto ${prod.producto_id}`);
        stockError.code = 'STOCK_INSUFICIENTE';
        stockError.producto_id = prod.producto_id;
        stockError.stock_disponible = Number(productoDb.cantidad);
        stockError.cantidad_solicitada = cantidadSolicitada;
        throw stockError;
      }

      const precioUnitario = Number(productoDb.preciounitario);
      montoTotal += precioUnitario * cantidadSolicitada;

      await client.query(
        `INSERT INTO pedidoproducto (pedido_id, producto_id, cantidad, preciounitario)
         VALUES ($1,$2,$3,$4)`,
        [pedido.id, prod.producto_id, cantidadSolicitada, precioUnitario]
      );

      await client.query(
        `UPDATE productos
         SET cantidad = cantidad - $1
         WHERE idproducto = $2`,
        [cantidadSolicitada, prod.producto_id]
      );
    }

    // Actualizar montos en el pedido
    await client.query(
      `UPDATE pedidos
       SET monto_total = $1, monto_pendiente = $1
       WHERE id = $2`,
      [montoTotal, pedido.id]
    );

    await client.query('COMMIT');
    return pedido;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', error);
    throw error;
  } finally {
    client.release();
  }
},

//  async updateProductPriceInPedido(pedido_id, producto_id, nuevoPrecio) {
//   console.log('pedidoid: '+pedido_id);
//   console.log('producto_id: '+producto_id);
//   console.log('nuevoPrecio: '+nuevoPrecio);
//    try {
//      const result = await pool.query(
//        `UPDATE pedidoproducto
//         SET preciounitario = $1
//         WHERE pedido_id = $2 AND producto_id = $3
//         RETURNING *`,
//        [nuevoPrecio, pedido_id, producto_id]
//      );
//      return result.rows[0];
//    } catch (error) {
//      console.error('Error al actualizar precio en pedido:', error);
//      throw new Error('No se pudo actualizar el precio en el pedido');
//    }
//  },
async updateProductPriceInPedido(pedido_id, producto_id, nuevoPrecio) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1️⃣ Actualizar precio del producto en el pedido
    const result = await client.query(
      `UPDATE pedidoproducto
       SET preciounitario = $1
       WHERE pedido_id = $2 AND producto_id = $3
       RETURNING *`,
      [nuevoPrecio, pedido_id, producto_id]
    );

    if (result.rowCount === 0) {
      throw new Error('Producto no encontrado en el pedido');
    }

    // 2️⃣ Recalcular monto_total y monto_pendiente del pedido
    const monto = await client.query(
      `SELECT SUM(cantidad * preciounitario) AS total
       FROM pedidoproducto
       WHERE pedido_id = $1`,
      [pedido_id]
    );

    const total = monto.rows[0].total || 0;

    await client.query(
      `UPDATE pedidos
       SET monto_total = $1,
           monto_pendiente = $1 - COALESCE(monto_pagado, 0)
       WHERE id = $2`,
      [total, pedido_id]
    );

    await client.query('COMMIT');

    // 3️⃣ Retornar nuevo total y monto pendiente
    return {
      ...result.rows[0],
      monto_total: total,
      monto_pendiente: total // o calcular según monto_pagado si quieres
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar precio en pedido:', error);
    throw new Error('No se pudo actualizar el precio en el pedido');
  } finally {
    client.release();
  }
},

async getClientesDeudores() {
  console.log("entro al model de clientes deudores");
    try {
      const query = `
        SELECT u.id AS usuario_id, u.nombre, u.email
        FROM usuarios u
        JOIN pedidos p ON u.id = p.usuario_id
        WHERE p.monto_pendiente > 0
        GROUP BY u.id
        ORDER BY u.nombre
      `;
      const result = await pool.query(query);
      console.log("deudores: "+ result.rows);
      return result.rows;
    } catch (err) {
      console.error('Error en ClientesDeudoresModel:', err);
      throw err;
    }
  },

  // ================= Agregar pago parcial =================
  async agregarPago(pedido_id, metodo_pago, monto, comprobante, comprobante_id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar pago
      await client.query(
        `INSERT INTO pagos_pedido (pedido_id, metodo_pago, monto_pagado, comprobante, comprobante_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [pedido_id, metodo_pago, monto, comprobante || null, comprobante_id || null]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al agregar pago:', error);
      throw new Error('No se pudo agregar el pago');
    } finally {
      client.release();
    }
  },
  async editarPago(pago_id, { metodo_pago, monto_pagado, comprobante, comprobante_id }) {
    try {
      const result = await pool.query(
        `UPDATE pagos_pedido
         SET metodo_pago = $1,
             monto_pagado = $2,
             comprobante = $3,
             comprobante_id = $4
         WHERE id = $5
         RETURNING *`,
        [metodo_pago, monto_pagado, comprobante || null, comprobante_id || null, pago_id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error al editar pago:', error);
      throw new Error('No se pudo editar el pago');
    }
  },

async actualizarEstadoEntregado(pedido_id) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE pedidos 
       SET estado = 'entregado', fecha_entrega = NOW() 
       WHERE id = $1`,
      [pedido_id]
    );
    return true;
  } finally {
    client.release();
  }
},
async marcarCompletado(pedido_id) {
  await pool.query(
    `UPDATE pedidos
     SET estado='completado'
     WHERE id=$1 AND monto_pagado >= monto_total`,
    [pedido_id]
  );
},
  // Obtener pagos de un pedido
  async getPagosByPedido(pedido_id) {
    try {
      const result = await pool.query(
        `SELECT * FROM pagos_pedido WHERE pedido_id = $1 ORDER BY fecha_pago ASC`,
        [pedido_id]
      );
      return result.rows;
    } catch (error) {
      console.error('Error al obtener pagos del pedido:', error);
      throw new Error('No se pudieron obtener los pagos del pedido');
    }
  },

  // Aquí puedes dejar el resto de tus métodos como get
async getOrdersByUserId(usuario_id) {
  try {
    const result = await pool.query(
      `SELECT * FROM pedidos
       WHERE usuario_id = $1 AND (estado = 'pendiente' OR estado = 'asignado')
       ORDER BY id DESC`,
      [usuario_id]
    );
    return result.rows;
  } catch (error) {
    console.error('Error al obtener pedidos del usuario:', error);
    throw new Error('No se pudieron obtener los pedidos del usuario');
  }
},

  async getAll() {
    try {
      const result = await pool.query(
        `SELECT * FROM pedidos ORDER BY id DESC`
      );
      return result.rows;
    } catch (error) {
      console.error('Error al obtener pedidos:', error);
      throw new Error('No se pudo obtener los pedidos');
    }
  },

  async getById(pedido_id) {
  try {
    const pedidoRes = await pool.query(
      `SELECT * FROM pedidos WHERE id = $1`,
      [pedido_id]
    );
    if (pedidoRes.rows.length === 0) return null;

    const pedido = pedidoRes.rows[0];
    return pedido;

  } catch (error) {
    console.error('Error al obtener detalle de pedido:', error);
    throw new Error('No se pudo obtener el pedido');
  }
},

  async getByEstadoYCliente(usuario_id, estado) {
    try {
      const result = await pool.query(
        `SELECT * FROM pedidos
         WHERE usuario_id = $1 AND estado = $2
         ORDER BY id DESC`,
        [usuario_id, estado]
      );
      return result.rows;
    } catch (error) {
      console.error('Error al obtener pedidos por estado:', error);
      throw new Error('No se pudo obtener los pedidos');
    }
  },

  async getByEstado(estado) {
  try {
    const result = await pool.query(
      `SELECT p.*,
              u.nombre AS usuario_nombre,
              c.nombre AS conductor_nombre
       FROM pedidos p
       JOIN usuarios u ON p.usuario_id = u.id
       LEFT JOIN usuarios c ON p.id_conductor = c.id
       WHERE p.estado = $1
       ORDER BY p.id DESC`,
      [estado]
    );
    return result.rows;
  } catch (error) {
    console.error('Error al obtener pedidos por estado:', error);
    throw new Error('No se pudo obtener los pedidos');
  }
},

async getPendingWithoutDriver() {
  console.log("entra a buscar pedido sin conductor");
  try {
    const result = await pool.query(
      `SELECT p.*, u.nombre AS usuario_nombre
       FROM pedidos p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.estado = 'pendiente' AND p.id_conductor IS NULL
       ORDER BY p.id DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Error al obtener pedidos pendientes sin conductor:', error);
    throw new Error('No se pudieron obtener los pedidos');
  }
},

  async actualizarEstado(pedido_id, nuevoEstado) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const pedidoRes = await client.query(
        `SELECT id, estado FROM pedidos WHERE id = $1 FOR UPDATE`,
        [pedido_id]
      );

      if (pedidoRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const estadoAnterior = pedidoRes.rows[0].estado;

      const result = await client.query(
        `UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *`,
        [nuevoEstado, pedido_id]
      );

      if (estadoAnterior !== 'cancelado' && nuevoEstado === 'cancelado') {
        const detalleRes = await client.query(
          `SELECT producto_id, cantidad
           FROM pedidoproducto
           WHERE pedido_id = $1`,
          [pedido_id]
        );

        for (const item of detalleRes.rows) {
          await client.query(
            `UPDATE productos
             SET cantidad = cantidad + $1
             WHERE idproducto = $2`,
            [item.cantidad, item.producto_id]
          );
        }
      }

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al actualizar estado del pedido:', error);
      throw new Error('No se pudo actualizar el estado');
    } finally {
      client.release();
    }
  },

  async assignConductor(pedidoId, id_conductor) {
  try {
    const result = await pool.query(
      `UPDATE pedidos SET id_conductor = $1,estado=$2 WHERE id = $3 RETURNING *`,
      [id_conductor,"asignado", pedidoId]
    );
    console.log("id_conductor de model:", id_conductor);
    return result.rows[0];
  } catch (error) {
    console.error('Error al asignar conductor:', error);
    throw new Error('No se pudo asignar el conductor');
  }
},
  async getPendingOrders(req, res) {
    console.log("pedido req y res"+ req + "+" + res);
  try {
    const result = await pool.query(
      "SELECT * FROM pedidos WHERE estado = 'pendiente'"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos pendientes' });
  }
},
async getProductosByPedido(pedidoId) {
  try {
    const result = await pool.query(
      `SELECT pp.id AS pedidoproducto_id,
              pp.cantidad,
              COALESCE(pp.cantidad_entregada, 0) AS cantidad_entregada,
              (pp.cantidad - COALESCE(pp.cantidad_entregada, 0)) AS cantidad_pendiente,
              pp.preciounitario,
              p.nombre,
              pp.producto_id
       FROM pedidoproducto pp
       JOIN productos p ON p.idproducto = pp.producto_id
       WHERE pp.pedido_id = $1`,
      [pedidoId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error al obtener productos del pedido:', error);
    throw new Error('No se pudieron obtener los productos del pedido');
  }
},
async agregarRecibo(pedido_id, numeroRecibo) {
  try {
    const result = await pool.query(
      `UPDATE pedidos
       SET nro_recibo = $1
       WHERE id = $2
       RETURNING *`,
      [numeroRecibo, pedido_id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error al agregar recibo del pedido:', error);
    throw new Error('No se pudo agregar el recibo del pedido');
  }
},
async confirmarEntrega(pedido_id) {
  try {
    const pedidoRes = await pool.query(
      `SELECT metodo_pago, comprobante, estado
       FROM pedidos
       WHERE id = $1`,
      [pedido_id]
    );
    if (pedidoRes.rows.length === 0) {
      throw new Error('Pedido no encontrado');
    }
    const pedido = pedidoRes.rows[0];
    if (pedido.estado === 'entregado') {
      throw new Error('El pedido ya fue entregado');
    }
    if (pedido.metodo_pago === 'QR' && !pedido.comprobante) {
      throw new Error('No se puede entregar: falta comprobante QR');
    }
    const result = await pool.query(
      `UPDATE pedidos
       SET estado = 'entregado'
       WHERE id = $1
       RETURNING *`,
      [pedido_id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error al confirmar entrega:', error);
    throw new Error('No se pudo confirmar la entrega del pedido');
  }
},
async cancelarYEliminar(pedido_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pedidoRes = await client.query(
      `SELECT id
       FROM pedidos
       WHERE id = $1
       FOR UPDATE`,
      [pedido_id]
    );

    if (pedidoRes.rows.length === 0) {
      throw new Error('Pedido no encontrado');
    }

    const detalleRes = await client.query(
      `SELECT producto_id, cantidad
       FROM pedidoproducto
       WHERE pedido_id = $1`,
      [pedido_id]
    );

    for (const item of detalleRes.rows) {
      await client.query(
        `UPDATE productos
         SET cantidad = cantidad + $1
         WHERE idproducto = $2`,
        [item.cantidad, item.producto_id]
      );
    }

    const deleteRes = await client.query(
      `DELETE FROM pedidos
       WHERE id = $1
       RETURNING id`,
      [pedido_id]
    );

    await client.query('COMMIT');
    return deleteRes.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cancelar y eliminar pedido:', error);
    throw new Error(error.message || 'No se pudo cancelar el pedido');
  } finally {
    client.release();
  }
},
async getAssignedOrdersByDriver(conductor_id) {
  try {
    const result = await pool.query(
      `SELECT p.*, u.nombre AS cliente_nombre
       FROM pedidos p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id_conductor = $1
       ORDER BY p.id DESC`,
      [conductor_id]
    );
    console.log(result.rows);
    return result.rows;
  } catch (error) {
    console.error('Error al obtener pedidos asignados al conductor:', error);
    throw new Error('No se pudieron obtener los pedidos asignados al conductor');
  }
},

// Registrar entrega parcial acumulando cantidades entregadas
async registrarEntregaParcial(pedido_id, entregas) {
  if (!Array.isArray(entregas) || entregas.length === 0) {
    throw new Error('Debe enviar productos a entregar');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pedidoRes = await client.query(
      `SELECT estado FROM pedidos WHERE id = $1 FOR UPDATE`,
      [pedido_id]
    );
    if (pedidoRes.rows.length === 0) {
      throw new Error('Pedido no encontrado');
    }
    if (pedidoRes.rows[0].estado === 'entregado') {
      throw new Error('El pedido ya fue entregado totalmente');
    }

    for (const e of entregas) {
      const cantidadEnt = Number(e.cantidad) ?? 0;
      if (!Number.isInteger(cantidadEnt) || cantidadEnt <= 0) {
        throw new Error('Cantidad entregada invalida');
      }

      const row = await client.query(
        `SELECT cantidad, COALESCE(cantidad_entregada,0) AS cantidad_entregada
           FROM pedidoproducto
          WHERE pedido_id = $1 AND producto_id = $2
          FOR UPDATE`,
        [pedido_id, e.producto_id]
      );
      if (row.rows.length === 0) {
        throw new Error(`Producto ${e.producto_id} no existe en el pedido`);
      }

      const total = Number(row.rows[0].cantidad);
      const entregadaActual = Number(row.rows[0].cantidad_entregada);
      const nuevaEntregada = Math.min(total, entregadaActual + cantidadEnt);

      await client.query(
        `UPDATE pedidoproducto
            SET cantidad_entregada = $1
          WHERE pedido_id = $2 AND producto_id = $3`,
        [nuevaEntregada, pedido_id, e.producto_id]
      );
    }

    const pendientesRes = await client.query(
      `SELECT COUNT(*) AS pendientes
         FROM pedidoproducto
        WHERE pedido_id = $1
          AND COALESCE(cantidad_entregada,0) < cantidad`,
      [pedido_id]
    );
    const pendientes = Number(pendientesRes.rows[0].pendientes);

    if (pendientes === 0) {
      await client.query(
        `UPDATE pedidos
            SET estado = 'entregado',
                fecha_entrega = NOW()
          WHERE id = $1`,
        [pedido_id]
      );
    } else {
      await client.query(
        `UPDATE pedidos
            SET estado = 'parcial'
          WHERE id = $1`,
        [pedido_id]
      );
    }

    await client.query('COMMIT');
    return { pendientes };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en entrega parcial:', error);
    throw new Error(error.message || 'No se pudo registrar la entrega parcial');
  } finally {
    client.release();
  }
}
};
module.exports = Pedido;
