let todosLosEventosDelDia = [];
let pestañaActiva = 'propios';

let columnaOrdenActual = 'hora_visita'; 
let ordenAscendente = true;

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
        const resFechas = await fetch(`/api/funcionario/fechas-con-eventos?unidad=${idUnidad}&id_usuario=${idUsuario}`);
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

    // Iniciar la carga de datos por primera vez (con la fecha de hoy EXACTA local)
    const fechaObj = new Date();
    const año = fechaObj.getFullYear();
    const mes = String(fechaObj.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaObj.getDate()).padStart(2, '0');
    const hoy = `${año}-${mes}-${dia}`; 
    
    cargarMetricas(idUsuario, hoy);
    cargarMisEventos(idUsuario, hoy);

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
                
                contenedor.innerHTML += `
                    <div class="form-check mb-1 border-bottom pb-1 colega-item">
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
        const respuesta = await fetch(`/api/funcionario/metricas?unidad=${user.id_unidad}&fecha=${fecha}&id_usuario=${idUsuario}`);
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
    try {
        const user = JSON.parse(sessionStorage.getItem('user'));
        const respuesta = await fetch(`/api/funcionario/eventos?unidad=${user.id_unidad}&fecha=${fecha}&id_usuario=${idUsuario}`);
        const result = await respuesta.json();

        if (result.success) {
            // Guardamos la respuesta globalmente
            todosLosEventosDelDia = result.data || [];
            // Mandamos a renderizar pasándole la fecha para los botones
            renderizarTablaEventos(fecha); 
        }
    } catch (error) {
        console.error("Error al cargar eventos:", error);
    }
}


function renderizarTablaEventos(fecha) {
    const tbody = document.getElementById('cuerpo-tabla-eventos');
    tbody.innerHTML = ''; // Limpiamos la tabla siempre al inicio

    const userSession = JSON.parse(sessionStorage.getItem('user'));
    const miUnidad = userSession.id_unidad;

    // FILTRADO INTELIGENTE: Filtramos el array global según la pestaña activa
    const eventosFiltrados = todosLosEventosDelDia.filter(visita => {
        if (pestañaActiva === 'propios') {
            return visita.id_unidad === miUnidad; // Mis eventos
        } else {
            return visita.id_unidad !== miUnidad; // Compartidos conmigo
        }
    });

    // Si no hay datos para esta pestaña, cortamos el flujo de inmediato
    if (eventosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay visitas en esta sección.</td></tr>`;
        return;
    }

    //  RENDERIZADO: El bloque exacto que tú ya armaste
    eventosFiltrados.forEach(visita => {
        const horaLimpia = visita.hora_visita.substring(0, 5);
        
        let colorEstado = 'bg-secondary';
        if (visita.estado_visita === 'PROGRAMADA') colorEstado = 'bg-primary';
        if (visita.estado_visita === 'INGRESO_REGISTRADO') colorEstado = 'bg-success';
        if (visita.estado_visita === 'NO_ASISTIO') colorEstado = 'bg-danger';
        if (visita.estado_visita === 'CANCELADA') colorEstado = 'bg-danger';

        let textoCoanfitriones = '-';
        if (visita.coanfitriones_nombres) {
            const listaNombres = visita.coanfitriones_nombres.split(', ');
            if (listaNombres.length > 1) {
                textoCoanfitriones = `${listaNombres[0]} <span class="badge bg-light text-secondary border">+${listaNombres.length - 1}</span>`;
            } else {
                textoCoanfitriones = listaNombres[0];
            }
        }
        
        const idsCo = visita.coanfitriones_ids || '';

        // Lógica de botones condicionada a la pestaña activa
        let btnInvitar = '';
        let btnCancelar = '';
        
        if (pestañaActiva === 'propios') {
            btnInvitar = `<button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="abrirModalExtra('${fecha}', '${visita.hora_visita}', '${visita.motivo}', '${idsCo}', '${visita.id_visita}')" title="Sumar Colegas">👥</button>`;
            
            if (visita.estado_visita === 'PROGRAMADA') {
                btnCancelar = `<button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="cancelarVisita(${visita.id_visita}, '${fecha}')" title="Cancelar Visita">❌</button>`;
            }
        }

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${horaLimpia}</td>
                <td>${visita.visitante}</td>
                <td>${visita.motivo}</td>
                <td class="small text-muted">${textoCoanfitriones}</td>
                <td><span class="badge ${colorEstado}">${visita.estado_visita.replace('_', ' ')}</span></td>
                <td>
                    ${btnInvitar}
                    ${btnCancelar}
                </td>
            </tr>
        `;
    });
}


function aplicarFiltroPestañas(tipo) {
    pestañaActiva = tipo;
    
    const btnPropios = document.getElementById('tab-propios');
    const btnCompartidos = document.getElementById('tab-compartidos');

    if (tipo === 'propios') {
        btnPropios.classList.add('text-success');
        btnPropios.classList.remove('text-secondary', 'bg-light');
        btnCompartidos.classList.add('text-secondary', 'bg-light');
        btnCompartidos.classList.remove('text-success');
    } else {
        btnCompartidos.classList.add('text-success');
        btnCompartidos.classList.remove('text-secondary', 'bg-light');
        btnPropios.classList.add('text-secondary', 'bg-light');
        btnPropios.classList.remove('text-success');
    }

    // Averiguamos qué fecha está seleccionada internamente en el modal oculto para mantener la consistencia
    const fechaActual = document.getElementById('extra-fecha') ? document.getElementById('extra-fecha').value : new Date().toISOString().split('T')[0];
    
    // Redibujamos instantáneamente sin golpear la base de datos de nuevo
    renderizarTablaEventos(fechaActual);
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



// ==========================================
// 5. EDICIÓN RÁPIDA: SUMAR COLEGAS A EVENTO EXISTENTE
// ==========================================

function abrirModalExtra(fecha, hora, motivo, idsCoanfitrionesGuardados) {
    document.getElementById('extra-fecha').value = fecha;
    document.getElementById('extra-hora').value = hora;
    document.getElementById('extra-motivo').value = motivo;

    const contenedorOriginal = document.getElementById('contenedor-coanfitriones').innerHTML;
    const contenedorExtra = document.getElementById('contenedor-coanfitriones-extra');
    
    // Clonamos el HTML y cambiamos ambas clases
    let nuevoHTML = contenedorOriginal.replace(/coanfitrion-checkbox/g, 'coanfitrion-extra-checkbox');
    nuevoHTML = nuevoHTML.replace(/colega-item/g, 'colega-extra-item');
    contenedorExtra.innerHTML = nuevoHTML;

    // Limpiamos la barra de búsqueda por si quedó algo escrito de la vez anterior
    document.getElementById('buscador-extra').value = '';

    // Marcar los que ya están invitados
    if (idsCoanfitrionesGuardados) {
        const idsArray = idsCoanfitrionesGuardados.split(',');
        const checkboxes = document.querySelectorAll('.coanfitrion-extra-checkbox');
        
        checkboxes.forEach(cb => {
            if (idsArray.includes(cb.value)) {
                cb.checked = true;
            }
        });
    }

    const modal = new bootstrap.Modal(document.getElementById('modalAgregarExtra'));
    modal.show();
}




async function guardarCoanfitrionesExtra() {
    // Atrapamos los checks marcados en ESTE modal
    const checkboxes = document.querySelectorAll('.coanfitrion-extra-checkbox:checked');
    const colegasSeleccionados = Array.from(checkboxes).map(cb => cb.value);

    if (colegasSeleccionados.length === 0) {
        alert("Debes seleccionar al menos un colega.");
        return;
    }

    const user = JSON.parse(sessionStorage.getItem('user'));
    
    
    const paqueteExtra = {
        id_visita_referencia: document.getElementById('extra-id-visita').value,
        coanfitriones: colegasSeleccionados
    };

    try {
        const respuesta = await fetch('/api/funcionario/agregar-coanfitriones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paqueteExtra)
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            alert('¡Funcionarios actualizados exitosamente!');
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalAgregarExtra'));
            modal.hide();
            
            //Recargar la tabla automáticamente con la fecha actual
            const user = JSON.parse(sessionStorage.getItem('user'));
            const idUsuario = user.id_usuario || user.id;
            const fechaActual = document.getElementById('extra-fecha').value;
            cargarMisEventos(idUsuario, fechaActual); 
        } else {
            alert('Error al guardar: ' + resultado.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Hubo un problema de conexión.');
    }
}

// ==========================================
// 6. UTILIDADES UI: SELECCIONAR TODOS
// ==========================================

function toggleTodos(claseCheckbox) {
    // Buscamos todos los checkboxes que pertenezcan a la clase que nos enviaron
    const checkboxes = document.querySelectorAll(`.${claseCheckbox}`);
    if (checkboxes.length === 0) return;

    // Revisamos si actualmente TODOS están marcados
    const todosMarcados = Array.from(checkboxes).every(cb => cb.checked);

    // Si todos están marcados, los desmarcamos (false). Si falta alguno, los marcamos todos (true).
    checkboxes.forEach(cb => {
        cb.checked = !todosMarcados;
    });
}


// ==========================================
// 7. UTILIDADES UI: BUSCADOR DE COLEGAS EN TIEMPO REAL
// ==========================================

function filtrarColegas(inputElement, claseItem) {
    const filtro = inputElement.value.toLowerCase(); // Lo que escribió el usuario, en minúsculas
    const items = document.querySelectorAll(`.${claseItem}`); // Todos los colegas de esa lista
    
    items.forEach(item => {
        const textoColega = item.innerText.toLowerCase(); // El nombre y unidad del colega
        
        // Si el texto incluye lo que el usuario busca, lo mostramos. Si no, lo escondemos.
        if (textoColega.includes(filtro)) {
            item.style.display = ''; 
        } else {
            item.style.display = 'none'; 
        }
    });
}


// ==========================================
// 8. ACCIONES DE VISITA: CANCELAR
// ==========================================

async function cancelarVisita(idVisita, fechaActual) {
    // 1. Confirmación de seguridad
    if (!confirm("¿Estás seguro de que deseas cancelar esta visita? Esta acción no se puede deshacer.")) {
        return;
    }

    // 2. Llamada al backend
    try {
        const respuesta = await fetch(`/api/funcionario/visita/${idVisita}/cancelar`, {
            method: 'PUT'
        });
        
        const resultado = await respuesta.json();

        if (resultado.success) {
            // 3. Recargar la vista para reflejar los cambios mágicamente
            const user = JSON.parse(sessionStorage.getItem('user'));
            const idUsuario = user.id_usuario || user.id;
            
            cargarMetricas(idUsuario, fechaActual);
            cargarMisEventos(idUsuario, fechaActual);
        } else {
            alert('Error al cancelar: ' + resultado.message);
        }
    } catch (error) {
        console.error("Error en la cancelación:", error);
        alert("Hubo un problema de conexión con el servidor.");
    }
}


// ==========================================
// 9. LÓGICA DE PESTAÑAS Y RENDERIZADO
// ==========================================

function aplicarFiltroPestañas(tipo) {
    pestañaActiva = tipo;
    
    // Cambios visuales sutiles para las pestañas
    const btnPropios = document.getElementById('tab-propios');
    const btnCompartidos = document.getElementById('tab-compartidos');

    if(tipo === 'propios') {
        btnPropios.classList.add('text-success');
        btnPropios.classList.remove('text-secondary', 'bg-light');
        btnCompartidos.classList.add('text-secondary', 'bg-light');
        btnCompartidos.classList.remove('text-success');
    } else {
        btnCompartidos.classList.add('text-success');
        btnCompartidos.classList.remove('text-secondary', 'bg-light');
        btnPropios.classList.add('text-secondary', 'bg-light');
        btnPropios.classList.remove('text-success');
    }

    // Redibujamos la tabla con el nuevo filtro
    renderizarTablaEventos();
}



function renderizarTablaEventos(fecha) {
    const tbody = document.getElementById('cuerpo-tabla-eventos');
    tbody.innerHTML = ''; 

    const userSession = JSON.parse(sessionStorage.getItem('user'));
    const miUnidad = userSession.id_unidad;

    //  Mostrar u ocultar el encabezado de "Acción" según la pestaña
    const thAccion = document.getElementById('th-accion');
    if (pestañaActiva === 'propios') {
        thAccion.style.display = ''; // Lo mostramos
    } else {
        thAccion.style.display = 'none'; // Lo ocultamos
    }

    const eventosFiltrados = todosLosEventosDelDia.filter(visita => {
        if (pestañaActiva === 'propios') {
            return visita.id_unidad === miUnidad; 
        } else {
            return visita.id_unidad !== miUnidad; 
        }
    });

    if (eventosFiltrados.length === 0) {
        // Ajustamos el colspan dependiendo de si la columna Acción está visible o no
        const columnasTotales = pestañaActiva === 'propios' ? 6 : 5;
        tbody.innerHTML = `<tr><td colspan="${columnasTotales}" class="text-center text-muted py-4">No hay visitas en esta sección.</td></tr>`;
        return;
    }

    eventosFiltrados.forEach(visita => {
        const horaLimpia = visita.hora_visita.substring(0, 5);
        
        let colorEstado = 'bg-secondary';
        if (visita.estado_visita === 'PROGRAMADA') colorEstado = 'bg-primary';
        if (visita.estado_visita === 'INGRESO_REGISTRADO') colorEstado = 'bg-success';
        if (visita.estado_visita === 'NO_ASISTIO') colorEstado = 'bg-danger';
        if (visita.estado_visita === 'CANCELADA') colorEstado = 'bg-danger';

        let textoCoanfitriones = '-';
        if (visita.coanfitriones_nombres) {
            const listaNombres = visita.coanfitriones_nombres.split(', ');
            if (listaNombres.length > 1) {
                textoCoanfitriones = `${listaNombres[0]} <span class="badge bg-light text-secondary border">+${listaNombres.length - 1}</span>`;
            } else {
                textoCoanfitriones = listaNombres[0];
            }
        }
        
        const idsCo = visita.coanfitriones_ids || '';

        //  Construir la celda completa de Acción SOLO si es la pestaña 'propios'
        let celdaAccionHtml = '';
        
        if (pestañaActiva === 'propios') {
            let btnInvitar = `<button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="abrirModalExtra('${fecha}', '${visita.hora_visita}', '${visita.motivo}', '${idsCo}', '${visita.id_visita}')" title="Sumar Colegas">👥</button>`;
            let btnCancelar = '';
            
            if (visita.estado_visita === 'PROGRAMADA') {
                btnCancelar = `<button class="btn btn-sm btn-outline-danger py-0 px-2 ms-1" onclick="cancelarVisita(${visita.id_visita}, '${fecha}')" title="Cancelar Visita">❌</button>`;
            }
            
            // Envolvemos los botones en su <td> correspondiente
            celdaAccionHtml = `<td>${btnInvitar} ${btnCancelar}</td>`;
        }

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${horaLimpia}</td>
                <td>${visita.visitante}</td>
                <td>${visita.motivo}</td>
                <td class="small text-muted">${textoCoanfitriones}</td>
                <td><span class="badge ${colorEstado}">${visita.estado_visita.replace('_', ' ')}</span></td>
                ${celdaAccionHtml} </tr>
        `;
    });
}


