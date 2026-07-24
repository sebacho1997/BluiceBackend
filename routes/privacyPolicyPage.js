const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidad - Blu Ice</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9;
      min-height: 100vh;
      padding: 20px;
      color: #1e293b;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    h1 { color: #1e3a5f; font-size: 28px; margin-bottom: 8px; }
    .date { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    h2 { color: #2563eb; font-size: 20px; margin: 24px 0 12px; }
    p, li { color: #475569; line-height: 1.7; font-size: 15px; margin-bottom: 10px; }
    ul { padding-left: 24px; margin-bottom: 12px; }
    strong { color: #1e293b; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 13px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Política de Privacidad</h1>
    <p class="date">Última actualización: julio 2026</p>

    <p>En <strong>Blu Ice</strong> nos tomamos en serio tu privacidad. Esta política explica de forma clara qué información recopilamos, para qué la usamos y cuáles son tus derechos.</p>

    <p>Al usar nuestra aplicación, aceptas las prácticas descritas aquí.</p>

    <h2>1. ¿Qué información recopilamos?</h2>
    <p>Cuando creas una cuenta y usas la aplicación, recopilamos:</p>
    <ul>
      <li>Tu nombre, correo electrónico y número de teléfono.</li>
      <li>Dirección de entrega y ubicación GPS (para que los conductores puedan llegar a tu domicilio).</li>
      <li>Historial de tus pedidos, productos comprados y pagos realizados.</li>
    </ul>

    <h2>2. ¿Para qué usamos tu información?</h2>
    <ul>
      <li>Procesar tus pedidos y coordinar la entrega.</li>
      <li>Mostrar a los conductores la dirección exacta donde entregar.</li>
      <li>Registrar tus pagos y enviarte tu comprobante.</li>
      <li>Enviarte correos para confirmar tu cuenta o recuperar tu contraseña.</li>
      <li>Mejorar la aplicación y ofrecerte un mejor servicio.</li>
    </ul>

    <h2>3. ¿Compartimos tus datos con alguien más?</h2>
    <p>No compartimos tu información con nadie. Solo la usamos internamente para procesar tus pedidos.</p>
    <p>No vendemos ni compartimos tus datos con terceros para publicidad o marketing.</p>

    <h2>4. Permisos que solicita la app</h2>
    <ul>
      <li><strong>Internet</strong> — para funcionar y conectarse con nuestros servidores.</li>
      <li><strong>Ubicación</strong> — para que los conductores puedan encontrar tu dirección.</li>
      <li><strong>Almacenamiento</strong> — para que puedas subir fotos de tus comprobantes.</li>
    </ul>

    <h2>5. Tus derechos</h2>
    <p>Puedes solicitar en cualquier momento:</p>
    <ul>
      <li>Ver los datos que tenemos de ti.</li>
      <li>Corregir información incorrecta.</li>
      <li>Eliminar tu cuenta y tus datos.</li>
      <li>Dejar de recibir correos nuestros.</li>
    </ul>
    <p>Para ejercer cualquiera de estos derechos, escríbenos desde la sección de ayuda en la aplicación.</p>

    <h2>6. Menores de edad</h2>
    <p>La aplicación está diseñada para mayores de 18 años. No recopilamos datos de menores intencionadamente.</p>

    <h2>7. Cambios a esta política</h2>
    <p>Si hacemos cambios importantes, te avisaremos a través de la aplicación o por correo electrónico.</p>

    <h2>8. Contacto</h2>
    <p>Si tienes dudas sobre cómo manejamos tus datos, contáctanos desde la sección de ayuda en la aplicación.</p>

    <div class="footer">
      &copy; 2026 Blu Ice &mdash; Todos los derechos reservados
    </div>
  </div>
</body>
</html>`);
});

module.exports = router;
