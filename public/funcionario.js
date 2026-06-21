

// ==========================================
// 1. INICIALIZACIÓN Y SEGURIDAD AL CARGAR
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    

    const savedUser = sessionStorage.getItem('user');
    if (!savedUser) { window.location.href = '/'; return; }

    const user = JSON.parse(savedUser);
    if (user.rol.toLowerCase() !== 'funcionario') {
        alert('No tienes permisos');
        window.location.href = '/';
        return;
    }

    const idUsuario = user.id_usuario || user.id;
    const idUnidad = user.id_unidad;

    // Cargar datos dinámicos en el header
    document.getElementById('nombre-funcionario').innerText = `Hola, ${user.nombre}`;
    document.getElementById('nombre-unidad').innerText = user.unidad || 'Sin Unidad';
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('user');
        window.location.href = '/';
    });

    // OBTENER FECHAS CON EVENTOS DESDE EL BACKEND
    let fechasDestacadas = [];
    try {
        const resFechas = await fetch(`/api/funcionario/fechas-con-eventos?unidad=${idUnidad}`);
        const resultFechas = await resFechas.json();
        if (resultFechas.success) {
            fechasDestacadas = resultFechas.data;
        }
    } catch (error) {
        console.error("No se pudieron cargar las marcas del calendario", error);
    }

    // INICIALIZAR CALENDARIO FLATPICKR
    flatpickr("#calendario-eventos", {
        inline: true,
        locale: "es",
        defaultDate: "today",
        
        // Se ejecuta por cada cuadrito de día que dibuja el calendario
        onDayCreate: function(dObj, dStr, fp, dayElem) {
            // Formateamos la fecha del cuadrito a YYYY-MM-DD
            const fechaCuadro = fp.formatDate(dayElem.dateObj, "Y-m-d");
            
            // Si esa fecha está en nuestra lista de eventos, le ponemos el puntito verde
            if (fechasDestacadas.includes(fechaCuadro)) {
                dayElem.classList.add("dia-con-evento");
            }
        },
        
        onChange: function(selectedDates, dateStr, instance) {
            cargarMetricas(idUsuario, dateStr);
            cargarMisEventos(idUsuario, dateStr);
        }
    });

    // Iniciar la carga de datos de la tabla para hoy
    const hoy = new Date().toISOString().split('T')[0];
    cargarMetricas(idUsuario, hoy);
    cargarMisEventos(idUsuario, hoy);
    // Cargar la lista de colegas para el modal
    cargarColegasParaInvitacion(idUsuario);
});


// ==========================================
// 2. CONEXIONES A LA BASE DE DATOS (API)
// ==========================================

async function cargarColegasParaInvitacion(miIdUsuario) {
    const contenedor = document.getElementById('contenedor-coanfitriones');
    try {
        const respuesta = await fetch(`/api/funcionario/colegas?excluir_id=${miIdUsuario}`);
        const result = await respuesta.json();
        
        contenedor.innerHTML = ''; // Limpiamos el mensaje de "Cargando..."
        
        if (result.success && result.data.length > 0) {
            result.data.forEach(colega => {
                // Dibujamos un checkbox estilizado de Bootstrap por cada colega
                contenedor.innerHTML += `
                    <div class="form-check mb-1 border-bottom pb-1">
                        <input class="form-check-input coanfitrion-checkbox cursor-pointer" type="checkbox" value="${colega.id_usuario}" id="colega_${colega.id_usuario}">
                        <label class="form-check-label small cursor-pointer w-100" for="colega_${colega.id_usuario}">
                            <strong>${colega.nombre_completo}</strong> <span class="text-muted">(${colega.unidad})</span>
                        </label>
                    </div>
                `;
            });
        } else {
            contenedor.innerHTML = '<div class="text-muted small text-center my-2">No hay otros funcionarios en el sistema.</div>';
        }
    } catch (error) {
        console.error("Error cargando colegas:", error);
        contenedor.innerHTML = '<div class="text-danger small text-center my-2">Error al cargar la lista.</div>';
    }
}

