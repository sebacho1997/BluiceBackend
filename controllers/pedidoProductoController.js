const PedidoProducto = require('../models/PedidoProducto');

const pedidoProductoController = {
  // Agregar un producto a un pedido
  async agregarProducto(req, res) {
    try {
      const { pedido_id, producto_id, cantidad } = req.body;
      const pedidoProd = await PedidoProducto.create({ pedido_id, producto_id, cantidad });
      res.status(201).json(pedidoProd);
    } catch (error) {
      console.error('Error al agregar producto al pedido:', error);
      res.status(500).json({ mensaje: 'No se pudo agregar el producto al pedido' });
    }
  },

  // Obtener productos de un pedido
  async obtenerProductosPorPedido(req, res) {
    try {
      const { pedido_id } = req.params;
      const productos = await PedidoProducto.getByPedido(pedido_id);
      res.json(productos);
    } catch (error) {
      console.error('Error al obtener productos del pedido:', error);
      res.status(500).json({ mensaje: 'No se pudieron obtener los productos del pedido' });
    }
  },

  // Eliminar productos de un pedido
  async eliminarProductosPorPedido(req, res) {
    try {
      const { pedido_id } = req.params;
      const eliminado = await PedidoProducto.deleteByPedido(pedido_id);
      if (!eliminado) return res.status(404).json({ mensaje: 'No se encontraron productos para eliminar' });
      res.json({ mensaje: 'Productos del pedido eliminados correctamente' });
    } catch (error) {
      console.error('Error al eliminar productos del pedido:', error);
      res.status(500).json({ mensaje: 'No se pudieron eliminar los productos del pedido' });
    }
  }
};

module.exports = pedidoProductoController;
