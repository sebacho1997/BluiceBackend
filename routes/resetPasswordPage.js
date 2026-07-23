const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const RefreshToken = require('../models/refreshToken');

const router = express.Router();

router.get('/', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('Token no proporcionado');
  }

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer contrasena - BluIce</title>
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
    }
    h1 { font-size: 24px; color: #1e293b; margin-bottom: 8px; }
    p { color: #64748b; margin-bottom: 24px; font-size: 14px; }
    .input-group { margin-bottom: 16px; }
    label { display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    input {
      width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0;
      border-radius: 10px; font-size: 15px; transition: border-color 0.2s;
    }
    input:focus { outline: none; border-color: #2563eb; }
    button {
      width: 100%; padding: 12px; background: #2563eb; color: white;
      border: none; border-radius: 10px; font-size: 16px; font-weight: 600;
      cursor: pointer; transition: background 0.2s;
    }
    button:hover { background: #1d4ed8; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .error { color: #dc2626; font-size: 13px; margin-top: 4px; display: none; }
    .spinner { display: none; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success { text-align: center; }
    .success h2 { color: #16a34a; margin-bottom: 8px; }
    .success p { margin-bottom: 20px; }
    .success a { color: #2563eb; text-decoration: none; font-weight: 600; }
    .success a:hover { text-decoration: underline; }
    .icon { width: 64px; height: 64px; margin: 0 auto 16px; background: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; }
  </style>
</head>
<body>
  <div class="card" id="root"></div>

  <script>
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      document.getElementById('root').innerHTML = '<p style="color:#dc2626;text-align:center;">Token no valido</p>';
    } else {
      document.getElementById('root').innerHTML = \`
        <h1>Restablecer contrasena</h1>
        <p>Ingresa tu nueva contrasena</p>
        <div class="input-group">
          <label>Nueva contrasena</label>
          <input type="password" id="password" placeholder="Minimo 6 caracteres" />
          <div class="error" id="passwordError">La contrasena debe tener al menos 6 caracteres</div>
        </div>
        <div class="input-group">
          <label>Confirmar contrasena</label>
          <input type="password" id="confirm" placeholder="Repite la contrasena" />
          <div class="error" id="confirmError">Las contrasenas no coinciden</div>
        </div>
        <button id="submitBtn" onclick="handleSubmit()">
          <span id="btnText">Restablecer contrasena</span>
          <div class="spinner" id="spinner"></div>
        </button>
        <div class="error" id="apiError" style="margin-top:12px;text-align:center;"></div>
      \`;
    }

    async function handleSubmit() {
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm').value;
      let valid = true;

      document.getElementById('passwordError').style.display = 'none';
      document.getElementById('confirmError').style.display = 'none';
      document.getElementById('apiError').style.display = 'none';

      if (password.length < 6) {
        document.getElementById('passwordError').style.display = 'block';
        valid = false;
      }
      if (password !== confirm) {
        document.getElementById('confirmError').style.display = 'block';
        valid = false;
      }
      if (!valid) return;

      const btn = document.getElementById('submitBtn');
      const btnText = document.getElementById('btnText');
      const spinner = document.getElementById('spinner');
      btn.disabled = true;
      btnText.style.display = 'none';
      spinner.style.display = 'block';

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: password }),
        });
        const data = await res.json();

        if (data.error) {
          document.getElementById('apiError').textContent = data.error;
          document.getElementById('apiError').style.display = 'block';
        } else {
          document.getElementById('root').innerHTML = \`
            <div class="success">
              <div class="icon">&#10003;</div>
              <h2>Contrasena actualizada</h2>
              <p>Ya puedes iniciar sesion con tu nueva contrasena.</p>
              <a href="bluiceweb://" onclick="this.href='https://bluiceweb.netlify.app/'">Ir a BluIce</a>
            </div>
          \`;
        }
      } catch (e) {
        document.getElementById('apiError').textContent = 'Error al conectar con el servidor';
        document.getElementById('apiError').style.display = 'block';
      }

      btn.disabled = false;
      btnText.style.display = 'inline';
      spinner.style.display = 'none';
    }
  </script>
</body>
</html>`);
});

module.exports = router;