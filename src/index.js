const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
require('./config/database');

// Importar rutas
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (Frontend)
// Ajuste: Como moviste 'public' a la raíz, salimos un nivel desde src (../)
app.use(express.static(path.join(__dirname, '../public')));

// Rutas de la API
app.use('/api/auth', authRoutes);

// Ruta de prueba
app.get('/api', (req, res) => {
    res.json({ mensaje: 'API del Sistema de Asistencia SJ funcionando 🚀' });
});

// Servir el index.html para cualquier ruta no API (SPA fallback)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor corriendo en http://localhost:${PORT}`);
});