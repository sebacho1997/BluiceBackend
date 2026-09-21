const express = require('express');
const router = express.Router();
const equipoController = require('../controllers/equipoController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, equipoController.create);
router.get('/', authMiddleware, equipoController.getAll);
router.get('/:id', authMiddleware, equipoController.getById);
router.put('/:id', authMiddleware, equipoController.update);
router.delete('/:id', authMiddleware, equipoController.delete);

module.exports = router;