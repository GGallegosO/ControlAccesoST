const db = require('../config/database');
const bcrypt = require('bcryptjs');


// ==========================================
// 1. DASHBOARD GLOBAL
// ==========================================
exports.getDashboardMetrics = async (req, res) => {
    try {
        // 1. Total de hoy
        const qHoy = "SELECT COUNT(*) as total FROM VISITA WHERE fecha_visita = CURDATE()";
        
        // 2. Total del mes actual
        const qMes = "SELECT COUNT(*) as total FROM VISITA WHERE MONTH(fecha_visita) = MONTH(CURDATE()) AND YEAR(fecha_visita) = YEAR(CURDATE())";
        
        // 3. Efectividad (Para calcular cuántos realmente ingresaron este mes)
        const qEfectividad = "SELECT estado_visita, COUNT(*) as cantidad FROM VISITA WHERE MONTH(fecha_visita) = MONTH(CURDATE()) AND YEAR(fecha_visita) = YEAR(CURDATE()) GROUP BY estado_visita";
        
        // 4. Unidad más visitada del mes
        const qTop = `
            SELECT u.nombre, COUNT(v.id_visita) as total 
            FROM VISITA v 
            JOIN UNIDAD u ON v.id_unidad = u.id_unidad 
            WHERE MONTH(v.fecha_visita) = MONTH(CURDATE()) 
            GROUP BY u.id_unidad 
            ORDER BY total DESC LIMIT 1
        `;

        const [resHoy, resMes, resEfect, resTop] = await Promise.all([
            db.query(qHoy), db.query(qMes), db.query(qEfectividad), db.query(qTop)
        ]);

        // Cálculo de porcentaje de efectividad
        const totalMes = resMes[0]?.total || 0;
        let ingresadas = 0;
        resEfect.forEach(row => {
            if(row.estado_visita === 'INGRESO_REGISTRADO') ingresadas = row.cantidad;
        });
        const porcentajeEfectividad = totalMes > 0 ? Math.round((ingresadas / totalMes) * 100) : 0;

        res.json({ 
            success: true, 
            data: {
                visitasHoy: resHoy[0]?.total || 0,
                visitasMes: totalMes,
                efectividad: porcentajeEfectividad,
                topUnidad: resTop[0] ? resTop[0].nombre : 'Sin datos',
                topUnidadTotal: resTop[0] ? resTop[0].total : 0
            } 
        });
    } catch (error) {
        console.error('Error en métricas:', error);
        res.status(500).json({ success: false, message: 'Error al cargar el dashboard' });
    }
};


// ==========================================
// 2. REPORTES DE VISITAS
// ==========================================
exports.getReportes = async (req, res) => {
    try {
        const { unidad, fechaDesde, fechaHasta } = req.query;
        
        // ¡Aquí está la magia! Agregamos el JOIN a la tabla VISITANTE (vis)
        let query = `
            SELECT 
                DATE_FORMAT(v.fecha_visita, '%d-%m-%Y') as fecha,
                v.hora_visita as hora,
                vis.nombre_completo as visitante,
                u.nombre as unidad_destino,
                v.estado_visita as estado
            FROM VISITA v
            JOIN VISITANTE vis ON v.id_visitante = vis.id_visitante
            LEFT JOIN UNIDAD u ON v.id_unidad = u.id_unidad
            WHERE v.fecha_visita >= ? AND v.fecha_visita <= ?
        `;
        const queryParams = [fechaDesde, fechaHasta];

        if (unidad && unidad !== 'todas') {
            query += ' AND v.id_unidad = ?';
            queryParams.push(unidad);
        }
        query += ' ORDER BY v.fecha_visita DESC, v.hora_visita DESC';

        const reportes = await db.query(query, queryParams);
        res.json({ success: true, data: reportes });
    } catch (error) {
        console.error('Error en reporte:', error);
        res.status(500).json({ success: false, message: 'Error interno en la base de datos' });
    }
};

// ==========================================
// 3. CRUD UNIDADES
// ==========================================
exports.getUnidades = async (req, res) => {
    try {
        const unidades = await db.query('SELECT id_unidad, nombre FROM UNIDAD ORDER BY nombre ASC');
        res.json({ success: true, data: unidades });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener unidades' });
    }
};

exports.crearUnidad = async (req, res) => {
    try {
        const { nombre } = req.body;
        await db.query('INSERT INTO UNIDAD (nombre) VALUES (?)', [nombre]);
        res.json({ success: true, message: 'Unidad creada' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al crear unidad' });
    }
};

exports.actualizarUnidad = async (req, res) => {
    try {
        const { nombre } = req.body;
        await db.query('UPDATE UNIDAD SET nombre = ? WHERE id_unidad = ?', [nombre, req.params.id]);
        res.json({ success: true, message: 'Unidad actualizada' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar unidad' });
    }
};

exports.eliminarUnidad = async (req, res) => {
    try {
        await db.query('DELETE FROM UNIDAD WHERE id_unidad = ?', [req.params.id]);
        res.json({ success: true, message: 'Unidad eliminada' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar. Puede tener usuarios asignados.' });
    }
};

// ==========================================
// 4. CRUD USUARIOS
// ==========================================
exports.getUsuarios = async (req, res) => {
    try {
        const query = `
            SELECT u.id_usuario, u.nombre_completo, u.username, r.id_rol, r.nombre as rol, un.id_unidad, un.nombre as unidad
            FROM USUARIO u
            JOIN ROL r ON u.id_rol = r.id_rol
            LEFT JOIN UNIDAD un ON u.id_unidad = un.id_unidad
            ORDER BY u.nombre_completo ASC
        `;
        const usuarios = await db.query(query);
        res.json({ success: true, data: usuarios });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener usuarios' });
    }
};

exports.crearUsuario = async (req, res) => {
    try {
        const { nombre, username, password, rol_id, unidad_id } = req.body;
        const hash = await bcrypt.hash(password, 10);
        const uId = unidad_id === 'null' ? null : unidad_id;
        
        await db.query('INSERT INTO USUARIO (nombre_completo, username, password_hash, id_rol, id_unidad) VALUES (?, ?, ?, ?, ?)', 
        [nombre, username, hash, rol_id, uId]);
        res.json({ success: true, message: 'Usuario creado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al crear usuario' });
    }
};

exports.actualizarUsuario = async (req, res) => {
    try {
        const { nombre, username, password, rol_id, unidad_id } = req.body;
        const uId = unidad_id === 'null' ? null : unidad_id;

        if (password && password.trim() !== '') {
            const hash = await bcrypt.hash(password, 10);
            await db.query('UPDATE USUARIO SET nombre_completo=?, username=?, password_hash=?, id_rol=?, id_unidad=? WHERE id_usuario=?', 
            [nombre, username, hash, rol_id, uId, req.params.id]);
        } else {
            await db.query('UPDATE USUARIO SET nombre_completo=?, username=?, id_rol=?, id_unidad=? WHERE id_usuario=?', 
            [nombre, username, rol_id, uId, req.params.id]);
        }
        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
    }
};

exports.eliminarUsuario = async (req, res) => {
    try {
        await db.query('DELETE FROM USUARIO WHERE id_usuario = ?', [req.params.id]);
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
    }
};