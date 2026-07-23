const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const WEB_URL = process.env.WEB_URL || 'https://bluiceweb.netlify.app';

async function sendConfirmationEmail(email, nombre, token) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV] Email de confirmacion pendiente para: ${email}`);
    return;
  }

  const baseUrl = process.env.BASE_URL || 'https://bluicebackend.onrender.com';
  const confirmUrl = `${baseUrl}/api/auth/confirm-email?token=${token}`;

  await resend.emails.send({
    from: FROM_EMAIL,
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

async function sendPasswordResetEmail(email, nombre, token) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV] Email de recuperacion pendiente para: ${email}`);
    console.log(`[DEV] Link: ${WEB_URL}/reset-password?token=${token}`);
    return;
  }

  const resetUrl = `${WEB_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Recuperacion de contrasena - BluIce',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1D4ED8;">Recuperacion de contrasena - BluIce</h2>
        <p>Hola ${nombre},</p>
        <p>Recibimos una solicitud para restablecer tu contrasena. Haz clic en el boton de abajo para crear una nueva:</p>
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 16px 0;">
          Restablecer contrasena
        </a>
        <p style="color: #6B7280; font-size: 14px;">O copia este enlace en tu navegador:</p>
        <p style="color: #6B7280; font-size: 12px; word-break: break-all;">${resetUrl}</p>
        <p style="color: #6B7280; font-size: 14px;">Este enlace expirara en 1 hora.</p>
        <p style="color: #6B7280; font-size: 14px;">Si no solicitaste este cambio, ignora este mensaje.</p>
      </div>
    `,
  });
}

module.exports = { sendConfirmationEmail, sendPasswordResetEmail };