async function cargarMetricas(idUsuario, fecha) {
    const user = JSON.parse(sessionStorage.getItem('user'));
    
    try {
        const respuesta = await fetch(`/api/funcionario/metricas?unidad=${user.id_unidad}&fecha=${fecha}`);
        const result = await respuesta.json();
        
        if (result.success) {
            const data = result.data;
            const programadas = data.programadas || 0;
            const ingresos = data.ingresos || 0;
            
            // Calculamos el porcentaje
            let tasa = 0;
            if (programadas > 0) {
                tasa = Math.round((ingresos / programadas) * 100);
            }

            document.getElementById('metric-programadas').innerText = programadas;
            document.getElementById('metric-ingresos').innerText = ingresos;
            document.getElementById('metric-tasa').innerText = tasa + '%';
        }
    } catch (error) {
        console.error("Error al cargar métricas:", error);
    }
}

async function cargarMisEventos(idUsuario, fecha) {
    const user = JSON.parse(sessionStorage.getItem('user'));
    const tbody = document.getElementById('cuerpo-tabla-eventos');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Buscando eventos...</td></tr>';
    
    try {
        const respuesta = await fetch(`/api/funcionario/eventos?unidad=${user.id_unidad}&fecha=${fecha}`);
        const result = await respuesta.json();

        if (result.success && result.data.length > 0) {
            tbody.innerHTML = ''; // Limpiamos la tabla
            
            result.data.forEach(visita => {
                // Formateamos la hora (Ej: de "14:00:00" a "14:00")
                const horaLimpia = visita.hora_visita.substring(0, 5);
                
                // Le damos colores bonitos a los estados
                let colorEstado = 'bg-secondary';
                if (visita.estado_visita === 'PROGRAMADA') colorEstado = 'bg-primary';
                if (visita.estado_visita === 'INGRESO_REGISTRADO') colorEstado = 'bg-success';
                if (visita.estado_visita === 'NO_ASISTIO') colorEstado = 'bg-danger';

                tbody.innerHTML += `
                    <tr>
                        <td class="fw-bold">${horaLimpia}</td>
                        <td>${visita.visitante}</td>
                        <td>${visita.motivo}</td>
                        <td><span class="badge ${colorEstado}">${visita.estado_visita.replace('_', ' ')}</span></td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No hay visitas programadas para el ${fecha}.</td></tr>`;
        }

    } catch (error) {
        console.error("Error al cargar la tabla:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error de conexión.</td></tr>';
    }
}

// ==========================================
// 3. LÓGICA DEL FORMULARIO DE NUEVO EVENTO
// ==========================================

let invitadosNuevos = [];

function abrirModalCrearEvento() {
    invitadosNuevos = [];
    dibujarListaInvitados();
    document.getElementById('form-nuevo-evento').reset();
    const modal = new bootstrap.Modal(document.getElementById('modalCrearEvento'));
    modal.show();
}

function cambiarTipoId() {
    const tipo = document.getElementById('inv-tipo-id').value;
    const inputRut = document.getElementById('inv-rut');
    
    if (tipo === 'PASAPORTE') {
        inputRut.placeholder = 'Número de Pasaporte';
        inputRut.oninput = null;
        document.getElementById('error-rut').classList.add('d-none');
    } else {
        inputRut.placeholder = '12345678-9';
        inputRut.oninput = function() { formatearInputRUT(this) };
    }
}

function agregarInvitadoALista() {
    const tipo = document.getElementById('inv-tipo-id').value;
    const identificacion = document.getElementById('inv-rut').value.trim();
    const nombre = document.getElementById('inv-nombre').value.trim();

    if (!identificacion || !nombre) {
        alert("Debes ingresar la identificación y el nombre.");
        return;
    }

    if (tipo === 'RUT' && !validarRUT(identificacion)) {
        document.getElementById('error-rut').classList.remove('d-none');
        return;
    }
    document.getElementById('error-rut').classList.add('d-none');

    if (invitadosNuevos.some(inv => inv.identificacion === identificacion)) {
        alert("Este visitante ya está en la lista.");
        return;
    }

    invitadosNuevos.push({
        tipo: tipo,
        identificacion: identificacion.toUpperCase(),
        nombre: nombre
    });

    document.getElementById('inv-rut').value = '';
    document.getElementById('inv-nombre').value = '';
    dibujarListaInvitados();
}

function dibujarListaInvitados() {
    const tbody = document.getElementById('lista-invitados-html');
    tbody.innerHTML = '';

    if (invitadosNuevos.length === 0) {
        tbody.innerHTML = '<tr id="fila-vacia"><td colspan="3" class="text-center text-muted small">No hay invitados agregados aún.</td></tr>';
        return;
    }

    invitadosNuevos.forEach((inv, index) => {
        tbody.innerHTML += `
            <tr class="text-center small">
                <td>${inv.identificacion} <span class="badge bg-secondary ms-1">${inv.tipo}</span></td>
                <td>${inv.nombre}</td>
                <td>
                    <button type="button" class="btn btn-outline-danger btn-sm py-0 px-2" onclick="quitarInvitado(${index})">X</button>
                </td>
            </tr>
        `;
    });
}

function quitarInvitado(index) {
    invitadosNuevos.splice(index, 1);
    dibujarListaInvitados();
}

async function guardarEventoCompleto() {
    if (invitadosNuevos.length === 0) {
        alert("Debes agregar al menos un invitado al evento.");
        return;
    }
    
    const motivo = document.getElementById('ev-motivo').value;
    const fecha = document.getElementById('ev-fecha').value;
    const hora = document.getElementById('ev-hora').value;

    if (!motivo || !fecha || !hora) {
        alert("Faltan los detalles principales del evento (Motivo, Fecha u Hora).");
        return;
    }

    const user = JSON.parse(sessionStorage.getItem('user'));
    const idUsuario = user.id_usuario || user.id;
    // Atrapamos solo los checkboxes que el usuario dejó marcados
    const checkboxes = document.querySelectorAll('.coanfitrion-checkbox:checked');
    const colegasSeleccionados = Array.from(checkboxes).map(cb => cb.value);

    const paqueteEvento = {
        motivo: motivo,
        fecha: fecha,
        hora: hora,
        id_anfitrion: idUsuario,
        id_unidad: user.id_unidad,
        invitados: invitadosNuevos,
        coanfitriones: colegasSeleccionados
    };

    try {
        const respuesta = await fetch('/api/funcionario/crear-evento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paqueteEvento)
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            alert('¡Evento creado y enviado a portería exitosamente!');
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCrearEvento'));
            modal.hide();
            
            // Recargamos la tabla con la fecha seleccionada en el evento nuevo
            cargarMisEventos(idUsuario, fecha);
        } else {
            alert('Error al guardar: ' + resultado.message);
        }
    } catch (error) {
        console.error('Error al guardar evento:', error);
        alert('Hubo un problema de conexión con el servidor.');
    }
}

// ==========================================
// 4. HERRAMIENTAS DE VALIDACIÓN DE RUT
// ==========================================

function validarRUT(rutCompleto) {
    if (!/^[0-9]+[-|‐]{1}[0-9kK]{1}$/.test(rutCompleto)) return false;
    
    const tmp = rutCompleto.split('-');
    let digv = tmp[1].toLowerCase(); 
    const rut = tmp[0];
    
    if (digv === 'k') digv = 'k';
    
    return calcularDigitoVerificador(rut) == digv;
}

function calcularDigitoVerificador(rut) {
    let M = 0, S = 1;
    for (; rut; rut = Math.floor(rut / 10)) {
        S = (S + rut % 10 * (9 - M++ % 6)) % 11;
    }
    return S ? S - 1 : 'k';
}

function formatearInputRUT(input) {
    let valor = input.value.replace(/[^0-9kK]/g, '');
    if (valor.length > 1) {
        valor = valor.slice(0, -1) + '-' + valor.slice(-1);
    }
    input.value = valor;
}

