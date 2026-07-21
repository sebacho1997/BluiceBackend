// routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const { authMiddleware, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, requireRoles('admin'), userController.createUser);
router.get('/', authMiddleware, requireRoles('admin'), userController.getAllUsers);
router.get("/type/:tipoUsuario", authMiddleware, userController.getUsersByType);
router.get('/:id', authMiddleware, userController.getUserById);
router.put('/:id', authMiddleware, requireRoles('admin'), userController.updateUser);
router.delete('/:id', authMiddleware, requireRoles('admin'), userController.deleteUser);

module.exports = router;