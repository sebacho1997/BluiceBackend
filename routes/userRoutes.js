// routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Rutas relacionadas con usuarios
router.post('/', authMiddleware, userController.createUser);  // Crear usuario (solo administradores)
router.get('/', authMiddleware, userController.getAllUsers);  // Obtener todos los usuarios (solo administradores)
router.get("/type/:tipoUsuario", userController.getUsersByType);//Filtrar por usuarios
router.get('/:id', authMiddleware, userController.getUserById);  // Obtener usuario por ID (solo administradores)
router.put('/:id', authMiddleware, userController.updateUser);
router.delete('/:id', authMiddleware, userController.deleteUser); // Eliminar usuario por ID

module.exports = router;