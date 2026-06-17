document.addEventListener('DOMContentLoaded', () => {
    // 1. VERIFICACIÓN DE SEGURIDAD (Proteger la página)
    const savedUser = sessionStorage.getItem('user');
    
    if (!savedUser) {
        // Si no hay sesión, patada de vuelta al login
        window.location.href = '/';
        return;
    }

    const user = JSON.parse(savedUser);
    
    if (user.rol.toLowerCase() !== 'guardia') {
        // Si es un funcionario tratando de entrar al panel del guardia
        alert('No tienes permisos para ver esta página');
        window.location.href = '/';
        return;
    }

    // 2. CONFIGURACIÓN INICIAL
    document.getElementById('nombre-guardia').innerText = `Hola, ${user.nombre}`;
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('user');
        window.location.href = '/';
    });

    // 3. CARGAR LOS DATOS
    cargarVisitasHoy();
});

async function cargarVisitasHoy() {
    try {
        const respuesta = await fetch('/api/visitas/guardia/hoy');
        const resultado = await respuesta.json();
        const tbody = document.getElementById('cuerpo-tabla-visitas');
        
        tbody.innerHTML = '';

        if (!resultado.data || resultado.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay visitas programadas para hoy.</td></tr>';
            return;
        }

        resultado.data.forEach(visita => {
            const infoVehiculo = visita.auto_patente 
                ? `🚗 ${visita.auto_marca} (${visita.auto_patente})` 
                : '🚶 A pie';

            // Definimos el color del badge
            let badgeClass = 'bg-secondary';
            if (visita.estado_visita === 'PROGRAMADA') badgeClass = 'bg-primary';
            if (visita.estado_visita === 'INGRESO_REGISTRADO') badgeClass = 'bg-success';

            // Lógica del botón: Solo aparece si está 'PROGRAMADA'
            let botonAccion = '';
            if (visita.estado_visita === 'PROGRAMADA') {
                botonAccion = `<button class="btn btn-sm btn-success shadow-sm" onclick="marcarIngreso(${visita.id_visita})">✅ Dar Ingreso</button>`;
            } else {
                botonAccion = `<span class="text-muted small">Sin acciones</span>`;
            }

            const fila = `
                <tr>
                    <td><strong>${visita.hora_visita}</strong></td>
                    <td>${visita.visitante}</td>
                    <td>${visita.rut_pasaporte}</td>
                    <td>${visita.funcionario_anfitrion}</td>
                    <td>${visita.unidad}</td>
                    <td>${infoVehiculo}</td>
                    <td><span class="badge ${badgeClass}">${visita.estado_visita}</span></td>
                    <td class="text-center">${botonAccion}</td>
                </tr>
            `;
            tbody.innerHTML += fila;
        });

    } catch (error) {
        console.error('Error al cargar la tabla:', error);
        document.getElementById('cuerpo-tabla-visitas').innerHTML = 
            '<tr><td colspan="7" class="text-center text-danger">Error al conectar con el servidor.</td></tr>';
    }
}

// Función para registrar el ingreso
async function marcarIngreso(idVisita) {
    // Le pedimos confirmación al guardia por seguridad
    if (!confirm('¿Confirmar el ingreso de este visitante?')) {
        return; 
    }

    // Obtenemos el ID del guardia desde la sesión para saber quién autorizó
    const user = JSON.parse(sessionStorage.getItem('user'));

    try {
        const respuesta = await fetch(`/api/visitas/ingreso/${idVisita}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id_usuario: user.id_usuario }) // Enviamos quién es el guardia
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            // Recargamos la tabla para ver el cambio a INGRESO_REGISTRADO en vivo
            cargarVisitasHoy();
        } else {
            alert('Error: ' + resultado.message);
        }

    } catch (error) {
        console.error('Error al registrar ingreso:', error);
        alert('Hubo un problema de conexión al registrar el ingreso.');
    }
}