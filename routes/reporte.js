const express = require('express');
const router = express.Router();
const ReporteController = require('../controllers/ReporteController');

router.get('/reporte-detalle/:conductorId', ReporteController.generarReporte);
router.get('/reporte-detalle-mes/:conductorId/:mes',ReporteController.generarReporteMes);

module.exports = router;