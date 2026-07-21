const express = require('express');
const router = express.Router();
const direccionController = require('../controllers/direccionController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/usuario/:usuario_id', authMiddleware, direccionController.getByUserId);
router.get('/:id', authMiddleware, direccionController.getById);

router.post('/users/:id', authMiddleware, direccionController.create);
router.put('/:id', authMiddleware, direccionController.update);
router.delete('/:id', authMiddleware, direccionController.delete);

module.exports = router;
