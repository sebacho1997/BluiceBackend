// Resuelve links cortos (maps.app.goo.gl, goo.gl, etc.) del lado del
// servidor y devuelve la URL final. Lo usan el endpoint /resolver-url
// (Flutter Web no puede leer redirects cross-origin por CORS) y el bot
// de WhatsApp para extraer coordenadas de links de Google Maps.

async function resolveShortUrl(target, timeoutMs = 10000) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch (_) {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target, {
      redirect: 'follow',
      signal: controller.signal,
    });
    await response.arrayBuffer();
    return response.url;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseCoordinatePair(text) {
  const parts = text.split(/[,\s;]+/).filter((p) => p.length > 0);
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitud: lat, longitud: lng };
}

// Extrae { latitud, longitud } de coordenadas sueltas o links de
// Google Maps (largos o cortos). Devuelve null si no hay coords.
async function extractCoordsFromText(raw) {
  const trimmed = (raw || '').toString().trim();
  if (!trimmed) return null;

  // 1) Coordenadas directas "lat,lng".
  const direct = parseCoordinatePair(trimmed);
  if (direct) return direct;

  let working = trimmed;
  try {
    const uri = new URL(trimmed);
    const host = uri.hostname.toLowerCase();
    // 2) Link corto: resolver primero.
    if (host.includes('maps.app.goo.gl') || host === 'goo.gl') {
      const resolved = await resolveShortUrl(trimmed);
      if (!resolved) return null;
      working = resolved;
    }
    // 3) Parámetros ?q= ?query= ?ll= ?center= ?destination=
    const params = new URL(working, 'https://x').searchParams;
    for (const key of ['q', 'll', 'query', 'center', 'destination']) {
      const value = params.get(key);
      if (!value) continue;
      const point = parseCoordinatePair(
        decodeURIComponent(value).replace(/\+/g, ' ')
      );
      if (point) return point;
    }
  } catch (_) {
    // No es URL: seguir con los patrones de texto.
  }

  const decoded = decodeURIComponent(working).replace(/\+/g, ' ');

  // 4) Formato /@lat,lng de Google Maps.
  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const point = parseCoordinatePair(`${atMatch[1]},${atMatch[2]}`);
    if (point) return point;
  }

  // 5) Formato !3dlat!4dlng de Google Maps.
  const dataMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch) {
    const point = parseCoordinatePair(`${dataMatch[1]},${dataMatch[2]}`);
    if (point) return point;
  }

  return null;
}

module.exports = { resolveShortUrl, extractCoordsFromText };
