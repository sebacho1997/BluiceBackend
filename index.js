// index.js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes'); // Ruta de autenticación
const userRoutes = require('./routes/userRoutes'); // Ruta de usuarios
const pedidoRoutes = require('./routes/pedidoRoutes'); // Ruta de pedidos
const direccionRoutes = require('./routes/direccionRoutes');
const productoRoutes = require('./routes/productoRoutes');
const inventarioConductorRoutes = require('./routes/inventarioConductorRoutes');
const pedidoImagenesRoutes = require("./routes/pedidoImagenesRoutes");
const prestamoEquipoRoutes = require('./routes/prestamoEquipoRoutes');
const gastosDiaRoutes = require('./routes/gastosDiaRoutes');
const contratoRoutes = require('./routes/contratoRoutes');
const reporteMes= require('./models/reporteMes');
const reportePersonalizado = require('./models/reportePersonalizado');
const reporteRouter = require('./models/prueba');
const app = express();

app.use(cors());
app.use(express.json()); 

app.use('/api/auth', authRoutes); 
app.use('/api/users', userRoutes); 
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/direcciones', direccionRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/inventario', inventarioConductorRoutes); 
app.use('/api/pedidoImagenes', pedidoImagenesRoutes);
app.use('/api/prestamos', prestamoEquipoRoutes);
app.use('/api/gastos', gastosDiaRoutes);
app.use('/api/contratos', contratoRoutes);

app.use('/api', reporteRouter); 
app.use('/api', reporteMes); 
app.use('/api', reportePersonalizado); 

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
