const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Definir la ruta de login
router.post('/login', authController.login);

module.exports = router;