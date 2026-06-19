let visitasDelDia = []; 
let idVisitaAsignandoAuto = null;
// Variables de estado para la agrupación
let modoAgrupacion = false;
let idConductorActual = null;
let idsSeleccionados = [];
let idVisitaViendoAuto = null;

// Variables para Filtro y Orden
let textoBusqueda = '';
let columnaOrden = 'hora_visita'; // Orden por defecto
let ordenAscendente = true;


document.addEventListener('DOMContentLoaded', () => {
    
    // VERIFICACIÓN DE SEGURIDAD (Proteger la página)
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

    // CONFIGURACIÓN INICIAL
    document.getElementById('nombre-guardia').innerText = `Hola, ${user.nombre}`;
    
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('user');
        window.location.href = '/';
    });

    //  CARGAR LOS DATOS
    cargarVisitasHoy();
});


//  Solo descarga los datos de la Base de Datos
async function cargarVisitasHoy() {
    try {
        const respuesta = await fetch('/api/visitas/guardia/hoy');
        const resultado = await respuesta.json();
        
        // Guardamos todo en memoria
        visitasDelDia = resultado.data || []; 
        
        // Llamamos al dibujante
        renderizarTabla();
    } catch (error) {
        console.error('Error al cargar la tabla:', error);
        document.getElementById('cuerpo-tabla-visitas').innerHTML = 
            '<tr><td colspan="8" class="text-center text-danger">Error al conectar con el servidor.</td></tr>';
    }
}

//  Controladores de los eventos en pantalla
function filtrarTabla() {
    textoBusqueda = document.getElementById('input-busqueda').value.toLowerCase();
    renderizarTabla();
}

function ordenarTabla(columna) {
    if (columnaOrden === columna) {
        ordenAscendente = !ordenAscendente; // Invierte el orden si toca la misma columna
    } else {
        columnaOrden = columna;
        ordenAscendente = true; // Orden normal si cambia de columna
    }
    renderizarTabla();
}

