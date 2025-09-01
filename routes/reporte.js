const express = require('express');
const router = express.Router();
const ReporteController = require('../controllers/ReporteController');

router.get('/reporte-detalle/:conductorId', ReporteController.generarReporte);
module.exports = router;