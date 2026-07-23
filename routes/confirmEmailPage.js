const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  const { status, message } = req.query;

  let title, description, icon, color;
  if (status === 'success') {
    title = 'Email confirmado';
    description = message || 'Tu correo ha sido confirmado exitosamente. Ya puedes iniciar sesion y realizar pedidos.';
    icon = '&#10003;';
    color = '#16a34a';
  } else {
    title = 'Error';
    description = message || 'Token invalido o expirado. Solicita un nuevo registro.';
    icon = '&#10007;';
    color = '#dc2626';
  }

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - BluIce</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e3a5f, #2563eb);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      text-align: center;
    }
    .icon { width: 64px; height: 64px; margin: 0 auto 16px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; }
    h2 { color: #1e293b; margin-bottom: 8px; }
    p { color: #64748b; margin-bottom: 20px; font-size: 14px; }
    a { color: #2563eb; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h2>${title}</h2>
    <p>${description}</p>
    <a href="https://bluiceweb.netlify.app/">Ir a BluIce</a>
  </div>
</body>
</html>`);
});

module.exports = router;