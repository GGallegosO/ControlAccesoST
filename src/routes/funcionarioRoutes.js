const express = require('express');
const router = express.Router();
const funcionarioController = require('../controllers/funcionarioController'); 

// Aquí definimos la ruta POST
router.post('/crear-evento', funcionarioController.crearEvento);
// Rutas para traer información
router.get('/eventos', funcionarioController.obtenerEventos);
router.get('/metricas', funcionarioController.obtenerMetricas);
router.get('/fechas-con-eventos', funcionarioController.obtenerFechasEventos);
router.get('/colegas', funcionarioController.obtenerColegas);
router.post('/agregar-coanfitriones', funcionarioController.agregarCoanfitrionesExtra);
router.put('/visita/:id_visita/cancelar', funcionarioController.cancelarVisita);

module.exports = router;