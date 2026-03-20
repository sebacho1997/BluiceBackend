const bcrypt = require('bcryptjs');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');
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
      rol: user.tipo_usuario
    }
  };
}

const authController = {
  async register(req, res) {
    try {
      const { nombre, email, telefono, password, activado, tipo_usuario } = req.body;

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
        tipo_usuario
      });

      res.status(201).json(newUser);
    } catch (error) {
      console.error('Error en register:', error);
      res.status(500).json({ error: 'No se pudo crear el usuario' });
    }
  },

  async signup(req, res) {
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
      tipo_usuario: 'cliente'
    });

    res.status(201).json({
      message: 'Cliente registrado con exito',
      user: {
        id: newUser.id,
        nombre: newUser.nombre,
        telefono: newUser.telefono,
        email: newUser.email,
        tipo_usuario: newUser.tipo_usuario
      }
    });
  },

  async login(req, res) {
    const { email } = req.body;
    const contrasena =
      req.body.contrasena ??
      req.body['contraseña'] ??
      req.body['contrasena'];

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
          rol: user.tipo_usuario
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

  async logoutAll(req, res) {
    await RefreshToken.revokeAllByUserId(req.user.id);
    res.json({ message: 'Todas las sesiones fueron cerradas' });
  }
};

module.exports = authController;
