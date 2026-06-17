const express = require('express');
const router = express.Router();
const visitaController = require('../controllers/visitaController');

// Ruta GET para obtener las visitas de hoy
router.get('/guardia/hoy', visitaController.getVisitasHoyGuardia);


router.put('/ingreso/:id', visitaController.registrarIngreso);

module.exports = router;