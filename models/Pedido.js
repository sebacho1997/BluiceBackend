// models/Pedido.js
const pool = require('../config/db');

const Pedido = {
async create(pedidoData) {
  const { usuario_id, direccion_id, direccion, latitud, longitud, info_extra, productos } = pedidoData;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insertar pedido con estado pendiente
    const pedidoRes = await client.query(
      `INSERT INTO pedidos 
       (usuario_id, direccion_id, direccion, latitud, longitud, info_extra, estado, monto_total, monto_pagado, monto_pendiente)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0)
       RETURNING *`,
      [usuario_id, direccion_id || null, direccion || null, latitud || null, longitud || null, info_extra || null, 'pendiente']
    );

    const pedido = pedidoRes.rows[0];
    let montoTotal = 0;

    // Insertar productos y calcular monto total
    for (const prod of productos) {
      const prodRes = await client.query(
        'SELECT preciounitario FROM productos WHERE idproducto = $1',
        [prod.producto_id]
      );
      if (prodRes.rows.length === 0) throw new Error(`Producto con id ${prod.producto_id} no existe`);
      const precioUnitario = prodRes.rows[0].preciounitario;
      montoTotal += precioUnitario * prod.cantidad;

      await client.query(
        `INSERT INTO pedidoproducto (pedido_id, producto_id, cantidad, preciounitario)
         VALUES ($1,$2,$3,$4)`,
        [pedido.id, prod.producto_id, prod.cantidad, precioUnitario]
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
    throw new Error('No se pudo crear el pedido');
  } finally {
    client.release();
  }
},

 async updateProductPriceInPedido(pedido_id, producto_id, nuevoPrecio) {
  console.log('pedidoid: '+pedido_id);
  console.log('producto_id: '+producto_id);
  console.log('nuevoPrecio: '+nuevoPrecio);
   try {
     const result = await pool.query(
       `UPDATE pedidoproducto
        SET preciounitario = $1
        WHERE pedido_id = $2 AND producto_id = $3
        RETURNING *`,
       [nuevoPrecio, pedido_id, producto_id]
     );
     this.updateTotalPrice(pedido_id);
     return result.rows[0];
   } catch (error) {
     console.error('Error al actualizar precio en pedido:', error);
     throw new Error('No se pudo actualizar el precio en el pedido');
   }
 },
async updateTotalPrice(pedido_id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
      `SELECT p.*, u.nombre AS usuario_nombre
       FROM pedidos p
       JOIN usuarios u ON p.usuario_id = u.id
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
    try {
      const result = await pool.query(
        `UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *`,
        [nuevoEstado, pedido_id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error al actualizar estado del pedido:', error);
      throw new Error('No se pudo actualizar el estado');
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
      `SELECT pp.id AS pedidoproducto_id, pp.cantidad, pp.preciounitario, p.nombre, pp.producto_id
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
    throw new Error('No se pudo agregar el recibo al pedido');
  }
},
async confirmarEntrega(pedido_id) {
  try {
    // Obtener el pedido primero
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

    // Verificar si se puede confirmar entrega
    if (pedido.estado === 'entregado') {
      throw new Error('El pedido ya fue entregado');
    }

    if (pedido.metodo_pago === 'QR' && !pedido.comprobante) {
      throw new Error('No se puede entregar: falta comprobante QR');
    }

    // Actualizar estado a entregado
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
    return result.rows;
  } catch (error) {
    console.error('Error al obtener pedidos asignados al conductor:', error);
    throw new Error('No se pudieron obtener los pedidos asignados al conductor');
  }
}
}; 

module.exports = Pedido;
