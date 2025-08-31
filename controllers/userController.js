// controllers/userController.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const userController = {
  async createUser(req, res) {
    const { nombre, email, contraseña, tipo } = req.body;
    console.log("tipo usuario al crear: "+ req.user.tipo);
    // Solo los administradores pueden crear nuevos usuarios
    if (req.user.tipo !== 'administrador') {
      return res.status(403).send('Acceso denegado');
    }

    const hashedPassword = await bcrypt.hash(contraseña, 10);
    const user = await User.create({ nombre, email, contraseña: hashedPassword, tipo });
    res.status(201).json(user);
  },

  async getAllUsers(req, res) {
    // Solo los administradores pueden ver todos los usuarios
    console.log('Obteniendo todos los usuarios...');
    //if (req.user.tipo !== 'administrador') {
    //  return res.status(403).send('Acceso denegado');
    //}

    const users = await User.getAll(); // Asegúrate de implementar este método en el modelo
    res.json(users);
  },

  async getUserById(req, res) {
    const { id } = req.params;

    // Solo los administradores pueden ver un usuario específico
    if (req.user.tipo !== 'administrador') {
      return res.status(403).send('Acceso denegado');
    }

    const user = await User.getById(id); // Asegúrate de implementar este método en el modelo
    if (!user) {
      return res.status(404).send('Usuario no encontrado');
    }
    res.json(user);
  },

async updateUser(req, res) {
  const { id } = req.params;
  const { nombre,telefono, email, password,activado, tipo_usuario } = req.body;
  console.log("tipo Usuario:"+ req.user.tipo_usuario);
  if (req.user.tipo !== 'administrador') {
    return res.status(403).send('Acceso denegado');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const updatedUser = await User.update(id, {
    nombre,
    telefono,
    email,
    password: hashedPassword,
    activado,
    tipo_usuario
  });

  res.json(updatedUser);
},
async getUsersByType(req, res) {
    console.log("entra al controller del back para");
    try {
      const { tipoUsuario } = req.params;
      const users = await User.getUsersByType(tipoUsuario);
      res.json(users);
    } catch (error) {
      console.error("Error al obtener usuarios por tipo:", error);
      res.status(500).json({ error: "Error al obtener usuarios por tipo" });
    }
  },
async deleteUser(req, res) {
  const { id } = req.params;

  // Solo los administradores pueden eliminar usuarios
  console.log("tipo usuario: "+ req.user.tipo);
  if (req.user.tipo !== 'administrador') {
    return res.status(403).send('Acceso denegado');
  }

  const deleted = await User.deleteById(id);
  if (!deleted) {
    return res.status(404).send('Usuario no encontrado');
  }

  res.send('Usuario eliminado correctamente');
}
};

module.exports = userController;
