const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
const pool = require('../config/db');
const { sendConfirmationEmail, sendPasswordResetEmail } = require('../config/email');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateTokenId,
  hashToken,
  getRefreshTokenExpiresAt
} = require('../config/auth');

async function buildAuthResponse(user) {
  const tokenId = generateTokenId();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, tokenId);

  await RefreshToken.deleteExpired();
  await RefreshToken.create({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    jwtId: tokenId,
    expiresAt: getRefreshTokenExpiresAt()
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    usuario: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.tipo_usuario,
      email_confirm: user.email_confirm ?? true
    }
  };
}

const authController = {
  async register(req, res) {
    try {
      const { nombre, email, telefono, password, tipo_usuario } = req.body;
      const userTipo = tipo_usuario || 'admin';
      const activado = true;

      if (email && email.trim() !== '') {
        const existingUser = await User.getByEmail(email);
        if (existingUser) {
          return res.status(400).json({ error: 'El email ya esta registrado' });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        nombre,
        telefono,
        email,
        password: hashedPassword,
        activado,
        tipo_usuario: userTipo
      });

      res.status(201).json(newUser);
    } catch (error) {
      console.error('Error en register:', error);
      res.status(500).json({ error: 'No se pudo crear el usuario' });
    }
  },

  async signup(req, res) {
    try {
      const { nombre, telefono, email, password, activado } = req.body;

      const existingUser = await User.getByEmail(email);
      if (existingUser) {
        return res.status(400).send('El email ya esta registrado');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        nombre,
        telefono,
        email,
        password: hashedPassword,
        activado,
        tipo_usuario: 'cliente',
        email_confirm: false
      });

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO email_confirm_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [newUser.id, token, expiresAt]
      );

      try {
        await sendConfirmationEmail(email, nombre, token);
      } catch (emailError) {
        console.error('Error al enviar email de confirmacion:', emailError.message);
      }

      res.status(201).json({
        message: 'Cliente registrado con exito. Revisa tu correo para confirmar tu cuenta.',
        user: {
          id: newUser.id,
          nombre: newUser.nombre,
          telefono: newUser.telefono,
          email: newUser.email,
          tipo_usuario: newUser.tipo_usuario,
          email_confirm: false
        }
      });
    } catch (error) {
      console.error('Error en signup:', error);
      res.status(500).send('Error al registrar cliente');
    }
  },

  async confirmEmail(req, res) {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).send('Token no proporcionado');
      }

      const result = await pool.query(
        `SELECT * FROM email_confirm_tokens
         WHERE token = $1
           AND used_at IS NULL
           AND expires_at > NOW()`,
        [token]
      );

      const tokenRow = result.rows[0];
      if (!tokenRow) {
        return res.status(400).send('Token invalido o expirado');
      }

      await User.confirmEmail(tokenRow.user_id);

      await pool.query(
        'UPDATE email_confirm_tokens SET used_at = NOW() WHERE id = $1',
        [tokenRow.id]
      );

      res.send('Correo confirmado exitosamente. Ya puedes iniciar sesion y realizar pedidos.');
    } catch (error) {
      console.error('Error al confirmar email:', error);
      res.status(500).send('Error al confirmar el correo');
    }
  },

  async login(req, res) {
    const { email, contrasena } = req.body;

    const user = await User.getByEmail(email);
    if (!user) {
      return res.status(404).send('Usuario no encontrado');
    }

    if (user.activado === false) {
      return res.status(403).send('Usuario desactivado');
    }

    const match = await bcrypt.compare(contrasena, user.password);
    if (!match) {
      return res.status(401).send('Contrasena incorrecta');
    }

    const authResponse = await buildAuthResponse(user);
    res.json(authResponse);
  },

  async refresh(req, res) {
    try {
      const refreshToken = req.body.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token no proporcionado' });
      }

      const payload = verifyRefreshToken(refreshToken);
      if (payload.type !== 'refresh') {
        return res.status(403).json({ error: 'Refresh token invalido' });
      }

      const refreshTokenHash = hashToken(refreshToken);
      const storedToken = await RefreshToken.findActiveByTokenHash(refreshTokenHash);
      if (!storedToken) {
        return res.status(403).json({ error: 'Refresh token revocado o expirado' });
      }

      if (storedToken.user_id !== payload.id || storedToken.jwt_id !== payload.tokenId) {
        return res.status(403).json({ error: 'Refresh token invalido' });
      }

      const user = await User.getByIdWithPassword(payload.id);
      if (!user || user.activado === false) {
        await RefreshToken.revokeByTokenHash(refreshTokenHash);
        return res.status(403).json({ error: 'Usuario no disponible' });
      }

      const nextTokenId = generateTokenId();
      const nextAccessToken = signAccessToken(user);
      const nextRefreshToken = signRefreshToken(user, nextTokenId);
      const nextRefreshTokenHash = hashToken(nextRefreshToken);

      await RefreshToken.revokeByTokenHash(refreshTokenHash, nextRefreshTokenHash);
      await RefreshToken.create({
        userId: user.id,
        tokenHash: nextRefreshTokenHash,
        jwtId: nextTokenId,
        expiresAt: getRefreshTokenExpiresAt()
      });

      res.json({
        token: nextAccessToken,
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
        usuario: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol: user.tipo_usuario,
          email_confirm: user.email_confirm ?? true
        }
      });
    } catch (error) {
      return res.status(403).json({ error: 'Refresh token invalido o expirado' });
    }
  },

  async logout(req, res) {
    const refreshToken = req.body.refreshToken;

    if (refreshToken) {
      await RefreshToken.revokeByTokenHash(hashToken(refreshToken));
    }

    res.json({ message: 'Sesion cerrada correctamente' });
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      console.log(`[forgotPassword] Solicitud para: ${email}`);
      if (!email) {
        return res.status(400).json({ error: 'Email es requerido' });
      }

      const user = await User.getByEmail(email);
      if (!user) {
        console.log(`[forgotPassword] Usuario no encontrado: ${email}`);
        return res.json({ message: 'Si el correo existe, recibiras las instrucciones.' });
      }

      console.log(`[forgotPassword] Usuario encontrado: ${user.nombre}, generando token...`);

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await pool.query(
        `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
        [user.id]
      );

      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, token, expiresAt]
      );

      console.log(`[forgotPassword] Token guardado, enviando email a: ${email}`);

      await sendPasswordResetEmail(email, user.nombre, token);

      res.json({ message: 'Si el correo existe, recibiras las instrucciones.' });
    } catch (error) {
      console.error('[forgotPassword] Error:', error.message);
      res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token y nueva contrasena son requeridos' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
      }

      const result = await pool.query(
        `SELECT * FROM password_reset_tokens
         WHERE token = $1
           AND used_at IS NULL
           AND expires_at > NOW()`,
        [token]
      );

      const tokenRow = result.rows[0];
      if (!tokenRow) {
        return res.status(400).json({ error: 'Token invalido o expirado' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await pool.query(
        'UPDATE usuarios SET password = $1 WHERE id = $2',
        [hashedPassword, tokenRow.user_id]
      );

      await pool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
        [tokenRow.id]
      );

      await RefreshToken.revokeAllByUserId(tokenRow.user_id);

      res.json({ message: 'Contrasena actualizada exitosamente' });
    } catch (error) {
      console.error('Error en resetPassword:', error);
      res.status(500).json({ error: 'Error al restablecer la contrasena' });
    }
  },

  async logoutAll(req, res) {
    await RefreshToken.revokeAllByUserId(req.user.id);
    res.json({ message: 'Todas las sesiones fueron cerradas' });
  }
};

module.exports = authController;
