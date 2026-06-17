const db = require('../config/database');

// Controlador exclusivo para la vista del guardia
// Controlador exclusivo para la vista del guardia
exports.getVisitasHoyGuardia = async (req, res) => {
    try {
        const query = 'SELECT * FROM vw_visitas_guardia_hoy';
        
        // ¡SIN CORCHETES AQUÍ! Lo devolvemos a tu versión original que funcionaba
        const visitas = await db.query(query);

        res.json({
            success: true,
            data: visitas
        });

    } catch (error) {
        console.error('💥 Error al obtener visitas del guardia:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno al cargar las visitas de hoy',
            error: error.message 
        });
    }
};

// Actualizar el estado a INGRESO_REGISTRADO usando el Procedimiento Almacenado
exports.registrarIngreso = async (req, res) => {
    try {
        const idVisita = req.params.id;
        const idGuardia = req.body.id_usuario; 

        // Usamos la llamada limpia al procedimiento que creaste en MySQL
        const query = 'CALL sp_registrar_ingreso(?, ?)';
        
        
        await db.query(query, [idVisita, idGuardia]);

        // Si la promesa se resuelve bien, enviamos el éxito al frontend
        res.json({ success: true, message: 'Ingreso registrado correctamente' });

    } catch (error) {
        console.error('💥 Error al registrar ingreso:', error);
        res.status(500).json({ success: false, message: 'Error interno al actualizar la visita' });
    }
};