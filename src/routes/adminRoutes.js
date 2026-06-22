const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verificarToken, esAdmin } = require('../middlewares/authMiddleware');

// BLINDAJE GLOBAL: Cualquier petición a este set de rutas debe tener un Token válido y rol de Admin
router.use(verificarToken);
router.use(esAdmin);

// Dashboard y Reportes
router.get('/dashboard/metricas', adminController.getDashboardMetrics);
router.get('/reportes', adminController.getReportes);

// CRUD Unidades
router.get('/unidades', adminController.getUnidades);
router.post('/unidades', adminController.crearUnidad);
router.put('/unidades/:id', adminController.actualizarUnidad);
router.delete('/unidades/:id', adminController.eliminarUnidad);

// CRUD Usuarios
router.get('/usuarios', adminController.getUsuarios);
router.post('/usuarios', adminController.crearUsuario);
router.put('/usuarios/:id', adminController.actualizarUsuario);
router.delete('/usuarios/:id', adminController.eliminarUsuario);

module.exports = router;