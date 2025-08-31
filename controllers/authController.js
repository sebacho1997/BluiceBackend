// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const authController = {
  async register(req, res) {
    const { nombre, email,telefono, password,activado, tipo_usuario } = req.body;

    // Verifica si el email ya existe en la base de datos
    const existingUser = await User.getByEmail(email);
    console.log(existingUser);
    if (existingUser) {
      return res.status(400).send('El email ya está registrado');
    }

    // Hashea la contraseña antes de almacenarla
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crea el nuevo usuario
    const newUser = await User.create({ nombre,telefono, email, password: hashedPassword,activado, tipo_usuario });
    
    // Enviar una respuesta de éxito
    res.status(201).json({ message: 'Usuario registrado con éxito', user: newUser });
  },

  async signup(req, res) {
  const { nombre,telefono, email, password,activado,tipo_usuario } = req.body;

  // Verifica si el email ya existe
  const existingUser = await User.getByEmail(email);
  if (existingUser) {
    return res.status(400).send('El email ya está registrado');
  }

  // Hashea la contraseña
  const hashedPassword = await bcrypt.hash(password, 10);

  // Crea el nuevo usuario con tipo 'cliente'
  const newUser = await User.create({
    nombre,
    telefono,
    email,
    password: hashedPassword,
    activado,
    tipo_usuario: 'cliente'  // Forzado como cliente
  });

  res.status(201).json({
    message: 'Cliente registrado con éxito',
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
  const { email, contraseña } = req.body;
  console.log("lo que se recibe:", req.body);
  
  const user = await User.getByEmail(email);
  if (!user) {
    return res.status(404).send('Usuario no encontrado');
  }
  console.log("encontrado pass:", user.password);
  console.log("comparando", user.password, contraseña);
  const match = await bcrypt.compare(contraseña, user.password);
  if (!match) {
    return res.status(401).send('Contraseña incorrecta');
  }

  const token = jwt.sign({ id: user.id, tipo_usuario: user.tipo_usuario }, 'tu_clave_secreta', { expiresIn: '1h' });

  res.json({
    token,
    usuario: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.tipo_usuario
    }
  });

  console.log("token es:", token);
}
};

module.exports = authController;
