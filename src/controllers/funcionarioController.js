const db = require('../config/database'); 
const { validarRut, formatearRut } = require('../utils/validador'); 

exports.crearEvento = async (req, res) => {
    try {
        const { motivo, fecha, hora, id_anfitrion, id_unidad, invitados, coanfitriones } = req.body;

        // =======================================================
        // CAPA DE VALIDACIÓN PREVIA (SEGURIDAD Y FORMATO)
        // =======================================================
        // Revisamos a todos los invitados antes de tocar la base de datos
        for (let inv of invitados) {
            if (inv.tipo === 'RUT') {
                if (!validarRut(inv.identificacion)) {
                    // Si el RUT es inválido, abortamos todo y avisamos al funcionario
                    return res.status(400).json({ 
                        success: false, 
                        message: `Error: El RUT ingresado para ${inv.nombre} (${inv.identificacion}) no es válido.` 
                    });
                }
                // Si es válido, lo formateamos bonito (ej: 19.876.543-2) para guardarlo estándar
                inv.identificacion = formatearRut(inv.identificacion);
            }
        }
        // =======================================================

        // Iteramos sobre cada invitado que viene en el arreglo para guardarlos
        for (let inv of invitados) {
            
            let idVisitante = null;

            // BUSCAR O CREAR AL VISITANTE
            const queryBuscar = 'SELECT id_visitante FROM VISITANTE WHERE tipo_documento = ? AND numero_documento = ?';
            const visitanteExistente = await db.query(queryBuscar, [inv.tipo, inv.identificacion]);

            if (visitanteExistente.length > 0) {
                idVisitante = visitanteExistente[0].id_visitante;
            } else {
                const queryInsertarVisitante = `
                    INSERT INTO VISITANTE (tipo_documento, numero_documento, nombre_completo) 
                    VALUES (?, ?, ?)
                `;
                const nuevoVisitante = await db.query(queryInsertarVisitante, [inv.tipo, inv.identificacion, inv.nombre]);
                idVisitante = nuevoVisitante.insertId;
            }

            // CREAR LA VISITA (EL EVENTO)
            const queryInsertarVisita = `
                INSERT INTO VISITA 
                (id_visitante, id_anfitrion_principal, id_unidad, descripcion, fecha_visita, hora_visita, estado_visita) 
                VALUES (?, ?, ?, ?, ?, ?, 'PROGRAMADA')
            `;
            
            const resultadoVisita = await db.query(queryInsertarVisita, [
                idVisitante, 
                id_anfitrion, 
                id_unidad, 
                motivo, 
                fecha, 
                hora
            ]);

            const idNuevaVisita = resultadoVisita.insertId;

            // VINCULAR A LOS CO-ANFITRIONES
            if (coanfitriones && coanfitriones.length > 0) {
                for (let idColega of coanfitriones) {
                    await db.query(
                        'INSERT INTO VISITA_ANFITRION (id_visita, id_usuario) VALUES (?, ?)', 
                        [idNuevaVisita, idColega]
                    );
                }
            }
        }
        res.json({ success: true, message: 'Evento y visitantes registrados correctamente' });

    } catch (error) {
        console.error('💥 Error al crear evento:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al crear evento' });
    }
};

