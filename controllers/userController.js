const User = require('../models/user');
const bcrypt = require('bcryptjs');
const RefreshToken = require('../models/refreshToken');
const { isAdmin } = require('../middleware/authMiddleware');

const userController = {
  async createUser(req, res) {
    // Acepta los dos nombres que se usan en el proyecto: `password` /
    // `tipo_usuario` (los que manda register y signup) y `contraseña` / `tipo`.
    const {
      nombre,
      email,
      telefono,
      password,
      contrasena,
      tipo_usuario,
      tipo,
      activado
    } = req.body;
    const rawPassword = password || contrasena;
    const userTipo = tipo_usuario || tipo;

    if (!rawPassword) {
      return res.status(400).json({ error: 'La contrasena es requerida' });
    }
    if (!email) {
      return res.status(400).json({ error: 'El email es requerido' });
    }

    const existingUser = await User.getByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya esta registrado' });
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const user = await User.create({
      nombre,
      telefono,
      email,
      password: hashedPassword,
      activado: activado ?? true,
      tipo_usuario: userTipo || 'cliente'
    });
    res.status(201).json(user);
  },

  async getAllUsers(req, res) {
    console.log('Obteniendo todos los usuarios...');
    const users = await User.getAll();
    res.json(users);
  },

  async getUserById(req, res) {
    const { id } = req.params;
    const user = await User.getByIdIncludingSuperUser(id);

    if (!user) {
      return res.status(404).send('Usuario no encontrado');
    }

    res.json(user);
  },

  async updateUser(req, res) {
    const { id } = req.params;
    const {
      nombre,
      telefono,
      email,
      password,
      activado,
      tipo_usuario,
      rol,
      currentPassword,
      contrasenaActual
    } = req.body;

    const isSelf = String(req.user.id) === String(id);
    const currentUser = await User.getByIdWithPassword(id);

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Este endpoint sirve para dos cosas distintas y el body las distingue:
    // guardar el perfil (nombre/telefono/email) y cambiar la contrasena.
    const isPasswordChange = typeof password === 'string' && password.length > 0;

    if (isPasswordChange) {
      // La contrasena actual es obligatoria para el usuario que cambia la
      // suya. Un admin que restablece la de otro no la conoce, asi que solo
      // se le exige si la manda.
      const providedCurrentPassword = currentPassword || contrasenaActual;

      if (isSelf || providedCurrentPassword) {
        if (!providedCurrentPassword) {
          return res.status(400).json({
            error: 'Debes enviar la contrasena actual para cambiarla'
          });
        }

        const matches = await bcrypt.compare(
          providedCurrentPassword,
          currentUser.password
        );
        if (!matches) {
          return res.status(401).json({ error: 'La contrasena actual no es correcta' });
        }
      }
    }

    // Un usuario no admin si puede editar su nombre, telefono, email y
    // contrasena, pero no los campos que conceden privilegios: si `activado` o
    // `tipo_usuario` quedaran abiertos, un conductor se podria promover a
    // administrador a si mismo.
    const canEditPrivileges = isAdmin(req.user);
    const requestedTipoUsuario = tipo_usuario ?? rol;

    const updatedUser = await User.update(id, {
      nombre: nombre ?? currentUser.nombre,
      telefono: telefono ?? currentUser.telefono,
      email: email ?? currentUser.email,
      password: isPasswordChange ? await bcrypt.hash(password, 10) : currentUser.password,
      activado: canEditPrivileges ? activado ?? currentUser.activado : currentUser.activado,
      tipo_usuario: canEditPrivileges
        ? requestedTipoUsuario ?? currentUser.tipo_usuario
        : currentUser.tipo_usuario,
      // Antes no se reenviaba y el UPDATE ponia email_confirm en NULL, lo que
      // obligaba a confirmar el correo en cada edicion de perfil.
      email_confirm: currentUser.email_confirm
    });

    // Cambiar la contrasena invalida las sesiones vivas de ese usuario.
    if (isPasswordChange) {
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
