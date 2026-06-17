const db = require('../config/database');

class UsuarioModel {
    // Buscar usuario por username (email)
    static async findByUsername(username) {
        const sql = `
            SELECT u.id_usuario, u.nombre_completo, u.username, u.password_hash, 
                   r.nombre as rol, u.id_unidad, un.nombre as unidad_nombre
            FROM USUARIO u
            INNER JOIN ROL r ON u.id_rol = r.id_rol
            LEFT JOIN UNIDAD un ON u.id_unidad = un.id_unidad
            WHERE u.username = ?
        `;
        
        return new Promise((resolve, reject) => {
            db.query(sql, [username], (err, results) => {
                if (err) reject(err);
                resolve(results[0] || null); // Retorna el primer resultado o null
            });
        });
    }
}

module.exports = UsuarioModel;