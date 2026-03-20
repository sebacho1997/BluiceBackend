const User = require('../models/user');
const bcrypt = require('bcryptjs');
const RefreshToken = require('../models/refreshToken');

const userController = {
  async createUser(req, res) {
    const { nombre, email, contraseña, tipo } = req.body;
    console.log('tipo usuario al crear: ' + req.user.tipo);

    const hashedPassword = await bcrypt.hash(contraseña, 10);
    const user = await User.create({ nombre, email, contraseña: hashedPassword, tipo });
    res.status(201).json(user);
  },

  async getAllUsers(req, res) {
    console.log('Obteniendo todos los usuarios...');
    const users = await User.getAll();
    res.json(users);
  },

  async getUserById(req, res) {
    const { id } = req.params;
    const user = await User.getById(id);

    if (!user) {
      return res.status(404).send('Usuario no encontrado');
    }

    res.json(user);
  },

  async updateUser(req, res) {
    const { id } = req.params;
    const { nombre, telefono, email, password, activado, tipo_usuario } = req.body;
    const currentUser = await User.getByIdWithPassword(id);

    if (!currentUser) {
      return res.status(404).send('Usuario no encontrado');
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : currentUser.password;

    const updatedUser = await User.update(id, {
      nombre: nombre ?? currentUser.nombre,
      telefono: telefono ?? currentUser.telefono,
      email: email ?? currentUser.email,
      password: hashedPassword,
      activado: activado ?? currentUser.activado,
      tipo_usuario: tipo_usuario ?? currentUser.tipo_usuario
    });

    if (password) {
      await RefreshToken.revokeAllByUserId(id);
    }

    res.json(updatedUser);
  },

  async getUsersByType(req, res) {
    try {
      const { tipoUsuario } = req.params;
      const users = await User.getUsersByType(tipoUsuario);
      res.json(users);
    } catch (error) {
      console.error('Error al obtener usuarios por tipo:', error);
      res.status(500).json({ error: 'Error al obtener usuarios por tipo' });
    }
  },

  async deleteUser(req, res) {
    const { id } = req.params;
    const deleted = await User.deleteById(id);

    if (!deleted) {
      return res.status(404).send('Usuario no encontrado');
    }

    await RefreshToken.revokeAllByUserId(id);
    res.send('Usuario eliminado correctamente');
  }
};

module.exports = userController;
