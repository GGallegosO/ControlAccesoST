const mysql = require('mysql2/promise'); 
require('dotenv').config();

let pool;

async function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        try {
            const connection = await pool.getConnection();
            console.log('✅ Conectado exitosamente a MySQL (ControlAccesoST)');
            connection.release();
        } catch (err) {
            console.error('❌ Error conectando a la base de datos:', err.message);
        }
    }
    return pool;
}

// Exportamos una función query que usa el pool
module.exports = {
    query: async (sql, params) => {
        const db = await getPool();
        const [results] = await db.query(sql, params);
        return results;
    }
};