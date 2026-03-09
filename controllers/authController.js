// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authController = {
  async register(req, res) {
    try {
      const { nombre, email, telefono, password, activado, tipo_usuario } = req.body;

      // Verifica si el email ya existe en la base de datos
      if (email && email.trim() !== '') {
        const existingUser = await User.getByEmail(email);
        if (existingUser) {
          return res.status(400).json({ error: 'El email ya esta registrado' });
        }
      }

      // Hashea la contrasena antes de almacenarla
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crea el nuevo usuario
      const newUser = await User.create({
        nombre,
        telefono,
        email,
        password: hashedPassword,
        activado,
        tipo_usuario
      });

      // Devuelve directamente el usuario creado
      res.status(201).json(newUser);
    } catch (error) {
      console.error('Error en register:', error);
      res.status(500).json({ error: 'No se pudo crear el usuario' });
    }
  },

  async signup(req, res) {
    const { nombre, telefono, email, password, activado } = req.body;
    console.log('entro al signup');

    // Verifica si el email ya existe
    const existingUser = await User.getByEmail(email);
    if (existingUser) {
      return res.status(400).send('El email ya esta registrado');
    }

    // Hashea la contrasena
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crea el nuevo usuario con tipo 'cliente'
    const newUser = await User.create({
      nombre,
      telefono,
      email,
      password: hashedPassword,
      activado,
      tipo_usuario: 'cliente' // Forzado como cliente
    });

    res.status(201).json({
      message: 'Cliente registrado con exito',
      user: {
        id: newUser.id,
        nombre: newUser.nombre,
        telefono: newUser.telefono,
        email: newUser.email,
        tipo_usuario: newUser.tipo_usuario
      }
    });
  },

  async login(req, res) {
    const { email } = req.body;
    const contrasena = req.body.contrasena ?? req.body['contraseña'] ?? req.body['contraseÃ±a'];
    console.log('lo que se recibe:', req.body);

    const user = await User.getByEmail(email);
    if (!user) {
      return res.status(404).send('Usuario no encontrado');
    }

    if (user.activado === false) {
      return res.status(403).send('Usuario desactivado');
    }

    console.log('encontrado pass:', user.password);
    console.log('comparando', user.password, contrasena);
    const match = await bcrypt.compare(contrasena, user.password);
    if (!match) {
      return res.status(401).send('Contrasena incorrecta');
    }

    const token = jwt.sign(
      { id: user.id, tipo_usuario: user.tipo_usuario },
      'tu_clave_secreta',
      { expiresIn: '1h' }
    );

    res.json({
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.tipo_usuario
      }
    });

    console.log('token es:', token);
  }
};

module.exports = authController;
