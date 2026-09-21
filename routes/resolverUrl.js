const express = require('express');
const router = express.Router();
const { resolveShortUrl } = require('../services/urlResolver');

// GET /api/resolver-url?url=https://maps.app.goo.gl/...
// Resuelve links cortos del lado del servidor y devuelve la URL final.
// Necesario para Flutter Web: el navegador bloquea leer redirects
// cross-origin por CORS, así que la app no puede resolverlos sola.
router.get('/resolver-url', async (req, res) => {
  const target = (req.query.url || '').toString().trim();
  const url = await resolveShortUrl(target);
  if (!url) {
    return res.status(502).json({ error: 'No se pudo resolver la URL' });
  }
  return res.json({ url });
});

module.exports = router;
