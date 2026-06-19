const express = require('express');
const router = express.Router();
const visitaController = require('../controllers/visitaController');

// Ruta GET para obtener las visitas de hoy
router.get('/guardia/hoy', visitaController.getVisitasHoyGuardia);


router.put('/ingreso/:id', visitaController.registrarIngreso);


// Ruta PUT para revertir un ingreso por error
router.put('/revertir/:id', visitaController.revertirIngreso);


// Ruta PUT para ingresos grupales
router.put('/ingreso-grupal', visitaController.registrarIngresoGrupal);


// Ruta PUT para quitar el vehículo de una visita
router.put('/quitar-auto/:id', visitaController.quitarVehiculo);


// Ruta PUT para asignar vehículo al vuelo
router.put('/asignar-auto/:id', visitaController.asignarVehiculo);

module.exports = router;