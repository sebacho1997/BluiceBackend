const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).send('Token no proporcionado');

  jwt.verify(token, 'tu_clave_secreta', (err, user) => {
    if (err) return res.status(403).send('Token inválido');

    req.user = user;
    next();
  });
}

module.exports = authMiddleware;