// ==========================================
// 10. LÓGICA DE ORDENAMIENTO DE COLUMNAS
// ==========================================

function ordenarTabla(columna) {
    //  Si clickeamos la misma columna, invertimos el orden (de A-Z a Z-A)
    if (columnaOrdenActual === columna) {
        ordenAscendente = !ordenAscendente;
    } else {
        // Si es una columna nueva, la guardamos y empezamos de A-Z
        columnaOrdenActual = columna;
        ordenAscendente = true; 
    }

    // Ordenamos nuestro array global de datos
    todosLosEventosDelDia.sort((a, b) => {
        let valorA = a[columna];
        let valorB = b[columna];

        // Protección contra valores nulos
        if (!valorA) valorA = '';
        if (!valorB) valorB = '';

        
        if (typeof valorA === 'string') valorA = valorA.toLowerCase();
        if (typeof valorB === 'string') valorB = valorB.toLowerCase();

        // Lógica matemática de ordenamiento
        if (valorA < valorB) return ordenAscendente ? -1 : 1;
        if (valorA > valorB) return ordenAscendente ? 1 : -1;
        return 0; // Si son exactamente iguales
    });

    // Volvemos a dibujar la tabla
    // Usamos la fecha oculta para no perder el contexto
    const fechaActual = document.getElementById('extra-fecha') ? document.getElementById('extra-fecha').value : new Date().toISOString().split('T')[0];
    renderizarTablaEventos(fechaActual);
}