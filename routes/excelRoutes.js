const express = require('express');
const router = express.Router();
const ExcelController = require('../controllers/excelController');
const { verifyAccessToken } = require('../config/auth');

function tokenFromQuery(req, res, next) {
  const token = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
  try {
    const user = verifyAccessToken(token);
    if (user.type !== 'access') return res.status(403).json({ error: 'Token no valido' });
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ error: 'Token no valido' });
  }
}

router.get('/reconciliacion/excel', tokenFromQuery, ExcelController.exportReconciliacion);

module.exports = router;
