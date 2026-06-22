const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos' });
    }

    try {
        const query = `
            SELECT u.id_usuario, u.username, u.password_hash, u.nombre_completo, 
                r.nombre as rol, u.id_unidad, un.nombre as unidad_nombre
            FROM USUARIO u
            JOIN ROL r ON u.id_rol = r.id_rol
            LEFT JOIN UNIDAD un ON u.id_unidad = un.id_unidad
            WHERE u.username = ?
        `;

        const results = await db.query(query, [username]);

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const user = results[0];
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        // ==========================================
        // CREACIÓN DEL TOKEN JWT
        // ==========================================
        const tokenPayload = {
            id: user.id_usuario,
            rol: user.rol.toLowerCase()
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: '8h' 
        });

        res.json({
            success: true,
            message: 'Login exitoso',
            token: token, // El token ya va directo al frontend
            user: {
                id: user.id_usuario,
                nombre: user.nombre_completo,
                username: user.username,
                rol: user.rol.toLowerCase(), 
                id_unidad: user.id_unidad,
                unidad: user.unidad_nombre 
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