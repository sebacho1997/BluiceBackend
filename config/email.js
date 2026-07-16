const nodemailer = require('nodemailer');

function createTransporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendConfirmationEmail(email, nombre, token) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[DEV] Email de confirmacion para ${email}: ${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/confirm-email?token=${token}`);
    return;
  }

  const baseUrl = process.env.BASE_URL || 'https://bluicebackend.onrender.com';
  const confirmUrl = `${baseUrl}/api/auth/confirm-email?token=${token}`;

  await transporter.sendMail({
    from: `"BluIce" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Confirma tu correo electronico - BluIce',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1D4ED8;">Bienvenido a BluIce, ${nombre}!</h2>
        <p>Gracias por registrarte. Para poder realizar pedidos, necesitas confirmar tu correo electronico.</p>
        <a href="${confirmUrl}"
           style="display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
          Confirmar mi correo
        </a>
        <p style="color: #6B7280; font-size: 14px;">O copia este enlace en tu navegador:</p>
        <p style="color: #6B7280; font-size: 12px; word-break: break-all;">${confirmUrl}</p>
        <p style="color: #6B7280; font-size: 14px;">Este enlace expirara en 24 horas.</p>
      </div>
    `,
  });
}

module.exports = { sendConfirmationEmail };
