const express = require('express');
const router = express.Router();
const bot = require('../services/whatsappBot');

// Simulador del bot de WhatsApp - SOLO DESARROLLO.
// Se habilita con WHATSAPP_SIMULADOR=true en el .env local.
// NO activar en producción (Render): permitiría crear pedidos sin login.
function soloSimulador(req, res, next) {
  if (process.env.WHATSAPP_SIMULADOR !== 'true') {
    return res.status(404).json({ error: 'No encontrado' });
  }
  next();
}

// POST /api/whatsapp/simular  { telefono, texto, latitud?, longitud? }
// Simula un mensaje de WhatsApp entrante. latitud/longitud simulan una
// ubicación compartida. Devuelve las respuestas del bot.
router.post('/simular', soloSimulador, async (req, res) => {
  try {
    const { telefono, texto, latitud, longitud } = req.body || {};
    if (!telefono || (!texto && (latitud === undefined || longitud === undefined))) {
      return res
        .status(400)
        .json({ error: 'Se requiere telefono y texto o ubicación' });
    }
    const ubicacion =
      latitud !== undefined && longitud !== undefined
        ? { latitud, longitud }
        : undefined;
    const result = await bot.handleIncoming(telefono, texto || '', ubicacion);
    res.json(result);
  } catch (err) {
    console.error('Error en simulador WhatsApp:', err);
    res.status(500).json({ error: 'Error procesando el mensaje' });
  }
});

module.exports = router;
