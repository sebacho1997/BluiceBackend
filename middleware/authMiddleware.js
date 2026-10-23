const { verifyAccessToken } = require('../config/auth');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const user = verifyAccessToken(token);
    if (user.type !== 'access') {
      return res.status(403).json({ error: 'Token no valido' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Token no valido' });
  }
}

function isAdmin(user) {
  const role = (user?.tipo_usuario || '').toLowerCase();
  return role === 'admin' || role.startsWith('admin');
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const userRole = (req.user.tipo_usuario || '').toLowerCase();
    const hasRole = roles.some(r => {
      const expected = r.toLowerCase();
      return userRole === expected || userRole.startsWith(expected);
    });
    if (!hasRole) {
      return res.status(403).json({ error: 'No tienes permisos para esta accion' });
    }
    next();
  };
}

// Permite editar a un admin cualquier usuario y a un usuario normal
// unicamente su propio registro. El controlador decide que campos puede
// tocar cada caso; aqui solo se resuelve el "quien".
function requireAdminOrSelf(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (isAdmin(req.user)) {
    return next();
  }
  if (String(req.user.id) === String(req.params.id)) {
    return next();
  }
  return res.status(403).json({ error: 'No tienes permisos para esta accion' });
}

module.exports = { authMiddleware, requireRoles, requireAdminOrSelf, isAdmin };