exports.obtenerEventos = async (req, res) => {
    try {
        const { unidad, fecha, id_usuario } = req.query; 
        
        const query = `
            SELECT v.id_visita, v.id_unidad, v.hora_visita, vi.nombre_completo AS visitante, v.descripcion AS motivo, v.estado_visita,
                GROUP_CONCAT(u.nombre_completo SEPARATOR ', ') AS coanfitriones_nombres,
                GROUP_CONCAT(u.id_usuario SEPARATOR ',') AS coanfitriones_ids
            FROM VISITA v
            JOIN VISITANTE vi ON v.id_visitante = vi.id_visitante
            LEFT JOIN VISITA_ANFITRION va ON v.id_visita = va.id_visita
            LEFT JOIN USUARIO u ON va.id_usuario = u.id_usuario
            WHERE (v.id_unidad = ? OR v.id_visita IN (SELECT id_visita FROM VISITA_ANFITRION WHERE id_usuario = ?)) 
            AND v.fecha_visita = ?
            GROUP BY v.id_visita, v.id_unidad, v.hora_visita, vi.nombre_completo, v.descripcion, v.estado_visita
            ORDER BY v.hora_visita ASC
        `;
        
        const visitas = await db.query(query, [unidad, id_usuario, fecha]);
        res.json({ success: true, data: visitas });
    } catch (error) {
        console.error('Error al obtener eventos:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
};

exports.obtenerMetricas = async (req, res) => {
    try {
        const { unidad, fecha, id_usuario } = req.query; 
        
        const query = `
            SELECT 
                COUNT(*) as programadas,
                COALESCE(SUM(CASE WHEN estado_visita = 'INGRESO_REGISTRADO' THEN 1 ELSE 0 END), 0) as ingresos
            FROM VISITA v
            WHERE (v.id_unidad = ? OR v.id_visita IN (SELECT id_visita FROM VISITA_ANFITRION WHERE id_usuario = ?))
            AND v.fecha_visita = ?
        `;
        
        const resultados = await db.query(query, [unidad, id_usuario, fecha]);
        res.json({ success: true, data: resultados[0] });
    } catch (error) {
        console.error('Error al obtener métricas:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
};

exports.obtenerFechasEventos = async (req, res) => {
    try {
        const { unidad, id_usuario } = req.query; 
        
        const query = `
            SELECT DISTINCT DATE_FORMAT(fecha_visita, '%Y-%m-%d') as fecha 
            FROM VISITA v
            WHERE (v.id_unidad = ? OR v.id_visita IN (SELECT id_visita FROM VISITA_ANFITRION WHERE id_usuario = ?))
            AND v.estado_visita != 'CANCELADA'
        `;
        
        const fechas = await db.query(query, [unidad, id_usuario]);
        const arrayFechas = fechas.map(f => f.fecha);
        
        res.json({ success: true, data: arrayFechas });
    } catch (error) {
        console.error('Error al obtener fechas:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
};

exports.obtenerColegas = async (req, res) => {
    try {
        const { excluir_id } = req.query;
        const query = `
            SELECT u.id_usuario, u.nombre_completo, un.nombre as unidad 
            FROM USUARIO u
            JOIN UNIDAD un ON u.id_unidad = un.id_unidad
            WHERE u.id_rol = 2 AND u.id_usuario != ?
        `;
        const colegas = await db.query(query, [excluir_id]);
        res.json({ success: true, data: colegas });
    } catch (error) {
        console.error('Error al obtener colegas:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
};

exports.agregarCoanfitrionesExtra = async (req, res) => {
    try {
        const { id_visita_referencia, coanfitriones } = req.body;

        const queryReferencia = 'SELECT id_unidad, fecha_visita, hora_visita, descripcion FROM VISITA WHERE id_visita = ?';
        const refResult = await db.query(queryReferencia, [id_visita_referencia]);
        if (refResult.length === 0) return res.status(404).json({ success: false, message: 'Evento no encontrado' });
        const ref = refResult[0];

        const queryVisitas = 'SELECT id_visita FROM VISITA WHERE id_unidad = ? AND fecha_visita = ? AND hora_visita = ? AND descripcion = ?';
        const visitas = await db.query(queryVisitas, [ref.id_unidad, ref.fecha_visita, ref.hora_visita, ref.descripcion]);

        if (visitas.length > 0) {
            const idsVisitas = visitas.map(v => v.id_visita);
            await db.query('DELETE FROM VISITA_ANFITRION WHERE id_visita IN (?)', [idsVisitas]); 

            if (coanfitriones && coanfitriones.length > 0) {
                for (let idVisita of idsVisitas) {
                    for (let idColega of coanfitriones) {
                        await db.query('INSERT INTO VISITA_ANFITRION (id_visita, id_usuario) VALUES (?, ?)', [idVisita, idColega]);
                    }
                }
            }
        }
        res.json({ success: true, message: 'Colegas actualizados exitosamente' });

    } catch (error) {
        console.error('Error al actualizar:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
};

exports.cancelarVisita = async (req, res) => {
    try {
        const { id_visita } = req.params;
        
        const query = "UPDATE VISITA SET estado_visita = 'CANCELADA' WHERE id_visita = ?";
        await db.query(query, [id_visita]);
        
        res.json({ success: true, message: 'Visita cancelada exitosamente' });
    } catch (error) {
        console.error('Error al cancelar visita:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
};