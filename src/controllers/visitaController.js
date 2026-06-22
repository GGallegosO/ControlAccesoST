


const db = require('../config/database');


// Controlador exclusivo para la vista del guardia
exports.getVisitasHoyGuardia = async (req, res) => {
    try {
        const query = 'SELECT * FROM vw_visitas_guardia_hoy';
        
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

// Revertir el ingreso usando el Procedimiento Almacenado
exports.revertirIngreso = async (req, res) => {
    try {
        const idVisita = req.params.id;

        // Llamada limpia al procedimiento que creaste en MySQL
        const query = 'CALL sp_revertir_ingreso(?)';
        
        // SIN CORCHETES para evitar el error 500 de lectura
        await db.query(query, [idVisita]);

        res.json({ success: true, message: 'Ingreso revertido correctamente' });

    } catch (error) {
        console.error('💥 Error al revertir ingreso:', error);
        res.status(500).json({ success: false, message: 'Error interno al revertir la visita' });
    }
};

// Registrar ingreso grupal heredando el vehículo del conductor
exports.registrarIngresoGrupal = async (req, res) => {
    try {
        const { id_conductor, ids_acompanantes, id_usuario } = req.body;

        //  Obtener los datos del auto del conductor (¡SIN CORCHETES!)
        const queryAuto = 'SELECT auto_patente, auto_marca, auto_modelo, auto_color FROM VISITA WHERE id_visita = ?';
        const conductorData = await db.query(queryAuto, [id_conductor]);

        if (conductorData.length === 0) {
            return res.status(404).json({ success: false, message: 'Conductor no encontrado' });
        }

        const auto = conductorData[0];

        //  Si hay acompañantes, usamos el Procedimiento Almacenado
        if (ids_acompanantes && ids_acompanantes.length > 0) {
            // Convertimos el arreglo [2, 4, 5] en un string "2,4,5"
            const idsString = ids_acompanantes.join(',');
            
            const queryAcompanantes = 'CALL sp_ingresar_acompanantes(?, ?, ?, ?, ?, ?)';
            
            const params = [
                auto.auto_patente, 
                auto.auto_marca, 
                auto.auto_modelo, 
                auto.auto_color, 
                id_usuario, 
                idsString
            ];
            
            
            await db.query(queryAcompanantes, params);
        }

        // Finalmente, ingresamos al conductor usando tu SP original
        await db.query('CALL sp_registrar_ingreso(?, ?)', [id_conductor, id_usuario]);

        res.json({ success: true, message: 'Ingreso grupal registrado y vehículos asignados' });

    } catch (error) {
        console.error('💥 Error en ingreso grupal:', error);
        res.status(500).json({ success: false, message: 'Error interno al registrar el grupo' });
    }
};

// Quitar vehículo a una visita (si el guardia se equivocó al agrupar)
exports.quitarVehiculo = async (req, res) => {
    try {
        const idVisita = req.params.id;
        const query = `
            UPDATE VISITA 
            SET auto_patente = NULL, auto_marca = NULL, auto_modelo = NULL, auto_color = NULL 
            WHERE id_visita = ?
        `;
        
        await db.query(query, [idVisita]);
        res.json({ success: true, message: 'Vehículo removido correctamente' });

    } catch (error) {
        console.error('💥 Error al quitar vehículo:', error);
        res.status(500).json({ success: false, message: 'Error interno al quitar el auto' });
    }
};


// Asignar un vehículo a una visita que venía a pie
exports.asignarVehiculo = async (req, res) => {
    try {
        const idVisita = req.params.id;
        const { patente, marca, modelo, color } = req.body;

        const query = 'CALL sp_asignar_vehiculo(?, ?, ?, ?, ?)';
        await db.query(query, [idVisita, patente, marca, modelo, color]);

        res.json({ success: true, message: 'Vehículo registrado con éxito' });

    } catch (error) {
        console.error('💥 Error al asignar vehículo:', error);
        res.status(500).json({ success: false, message: 'Error interno al registrar el vehículo' });
    }
};


