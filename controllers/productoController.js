const Producto = require('../models/Producto');
const cloudinary = require('../config/cloudinary'); // Asegúrate de configurar Cloudinary
const fs = require('fs');

const productoController = {
  // Crear producto
  async crearProducto(req, res) {
    console.log(req,res);
    try {
      const { nombre, cantidad, preciounitario } = req.body;

      if (!nombre || !cantidad || !preciounitario) {
        return res.status(400).json({ mensaje: "Completa todos los campos" });
      }

      const imageUrl = req.file?.path;
      const imageId = req.file?.filename;

      const producto = await Producto.create({
        nombre,
        cantidad,
        preciounitario,
        imagen: imageUrl,
        imagen_id: imageId
      });

      res.status(201).json(producto);
    } catch (error) {
      console.error('Error al crear producto:', error);
      res.status(500).json({ mensaje: 'No se pudo crear el producto' });
    }
  },

  // Actualizar producto
  async actualizarProducto(req, res) {
    try {
      const { id } = req.params;
      const { nombre, cantidad, preciounitario } = req.body;

      // Buscamos el producto actual
      const productoActual = await Producto.getById(id);
      if (!productoActual) return res.status(404).json({ mensaje: 'Producto no encontrado' });

      // Mantener valores actuales si no se envían
      const nombreFinal = nombre ?? productoActual.nombre;
      const cantidadFinal = cantidad ?? productoActual.cantidad;
      const preciounitarioFinal = preciounitario ?? productoActual.preciounitario;

      let imageUrl = productoActual.imagen;
      let imageId = productoActual.imagen_id;

      // Si llega nueva imagen, borrar la anterior en Cloudinary
      if (req.file) {
        if (imageId) {
          await cloudinary.uploader.destroy(imageId);
        }
        imageUrl = req.file.path;
        imageId = req.file.filename;
      }

      const producto = await Producto.update(id, {
        nombre: nombreFinal,
        cantidad: cantidadFinal,
        preciounitario: preciounitarioFinal,
        imagen: imageUrl,
        imagen_id: imageId
      });

      res.json(producto);
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      res.status(500).json({ mensaje: 'No se pudo actualizar el producto' });
    }
  },

  // Obtener todos los productos
  async obtenerProductos(req, res) {
    try {
      const productos = await Producto.getAll();
      res.json(productos);
    } catch (error) {
      console.error('Error al obtener productos:', error);
      res.status(500).json({ mensaje: 'No se pudo obtener los productos' });
    }
  },

  // Obtener producto por id
  async obtenerProductoPorId(req, res) {
    try {
      const { id } = req.params;
      const producto = await Producto.getById(id);
      if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
      res.json(producto);
    } catch (error) {
      console.error('Error al obtener producto:', error);
      res.status(500).json({ mensaje: 'No se pudo obtener el producto' });
    }
  },

  // Eliminar producto
  async eliminarProducto(req, res) {
    try {
      const { id } = req.params;
      const producto = await Producto.getById(id);
      if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });

      if (producto.imagen_id) {
        await cloudinary.uploader.destroy(producto.imagen_id);
      }

      const eliminado = await Producto.delete(id);
      if (!eliminado) return res.status(404).json({ mensaje: 'Producto no encontrado' });

      res.json({ mensaje: 'Producto eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      res.status(500).json({ mensaje: 'No se pudo eliminar el producto' });
    }
  }
};

module.exports = productoController;
