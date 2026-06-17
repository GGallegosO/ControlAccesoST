const db = require('../config/database');
const bcrypt = require('bcryptjs');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
    }

    try {
        const query = `
            SELECT u.id_usuario, u.username, u.password_hash, u.nombre_completo, 
                r.nombre as rol, u.id_unidad
            FROM USUARIO u
            JOIN ROL r ON u.id_rol = r.id_rol
            WHERE u.username = ?
        `;

        // Ahora db.query devuelve una promesa directamente
        const results = await db.query(query, [username]);

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const user = results[0];

        // Validación segura con bcrypt
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        res.json({
            success: true,
            message: 'Login exitoso',
            user: {
                id: user.id_usuario,
                nombre: user.nombre_completo,
                username: user.username,
                rol: user.rol.toLowerCase(), // Aseguramos minúsculas para el frontend
                id_unidad: user.id_unidad
            }
        });

    } catch (error) {
        console.error('💥 Error crítico en login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor',
            error: error.message 
        });
    }
};