// Aplica filtros, orden y pinta el HTML
function renderizarTabla() {
    let datos = [...visitasDelDia]; // Hacemos una copia para no alterar el original

    // --- FILTRAR ---
    if (textoBusqueda) {
        datos = datos.filter(v => {
            // Si estamos agrupando, el conductor siempre se queda visible
            if (modoAgrupacion && v.id_visita === idConductorActual) return true;
            
            // Buscar por nombre o rut
            return v.visitante.toLowerCase().includes(textoBusqueda) || 
                    v.rut_pasaporte.toLowerCase().includes(textoBusqueda);
        });
    }

    // --- ORDENAR ---
    datos.sort((a, b) => {
        let valorA = a[columnaOrden] || '';
        let valorB = b[columnaOrden] || '';
        
        if (typeof valorA === 'string') valorA = valorA.toLowerCase();
        if (typeof valorB === 'string') valorB = valorB.toLowerCase();

        if (valorA < valorB) return ordenAscendente ? -1 : 1;
        if (valorA > valorB) return ordenAscendente ? 1 : -1;
        return 0;
    });

    // --- DIBUJAR HTML ---
    const tbody = document.getElementById('cuerpo-tabla-visitas');
    tbody.innerHTML = '';

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No se encontraron visitantes.</td></tr>';
        return;
    }

    datos.forEach(visita => {
        
        let infoVehiculo = '🚶 A pie';
        if (visita.auto_patente) {
            infoVehiculo = `
                <button class="btn btn-sm btn-light border shadow-sm w-100 text-start" 
                        onclick="abrirModalAuto('${visita.auto_patente}', '${visita.auto_marca}', '${visita.auto_modelo || '-'}', '${visita.auto_color || '-'}', ${visita.id_visita})">
                    🚗 ${visita.auto_marca} <br><small class="text-muted">${visita.auto_patente}</small>
                </button>
            `;
        }

        let badgeClass = 'bg-secondary';
        if (visita.estado_visita === 'PROGRAMADA') badgeClass = 'bg-primary';
        if (visita.estado_visita === 'INGRESO_REGISTRADO') badgeClass = 'bg-success';

        let botonAccion = '';

        if (modoAgrupacion) {
            if (visita.id_visita === idConductorActual) {
                botonAccion = `<span class="badge bg-dark w-100 py-2">Conductor</span>`;
            } else if (visita.estado_visita === 'PROGRAMADA') {
                const checked = idsSeleccionados.includes(visita.id_visita) ? 'checked' : '';
                botonAccion = `
                    <div class="form-check d-flex justify-content-center mt-1">
                        <input class="form-check-input border-secondary" type="checkbox" onchange="toggleSeleccion(${visita.id_visita})" ${checked} style="transform: scale(1.5);">
                    </div>
                `;
            } else {
                botonAccion = `<span class="text-muted small">Ya ingresó</span>`;
            }
        } else {
            if (visita.estado_visita === 'PROGRAMADA') {
                botonAccion = `<button class="btn btn-sm btn-success shadow-sm mb-1 w-100" onclick="marcarIngreso(${visita.id_visita})">✅ Dar Ingreso</button>`;
                if (visita.auto_patente) {
                    botonAccion += `<button class="btn btn-sm btn-info text-white shadow-sm w-100" onclick="iniciarAgrupacion(${visita.id_visita})">👥 Vienen Juntos</button>`;
                } else {
                    botonAccion += `<button class="btn btn-sm btn-secondary shadow-sm w-100" onclick="abrirModalAgregarAuto(${visita.id_visita})">🚘 Vincular Auto</button>`;
                }
            } else if (visita.estado_visita === 'INGRESO_REGISTRADO') {
                botonAccion = `<button class="btn btn-sm btn-outline-danger shadow-sm w-100" onclick="revertirIngreso(${visita.id_visita})">❌ Deshacer</button>`;
            } else {
                botonAccion = `<span class="text-muted small">Sin acciones</span>`;
            }
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
                <td class="text-center align-middle">${botonAccion}</td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
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

// Función para deshacer un ingreso erróneo
async function revertirIngreso(idVisita) {
    if (!confirm('¿Estás seguro de deshacer este ingreso y volver a marcarlo como Programado?')) {
        return; 
    }

    try {
        const respuesta = await fetch(`/api/visitas/revertir/${idVisita}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            cargarVisitasHoy(); // Recargamos la tabla al instante
        } else {
            alert('Error: ' + resultado.message);
        }

    } catch (error) {
        console.error('Error al revertir ingreso:', error);
        alert('Hubo un problema de conexión al revertir el ingreso.');
    }
}

// --- FUNCIONES DE AGRUPACIÓN ---

function iniciarAgrupacion(idConductor) {
    modoAgrupacion = true;
    idConductorActual = idConductor;
    idsSeleccionados = []; // Reiniciamos la lista de seleccionados
    
    // Mostramos el panel azul
    document.getElementById('panel-agrupacion').classList.remove('d-none');
    
    // Recargamos la tabla para que dibuje los checkboxes
    cargarVisitasHoy();
}

function cancelarAgrupacion() {
    modoAgrupacion = false;
    idConductorActual = null;
    idsSeleccionados = [];
    
    // Ocultamos el panel azul
    document.getElementById('panel-agrupacion').classList.add('d-none');
    
    // Recargamos la tabla a su estado normal
    cargarVisitasHoy();
}

function toggleSeleccion(idVisita) {
    // Si ya está, lo quitamos. Si no está, lo agregamos.
    if (idsSeleccionados.includes(idVisita)) {
        idsSeleccionados = idsSeleccionados.filter(id => id !== idVisita);
    } else {
        idsSeleccionados.push(idVisita);
    }
}

async function confirmarIngresoGrupal() {
    if (idsSeleccionados.length === 0) {
        alert('No has seleccionado ningún acompañante.');
        return;
    }

    if (!confirm(`¿Dar ingreso al conductor y a ${idsSeleccionados.length} acompañante(s)?`)) return;

    const user = JSON.parse(sessionStorage.getItem('user'));

    try {
        // Ahora hacemos un solo envío inteligente al backend
        const respuesta = await fetch('/api/visitas/ingreso-grupal', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_conductor: idConductorActual,
                ids_acompanantes: idsSeleccionados,
                id_usuario: user.id_usuario
            })
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            cancelarAgrupacion(); // Esto ya incluye el recargo de la tabla
        } else {
            alert('Error: ' + resultado.message);
        }
    } catch (error) {
        console.error('Error en el ingreso grupal:', error);
        alert('Ocurrió un error de conexión al agrupar.');
    }
}

// --- FUNCIONES DEL MODAL DE VEHÍCULOS ---

function abrirModalAuto(patente, marca, modelo, color, idVisita) {
    idVisitaViendoAuto = idVisita; 
    
    // Llenamos los datos principales del auto
    document.getElementById('detalle-patente').innerText = patente;
    document.getElementById('detalle-marca').innerText = marca;
    document.getElementById('detalle-modelo').innerText = modelo;
    document.getElementById('detalle-color').innerText = color;

    // Buscamos a los ocupantes usando la memoria de Javascript (sin llamar al backend)
    const ocupantes = visitasDelDia.filter(v => v.auto_patente === patente);
    
    // Armamos la lista HTML
    const ulOcupantes = document.getElementById('lista-ocupantes');
    ulOcupantes.innerHTML = ''; // Limpiamos lo que había antes
    
    ocupantes.forEach(oc => {
        // Le ponemos una pequeña marca visual para saber de quién es la fila que tocamos
        const esElSeleccionado = oc.id_visita === idVisita ? ' <span class="badge bg-secondary">Seleccionado</span>' : '';
        ulOcupantes.innerHTML += `<li>${oc.visitante} ${esElSeleccionado}</li>`;
    });

    // Mostramos el modal
    const modal = new bootstrap.Modal(document.getElementById('modalAuto'));
    modal.show();
}

async function confirmarQuitarAuto() {
    if (!confirm('¿Seguro que deseas quitarle el vehículo a esta visita y dejarla "A pie"?')) return;

    try {
        const respuesta = await fetch(`/api/visitas/quitar-auto/${idVisitaViendoAuto}`, {
            method: 'PUT'
        });
        const resultado = await respuesta.json();

        if (resultado.success) {
            // Cerramos el modal
            const modalElement = document.getElementById('modalAuto');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            modalInstance.hide();
            
            // Recargamos la tabla
            cargarVisitasHoy();
        } else {
            alert('Error: ' + resultado.message);
        }
    } catch (error) {
        console.error('Error al quitar auto:', error);
    }
}

// --- FUNCIONES PARA REGISTRAR AUTO AL VUELO ---

function abrirModalAgregarAuto(idVisita) {
    idVisitaAsignandoAuto = idVisita;
    document.getElementById('form-agregar-auto').reset(); // Limpiamos campos anteriores
    const modal = new bootstrap.Modal(document.getElementById('modalAgregarAuto'));
    modal.show();
}

// Escuchar el envío del formulario
document.getElementById('form-agregar-auto').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitamos que la página se recargue

    const datosVehiculo = {
        patente: document.getElementById('add-patente').value,
        marca: document.getElementById('add-marca').value,
        modelo: document.getElementById('add-modelo').value || null,
        color: document.getElementById('add-color').value || null
    };

    try {
        const respuesta = await fetch(`/api/visitas/asignar-auto/${idVisitaAsignandoAuto}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosVehiculo)
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            // Cerramos el modal usando Bootstrap
            const modalElement = document.getElementById('modalAgregarAuto');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            modalInstance.hide();

            // Recargamos la tabla. Ahora la persona aparecerá con el auto asignado
            cargarVisitasHoy();
        } else {
            alert('Error: ' + resultado.message);
        }
    } catch (error) {
        console.error('Error al asignar vehículo:', error);
        alert('Hubo un problema de conexión al guardar el vehículo.');
    }
});