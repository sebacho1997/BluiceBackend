const express = require('express');
const router = express.Router();

// GET /api/resolver-url?url=https://maps.app.goo.gl/...
// Resuelve links cortos del lado del servidor y devuelve la URL final.
// Necesario para Flutter Web: el navegador bloquea leer redirects
// cross-origin por CORS, así que la app no puede resolverlos sola.
router.get('/resolver-url', async (req, res) => {
  const target = (req.query.url || '').toString().trim();

  let parsed;
  try {
    parsed = new URL(target);
  } catch (_) {
    return res.status(400).json({ error: 'URL inválida' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Solo se permiten URLs http(s)' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(target, {
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    await response.arrayBuffer();
    return res.json({ url: response.url });
  } catch (err) {
    console.error('Error resolviendo URL:', err.message);
    return res.status(502).json({ error: 'No se pudo resolver la URL' });
  }
});

module.exports = router;
