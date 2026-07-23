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

const app = express();

app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
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
app.use('/api/gastos', gastosDiaRoutes);
app.use('/api/contratos', contratoRoutes);

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
