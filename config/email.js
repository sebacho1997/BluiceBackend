const https = require('https');

const WEB_URL = process.env.WEB_URL || 'https://bluiceweb.netlify.app';

function sendViaEmailJS({ to, toName, subject, resetLink }) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: to,
        to_name: toName,
        subject,
        reset_link: resetLink,
      },
    });

    const req = https.request(
      {
        hostname: 'api.emailjs.com',
        path: '/api/v1.0/email/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`Email enviado a ${to}`);
            resolve();
          } else {
            console.error(`EmailJS error ${res.statusCode}: ${body}`);
            reject(new Error(`EmailJS: ${res.statusCode} ${body}`));
          }
        });
      },
    );

    req.on('error', (err) => {
      console.error(`Error enviando email a ${to}:`, err.message);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function sendPasswordResetEmail(email, nombre, token) {
  if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID) {
    console.log(`[DEV] Email pendiente para: ${email}`);
    console.log(`[DEV] Link: ${WEB_URL}/reset-password?token=${token}`);
    return;
  }

  const baseUrl = process.env.BASE_URL || 'https://bluicebackend.onrender.com';
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  await sendViaEmailJS({
    to: email,
    toName: nombre,
    subject: 'Recuperacion de contrasena - BluIce',
    resetLink,
  });
}

async function sendConfirmationEmail(email, nombre, token) {
  const baseUrl = process.env.BASE_URL || 'https://bluicebackend.onrender.com';
  const confirmUrl = `${baseUrl}/api/auth/confirm-email?token=${token}`;

  if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_TEMPLATE_ID) {
    console.log(`[DEV] Email de confirmacion pendiente para: ${email}`);
    console.log(`[DEV] Link: ${confirmUrl}`);
    return;
  }

  await sendViaEmailJS({
    to: email,
    toName: nombre,
    subject: 'Confirma tu correo electronico - BluIce',
    resetLink: confirmUrl,
  });
}

module.exports = { sendConfirmationEmail, sendPasswordResetEmail };