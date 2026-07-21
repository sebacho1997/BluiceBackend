const express = require('express');
const router = express.Router();
const ContratosController = require("../controllers/contratoController");
const { authMiddleware, requireRoles } = require('../middleware/authMiddleware');

// === CONTRATOS ===
router.get('/', authMiddleware, ContratosController.getAll);
router.get('/:id', authMiddleware, ContratosController.getContratoById);
router.post('/', authMiddleware, requireRoles('admin', 'encargado'), ContratosController.create);
router.put('/:id', authMiddleware, requireRoles('admin', 'encargado'), ContratosController.update);
router.delete('/:id', authMiddleware, requireRoles('admin'), ContratosController.remove);
router.put('/:id/asignar-conductor', authMiddleware, ContratosController.asignarConductor);

// === CONSUMOS ===
router.get('/:contrato_id/consumos', authMiddleware, ContratosController.getConsumos);
router.post('/consumos', authMiddleware, ContratosController.createConsumo);
router.delete('/consumos/:id', authMiddleware, ContratosController.deleteConsumo);
router.put('/:consumoId/entregado', authMiddleware, ContratosController.marcarEntregado);

// === DETALLES ===
router.get('/detalles/:consumo_id', authMiddleware, ContratosController.getDetallesByConsumo);
router.post('/consumo-detalle', authMiddleware, ContratosController.createDetalle);
router.delete('/detalles/:id', authMiddleware, ContratosController.deleteDetalle);

module.exports = router;
