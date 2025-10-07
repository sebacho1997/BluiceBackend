// controllers/pedidoController.js
const Pedido = require('../models/Pedido');

const pedidoController = {
  // Crear pedido
  async crearPedido(req, res) {
    try {
      const pedido = await Pedido.create(req.body);
      res.status(201).json(pedido);
    } catch (error) {
      console.error('Error al crear pedido:', error);
      res.status(500).json({ error: 'No se pudo crear el pedido' });
    }
  },
  async getClientesDeudores() {
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
      return result.rows;
    } catch (err) {
      console.error('Error en ClientesDeudoresModel:', err);
      throw err;
    }
  },
  async getClientesDeudores(req, res) {
    console.log("entro a controller de deudores");
    try {
      const clientes = await Pedido.getClientesDeudores();
      console.log("deudores: "+clientes);
      res.json(clientes);
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener clientes deudores' });
    }
  },
  async agregarPago(req, res) {
  try {
    const { id } = req.params; // id del pedido
    const { metodo_pago, monto } = req.body;

    if (!metodo_pago || !monto) {
      return res.status(400).json({ error: 'Falta método de pago o monto' });
    }

    let comprobante = null;
    let comprobante_id = null;
    if (req.file) {
      comprobante = req.file.path;
      comprobante_id = req.file.filename || req.file.public_id;
    }

    await Pedido.agregarPago(parseInt(id), metodo_pago, parseFloat(monto), comprobante, comprobante_id);
    res.json({ success: true, message: 'Pago registrado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo registrar el pago' });
  }
},
async obtenerPagos(req, res) {
  try {
    
    const { pedido_id } = req.params;
    const pagos = await Pedido.getPagosByPedido(pedido_id);
    console.log('entro a obtener pagos');
    console.log(pedido_id);
    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener pagos:', error);
    res.status(500).json({ error: error.message });
  }
},
  async editarPago(req, res) {
    try {
      const { pago_id } = req.params;
      const { metodo_pago, monto_pagado } = req.body;
      let comprobante, comprobante_id;

      if (req.file) {
        comprobante = req.file.path;
        comprobante_id = req.file.filename || req.file.public_id;
      }

      const pagoActualizado = await Pedido.editarPago(pago_id, { metodo_pago, monto_pagado, comprobante, comprobante_id });
      res.json(pagoActualizado);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  },

  async marcarEntregado(req, res) {
  try {
    const { id } = req.params;
    await Pedido.actualizarEstadoEntregado(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo actualizar el pedido' });
  }
},
async marcarCompletado(req, res) {
  try {
    const { id } = req.params;
    await Pedido.marcarCompletado(parseInt(id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "No se pudo completar el pedido" });
  }
},

  // Obtener todos los pedidos
  async obtenerPedidos(req, res) {
    try {
      const pedidos = await Pedido.getAll();
      res.json(pedidos);
    } catch (error) {
      console.error('Error al obtener pedidos:', error);
      res.status(500).json({ error: 'No se pudieron obtener los pedidos' });
    }
  },

  async obtenerPedidosPorUsuario(req, res) {
  try {
    const { usuario_id } = req.params;
    const pedidos = await Pedido.getOrdersByUserId(usuario_id);
    res.json(pedidos);
  } catch (error) {
    console.error('Error al obtener pedidos del usuario:', error);
    res.status(500).json({ error: 'No se pudieron obtener los pedidos del usuario' });
  }
},
async obtenerProductosPedido(req, res) {
  try {
    const { pedidoId } = req.params;
    const productos = await Pedido.getProductosByPedido(pedidoId); // Función en el modelo
    res.json(productos);
  } catch (error) {
    console.error('Error al obtener productos del pedido:', error);
    res.status(500).json({ error: 'No se pudieron obtener los productos del pedido' });
  }
},
async guardarComprobante(req, res) {
  try {
    const { id } = req.params; // id del pedido
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    // req.file.path → URL pública de Cloudinary
    // req.file.filename o req.file.public_id → ID de Cloudinary
    const urlComprobante = req.file.path;
    const idComprobante = req.file.filename || req.file.public_id;

    const pedidoActualizado = await Pedido.guardarComprobante(id, urlComprobante, idComprobante);

    res.json(pedidoActualizado);
  } catch (error) {
    console.error('Error al guardar comprobante:', error);
    res.status(500).json({ error: 'No se pudo guardar el comprobante' });
  }
},
async agregarRecibo(req, res) {
  try {
    const { id } = req.params;
    const { numeroRecibo } = req.body;
    console.log(req.params);
    console.log(id);
    if (!numeroRecibo) {
      return res.status(400).json({ error: 'Debe proporcionar un número de recibo' });
    }

    const pedidoActualizado = await Pedido.agregarRecibo(parseInt(id), numeroRecibo);

    res.json(pedidoActualizado);
  } catch (error) {
    console.error('Error al agregar recibo:', error);
    res.status(500).json({ error: 'No se pudo agregar el recibo al pedido' });
  }
},
async confirmarEntrega(req, res) {
  try {
    const { id } = req.params;
    const pedidoEntregado = await Pedido.confirmarEntrega(parseInt(id));
    res.json(pedidoEntregado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
},
async obtenerPedidosAsignados(req, res) {
  try {
    const { conductor_id } = req.params; // ID del conductor desde la URL
    const pedidos = await Pedido.getAssignedOrdersByDriver(conductor_id);
    console.log(conductor_id);
    console.log("pedidos: "+ pedidos.toString);
    res.json(pedidos);
  } catch (error) {
    console.error('Error al obtener pedidos asignados al conductor:', error);
    res.status(500).json({ error: 'No se pudieron obtener los pedidos asignados al conductor' });
  }
},

  // Obtener pedido por ID
  async obtenerPedidoPorId(req, res) {
    try {
      const pedido = await Pedido.getById(req.params.id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }
      res.json(pedido);
    } catch (error) {
      console.error('Error al obtener pedido por ID:', error);
      res.status(500).json({ error: 'No se pudo obtener el pedido' });
    }
  },

  // Obtener pedidos por usuario y estado
  async obtenerPedidosPorEstadoycliente(req, res) {
    try {
      const { usuario_id, estado } = req.params;
      const pedidos = await Pedido.getByEstadoYCliente(usuario_id, estado);
      res.json(pedidos);
    } catch (error) {
      console.error('Error al obtener pedidos por estado:', error);
      res.status(500).json({ error: 'No se pudo obtener los pedidos' });
    }
  },

   async obtenerPedidosPorEstado(req, res) {
    try {
      const { estado } = req.params;
      const pedidos = await Pedido.getByEstado(estado);
      res.json(pedidos);
    } catch (error) {
      console.error('Error al obtener pedidos por estado:', error);
      res.status(500).json({ error: 'No se pudo obtener los pedidos' });
    }
  },

  async getPendingOrders(req, res) {
    try {
      const result = await Pedido.getPendingOrders(req, res);
      return result; // ya devuelve res.json en el modelo
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener pedidos pendientes' });
    }
  },

  // Actualizar estado de un pedido
  async actualizarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      const pedido = await Pedido.actualizarEstado(id, estado);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
      }
      res.json(pedido);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      res.status(500).json({ error: 'No se pudo actualizar el estado' });
    }
  },

  async obtenerPedidosPendientesSinConductor(req, res) {
  try {
    const pedidos = await Pedido.getPendingWithoutDriver();
    res.json(pedidos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudieron obtener los pedidos' });
  }
},

async updateProductPriceInPedido(req, res) {
 const pedido_id = req.params.pedidoId; // de la URL
    const producto_id = req.params.pedidoproductoId; // de la URL
    const nuevoPrecio = req.body.precio; // del JSON que envías desde Flutt
  try {
    console.log('pedido_id: '+ pedido_id);
    console.log('producto_id: '+ producto_id);
    console.log('nuevoPrecio: '+ nuevoPrecio);
    const updated = await Pedido.updateProductPriceInPedido(pedido_id, producto_id, nuevoPrecio);
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
},

  // Asignar conductor
async asignarConductor(req, res) {
  try {
    const { pedidoId, conductorId } = req.params; // tomar los params de la URL

    console.log("Pedido ID:", pedidoId);
    console.log("Conductor ID:", conductorId);

    const pedido = await Pedido.assignConductor(parseInt(pedidoId), parseInt(conductorId));

    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(pedido);
  } catch (error) {
    console.error('Error al asignar conductor:', error);
    res.status(500).json({ error: 'No se pudo asignar conductor' });
  }
}
};

module.exports = pedidoController;
