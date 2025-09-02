const express = require('express');
const router = express.Router();
const ContratosController = require("../controllers/contratoController");

// === CONTRATOS ===
router.get('/', ContratosController.getAll);
router.get('/:id', ContratosController.getById);
router.post('/', ContratosController.create);
router.put('/:id', ContratosController.update);
router.delete('/:id', ContratosController.remove);
router.put('/:id/asignar-conductor', ContratosController.asignarConductor);

// === CONSUMOS ===
router.get('/:contrato_id/consumos', ContratosController.getConsumos);
router.post('/consumos', ContratosController.createConsumo);
router.delete('/consumos/:id', ContratosController.deleteConsumo);
router.put('/:consumoId/entregado', ContratosController.marcarEntregado);


// === DETALLES ===
router.get('/detalles/:consumo_id', ContratosController.getDetallesByConsumo);
router.post('/consumo-detalle', ContratosController.createDetalle);
router.delete('/detalles/:id', ContratosController.deleteDetalle);

module.exports = router;
