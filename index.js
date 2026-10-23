// Debe ser lo primero, antes de cualquier require: la zona horaria del proceso
// decide como `pg` interpreta las columnas `timestamp without time zone`.
// Sin esto, el servidor (UTC en Render) lee una hora de Bolivia como si fuera
// UTC y la API entrega el instante 4 h corrido.
process.env.TZ = process.env.APP_TIMEZONE || 'America/La_Paz';

require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const direccionRoutes = require('./routes/direccionRoutes');
const productoRoutes = require('./routes/productoRoutes');
const inventarioConductorRoutes = require('./routes/inventarioConductorRoutes');
const pedidoImagenesRoutes = require('./routes/pedidoImagenesRoutes');
const prestamoEquipoRoutes = require('./routes/prestamoEquipoRoutes');
const equipoRoutes = require('./routes/equipoRoutes');
const movimientoEquipoRoutes = require('./routes/movimientoEquipoRoutes');
const devolucionEquipoRoutes = require('./routes/devolucionEquipoRoutes');
const gastosDiaRoutes = require('./routes/gastosDiaRoutes');
const contratoRoutes = require('./routes/contratoRoutes');
const reporteMes = require('./models/reporteMes');
const reportePersonalizado = require('./models/reportePersonalizado');
const reporteRouter = require('./models/prueba');
const contratoDia = require('./models/contratoDia');
const contratoMes = require('./models/contratoMes');
const reporteClienteDia = require('./models/ReporteClienteDia');
const reporteClienteMes = require('./models/reporteClienteMes');
const reporteClientePersonalizado = require('./models/reporteClientePersonalizado');
const contratoPersonalizado = require('./models/contratoPersonalizado');
const inventarioConductorRestaRoutes = require('./routes/inventarioConductorRestaRoutes');
const clienteContratoMes = require('./models/clienteContratoMes');
const clienteContratoPersonalizado = require('./models/clienteContratoPersonalizado');
const initAuthTables = require('./config/initAuthTables');
const reporteGeneral = require('./models/reporteGeneral');
const reporteComisiones = require('./models/reporteComisiones');
const reporteListaClientes = require('./models/reporteListaClientes');
const reporteEquipos = require('./models/reporteEquipos');
const reporteInventarioConductor = require('./models/reporteInventarioConductor');
const reporteDevolucionesEquipo = require('./models/reporteDevolucionesEquipo');
const configRoutes = require('./routes/configRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reconciliacionRoutes = require('./routes/reconciliacionRoutes');
const excelRoutes = require('./routes/excelRoutes');
const reciboImpresoRoutes = require('./routes/reciboImpresoRoutes');
const resolverUrlRoutes = require('./routes/resolverUrl');
const whatsappRoutes = require('./routes/whatsapp');
const notificacionRoutes = require('./routes/notificacionRoutes');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use('/reset-password', require('./routes/resetPasswordPage'));
app.use('/confirm-email', require('./routes/confirmEmailPage'));
app.use('/privacy-policy', require('./routes/privacyPolicyPage'));
const baseUrlOrigin = (process.env.BASE_URL || '').replace(/\/api$/i, '');
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .concat(baseUrlOrigin ? [baseUrlOrigin] : []);

// Un origen configurado sin puerto (http://localhost) vale para cualquier
// puerto, que es lo que necesita `flutter run -d chrome`. Para cualquier otro
// host la comparacion es exacta: con startsWith, permitir https://app.bluice.com
// dejaba pasar tambien https://app.bluice.com.atacante.com, que es un origen
// distinto y puede leer las respuestas con credenciales.
function isOriginAllowed(origin) {
  return allowedOrigins.some((allowed) => {
    if (allowed === origin) return true;
    const bare = allowed.match(/^(https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])):?$/);
    return bare ? origin.startsWith(`${bare[1]}:`) : false;
  });
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) {
      return cb(null, true);
    }
    const allowed = isOriginAllowed(origin);
    cb(allowed ? null : new Error('Not allowed by CORS'), allowed);
  },
  // Necesario para que el navegador acepte la descarga del Excel: el token va
  // en la cabecera Authorization, que convierte la peticion en una que exige
  // preflight. Ademas el frontend necesita leer Content-Disposition para
  // nombrar el archivo.
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos, intente de nuevo en 15 minutos' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/direcciones', direccionRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/inventario', inventarioConductorRoutes);
app.use('/api/inventario-resta', inventarioConductorRestaRoutes);
app.use('/api/pedidoImagenes', pedidoImagenesRoutes);
app.use('/api/prestamos', prestamoEquipoRoutes);
app.use('/api/equipos', equipoRoutes);
app.use('/api/movimientos-equipos', movimientoEquipoRoutes);
app.use('/api/devoluciones-equipos', devolucionEquipoRoutes);
app.use('/api/gastos', gastosDiaRoutes);
app.use('/api/contratos', contratoRoutes);
app.use('/api/config', configRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reconciliacion', reconciliacionRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/recibos', reciboImpresoRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api', resolverUrlRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.use('/api', reporteRouter);
app.use('/api', reporteMes);
app.use('/api', reportePersonalizado);
app.use('/api', contratoDia);
app.use('/api', contratoMes);
app.use('/api', contratoPersonalizado);
app.use('/api', clienteContratoMes);
app.use('/api', clienteContratoPersonalizado);
app.use('/api', reporteClienteDia);
app.use('/api', reporteClienteMes);
app.use('/api', reporteClientePersonalizado);
app.use('/api', reporteGeneral);
app.use('/api', reporteComisiones);
app.use('/api', reporteListaClientes);
app.use('/api', reporteEquipos);
app.use('/api', reporteInventarioConductor);
app.use('/api', reporteDevolucionesEquipo);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initAuthTables();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
