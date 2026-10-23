// routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const { authMiddleware, requireRoles, requireAdminOrSelf } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, requireRoles('admin'), userController.createUser);
router.get('/', authMiddleware, requireRoles('admin'), userController.getAllUsers);
router.get("/type/:tipoUsuario", authMiddleware, userController.getUsersByType);
router.get('/:id', authMiddleware, userController.getUserById);
// Un admin puede editar cualquiera; un usuario normal solo a si mismo, y en
// ese caso el controlador limita los campos a los que le son propios.
router.put('/:id', authMiddleware, requireAdminOrSelf, userController.updateUser);
router.delete('/:id', authMiddleware, requireRoles('admin'), userController.deleteUser);

module.exports = router;