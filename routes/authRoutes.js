// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Rutas de autenticación
router.post('/register', authController.register);  // Ruta para registrar usuarios
router.post('/login', authController.login);        // Ruta para iniciar sesión
router.post('/signup', authController.signup);

module.exports = router;
