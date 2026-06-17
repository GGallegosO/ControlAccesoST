const db = require('../config/database'); // Nota: modificaremos database.js también o usamos el wrapper aquí
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise'); // <--- IMPORTANTE: Usar la versión promise
const dotenv = require('dotenv');
dotenv.config();

// Creamos una conexión pool compatible con promisas directamente aquí para este controller
// O mejor, ajustamos tu config/database.js para que exporte promesas. 
// Para ser rápidos y no romper otra cosa, crearemos el pool aquí temporalmente o ajustamos la importación.

// MEJOR OPCIÓN: Ajustar la llamada para usar el pool existente pero convertido a promesa si es necesario,
// pero lo más limpio con tu error es usar mysql2/promise directamente para crear la conexión si tu config actual es callback.
// Sin embargo, veamos tu config/database.js. Si usa createPool normal, no tiene .query() directo async/await sin .promise().

// Vamos a reescribir esto asumiendo que tu config/database.js exporta un pool normal (callback).
// La forma correcta de usar await con ese pool es: const [rows] = await pool.execute(query, params); 
// O bien: const connection = await pool.promise().getConnection(); 

// CORRECCIÓN RÁPIDA BASADA EN TU ERROR:
// El error dice "result of query that is not a promise". 
// Tu código tenía: const [results] = await db.query(...)
// Si db es un pool creado con mysql2 (sin /promise), db.query NO retorna una promesa por defecto en versiones antiguas o configuraciones específicas, 
// PERO en mysql2 moderno db.query SÍ debería retornar promesa si se usa bien, O debes usar db.execute.
// El error específico sugiere que tu 'db' no es una promesa.

// SOLUCIÓN DEFINITIVA: Usar 'mysql2/promise' para crear el pool en config/database.js o aquí.
// Vamos a modificar ligeramente este archivo para que funcione independiente de config por ahora, 
// o asumiremos que debes cambiar tu require.

// REESCRITURA COMPLETA DEL ARCHIVO PARA QUE FUNCIONE YA:
const mysqlPromise = require('mysql2/promise');

// Configuración manual rápida para asegurar promesas (puedes mover esto a config luego)
const pool = mysqlPromise.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

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

        // Usamos el pool de promesas
        const [results] = await pool.query(query, [username]);

        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const user = results[0];

        // Validar contraseña (soporta texto plano para pruebas y hash real)
        let isValid = false;
        if (password === user.password_hash) {
            isValid = true; // Para tus datos de prueba actuales
        } else {
            isValid = await bcrypt.compare(password, user.password_hash);
        }

        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        // Éxito
        res.json({
            success: true,
            message: 'Login exitoso',
            user: {
                id: user.id_usuario,
                nombre: user.nombre_completo,
                username: user.username,
                rol: user.rol.toLowerCase(), // 'admin', 'funcionario', 'guardia'
                id_unidad: user.id_unidad
            }
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};