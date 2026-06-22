const cron = require('node-cron');
const db = require('../config/database'); // Asegúrate de que la ruta a tu BD sea correcta

// Formato Cron: '59 23 * * *' significa "Todos los días a las 23:59 hrs"
cron.schedule('59 23 * * *', async () => {
    try {
        console.log('⏳ [CRON] Ejecutando barrido automático de inasistencias...');
        
        
        const query = `
            UPDATE VISITA 
            SET estado_visita = 'NO_ASISTIO' 
            WHERE estado_visita = 'PROGRAMADA' 
            AND fecha_visita <= CURDATE()
        `;
        
        const result = await db.query(query);
        
        console.log(`✅ [CRON] Barrido completado: ${result.affectedRows} visitas marcadas como NO_ASISTIO.`);
    } catch (error) {
        console.error('💥 [CRON] Error en la tarea programada:', error);
    }
});

console.log('⏱️  Motor de tareas programadas (Cron) iniciado correctamente.');