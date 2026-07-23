const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', authMiddleware, requireRoles('admin'), authController.register);
router.post('/login', authController.login);
router.post('/signup', authController.signup);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);
router.get('/confirm-email', authController.confirmEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
