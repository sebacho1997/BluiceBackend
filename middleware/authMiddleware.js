const { verifyAccessToken } = require('../config/auth');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).send('Token no proporcionado');
  }

  try {
    const user = verifyAccessToken(token);
    if (user.type !== 'access') {
      return res.status(403).send('Token no valido');
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(403).send('Token no valido');
  }
}

module.exports = authMiddleware;
