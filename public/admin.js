let listaUsuariosGlobal = [];
let listaUnidadesGlobal = [];
let ordenAsc = true;

// Función auxiliar para obtener las cabeceras de configuración con el token incluido de forma automática
function obtenerHeaders(headersAdicionales = {}) {
    const token = sessionStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        ...headersAdicionales
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const userSession = sessionStorage.getItem('user');
    if (!userSession) return window.location.replace('/');

    const user = JSON.parse(userSession);
    if ((user.rol ? user.rol.toUpperCase() : '') !== 'ADMIN') {
        sessionStorage.clear();
        return window.location.replace('/');
    }

    document.getElementById('nombre-admin').textContent = `Hola, ${user.nombre}`;
    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.replace('/');
    });

    gestionarFechasFiltro();
    cargarDashboard();
    cargarUnidades();
    cargarUsuarios();
});

// ==========================================
// DASHBOARD & REPORTES
// ==========================================
async function cargarDashboard() {
    try {
        const res = await fetch('/api/admin/dashboard/metricas', { headers: obtenerHeaders() });
        const data = await res.json();
        if (data.success) {
            document.getElementById('dash-hoy').textContent = data.data.visitasHoy;
            document.getElementById('dash-mes').textContent = data.data.visitasMes;
            document.getElementById('dash-efectividad').textContent = data.data.efectividad;
            document.getElementById('dash-top-unidad').textContent = data.data.topUnidad;
            document.getElementById('dash-top-total').textContent = `${data.data.topUnidadTotal} visitas`;
        }
    } catch (e) { console.error(e); }
}

function gestionarFechasFiltro() {
    const periodo = document.getElementById('filtro-periodo').value;
    const inputDesde = document.getElementById('filtro-desde');
    const inputHasta = document.getElementById('filtro-hasta');
    const hoy = new Date();
    let dDesde = new Date();
    let dHasta = new Date(hoy);

    if (periodo === 'rango') {
        inputDesde.disabled = inputHasta.disabled = false;
        return; 
    } 
    inputDesde.disabled = inputHasta.disabled = true;

    if (periodo === 'semana') dDesde.setDate(hoy.getDate() - 7);
    if (periodo === 'mes') dDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    inputDesde.value = dDesde.toISOString().split('T')[0];
    inputHasta.value = dHasta.toISOString().split('T')[0];
}

async function generarReporte() {
    const unidad = document.getElementById('filtro-unidad').value;
    const fDesde = document.getElementById('filtro-desde').value;
    const fHasta = document.getElementById('filtro-hasta').value;
    if (!fDesde || !fHasta) return alert("Fechas inválidas.");

    try {
        const res = await fetch(`/api/admin/reportes?unidad=${unidad}&fechaDesde=${fDesde}&fechaHasta=${fHasta}`, {
            headers: obtenerHeaders()
        });
        const data = await res.json();
        
        const tbody = document.getElementById('tabla-reportes');
        const divResumen = document.getElementById('resumen-reporte');
        tbody.innerHTML = '';

        if (data.success && data.data.length > 0) {
            let total = data.data.length;
            let asistencias = 0;

            data.data.forEach(r => {
                let color = 'bg-secondary';
                if(r.estado === 'PROGRAMADA') color = 'bg-primary';
                
                if(r.estado === 'INGRESO_REGISTRADO') {
                    color = 'bg-success';
                    asistencias++;
                }
                
                if(r.estado === 'CANCELADA' || r.estado === 'NO_ASISTIO') color = 'bg-danger';
                
                tbody.innerHTML += `<tr><td>${r.fecha}</td><td class="fw-bold">${r.hora.substring(0,5)}</td>
                <td>${r.visitante}</td><td>${r.unidad_destino || 'N/A'}</td>
                <td><span class="badge ${color}">${r.estado.replace('_',' ')}</span></td></tr>`;
            });

            let inasistencias = total - asistencias;
            let pctAsistencias = ((asistencias / total) * 100).toFixed(1);
            let pctInasistencias = ((inasistencias / total) * 100).toFixed(1);

            document.getElementById('rep-total').textContent = total;
            document.getElementById('rep-asistencias').innerHTML = `${asistencias} <span class="fs-6 opacity-75">(${pctAsistencias}%)</span>`;
            document.getElementById('rep-inasistencias').innerHTML = `${inasistencias} <span class="fs-6 opacity-75">(${pctInasistencias}%)</span>`;
            
            divResumen.classList.remove('d-none');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin resultados.</td></tr>';
            divResumen.classList.add('d-none');
        }
    } catch (e) { alert("Error al cargar reporte."); }
}

// ==========================================
// UNIDADES CRUD
// ==========================================
async function cargarUnidades() {
    try {
        const res = await fetch('/api/admin/unidades', { headers: obtenerHeaders() });
        const data = await res.json();
        listaUnidadesGlobal = data.data || [];
        renderUnidades();
        
        let htmlSelect = '<option value="todas">Todas las unidades</option>';
        let htmlModal = '<option value="null">Sin Unidad (Global)</option>';
        listaUnidadesGlobal.forEach(u => {
            htmlSelect += `<option value="${u.id_unidad}">${u.nombre}</option>`;
            htmlModal += `<option value="${u.id_unidad}">${u.nombre}</option>`;
        });
        document.getElementById('filtro-unidad').innerHTML = htmlSelect;
        document.getElementById('usr-unidad').innerHTML = htmlModal;
    } catch (e) { console.error(e); }
}

function renderUnidades() {
    const tbody = document.getElementById('tabla-unidades');
    tbody.innerHTML = '';
    listaUnidadesGlobal.forEach(u => {
        tbody.innerHTML += `<tr><td>${u.id_unidad}</td><td class="fw-bold">${u.nombre}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary py-0" onclick="abrirModalUnidad(${u.id_unidad}, '${u.nombre}')">✏️</button>
                <button class="btn btn-sm btn-outline-danger py-0" onclick="eliminarUnidad(${u.id_unidad})">🗑️</button>
            </td></tr>`;
    });
}

function ordenarUnidades(col) {
    ordenAsc = !ordenAsc;
    listaUnidadesGlobal.sort((a, b) => {
        let vA = a[col].toLowerCase(), vB = b[col].toLowerCase();
        if (vA < vB) return ordenAsc ? -1 : 1;
        if (vA > vB) return ordenAsc ? 1 : -1;
        return 0;
    });
    renderUnidades();
}

function abrirModalUnidad(id = null, nombre = '') {
    document.getElementById('uni-id').value = id || '';
    document.getElementById('uni-nombre').value = nombre;
    document.getElementById('modalUnidadTitle').textContent = id ? 'Editar Unidad' : 'Nueva Unidad';
    new bootstrap.Modal(document.getElementById('modalUnidad')).show();
}

async function guardarUnidad() {
    const id = document.getElementById('uni-id').value;
    const nombre = document.getElementById('uni-nombre').value;
    const url = id ? `/api/admin/unidades/${id}` : '/api/admin/unidades';
    const method = id ? 'PUT' : 'POST';

    await fetch(url, { 
        method, 
        headers: obtenerHeaders({'Content-Type': 'application/json'}), 
        body: JSON.stringify({ nombre }) 
    });
    bootstrap.Modal.getInstance(document.getElementById('modalUnidad')).hide();
    cargarUnidades();
}

async function eliminarUnidad(id) {
    if(!confirm('¿Seguro que deseas eliminar esta unidad?')) return;
    const res = await fetch(`/api/admin/unidades/${id}`, { method: 'DELETE', headers: obtenerHeaders() });
    const data = await res.json();
    if(!data.success) alert(data.message);
    cargarUnidades();
}

// ==========================================
// USUARIOS CRUD
// ==========================================
async function cargarUsuarios() {
    try {
        const res = await fetch('/api/admin/usuarios', { headers: obtenerHeaders() });
        const data = await res.json();
        listaUsuariosGlobal = data.data || [];
        renderUsuarios();
    } catch (e) { console.error(e); }
}

function renderUsuarios() {
    const tbody = document.getElementById('tabla-usuarios');
    tbody.innerHTML = '';
    listaUsuariosGlobal.forEach(u => {
        let colorRol = 'bg-secondary';
        if(u.rol === 'ADMINISTRADOR') colorRol = 'bg-dark';
        if(u.rol === 'FUNCIONARIO') colorRol = 'bg-primary';
        if(u.rol === 'GUARDIA') colorRol = 'bg-warning text-dark';

        tbody.innerHTML += `<tr><td class="fw-bold">${u.nombre_completo}</td><td>${u.username}</td>
            <td><span class="badge ${colorRol}">${u.rol}</span></td>
            <td>${u.unidad || '<span class="text-muted small">Global</span>'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary py-0" onclick='abrirModalUsuario(${JSON.stringify(u).replace(/'/g, "&#39;")})'>✏️</button>
                <button class="btn btn-sm btn-outline-danger py-0" onclick="eliminarUsuario(${u.id_usuario})">🗑️</button>
            </td></tr>`;
    });
}

// Ordenar usuarios
function ordenarUsuarios(col) {
    ordenAsc = !ordenAsc;
    listaUsuariosGlobal.sort((a, b) => {
        let vA = (a[col] || '').toLowerCase(), vB = (b[col] || '').toLowerCase();
        if (vA < vB) return ordenAsc ? -1 : 1;
        if (vA > vB) return ordenAsc ? 1 : -1;
        return 0;
    });
    renderUsuarios();
}

function abrirModalUsuario(u = null) {
    document.getElementById('usr-id').value = u ? u.id_usuario : '';
    document.getElementById('usr-nombre').value = u ? u.nombre_completo : '';
    document.getElementById('usr-email').value = u ? u.username : '';
    document.getElementById('usr-rol').value = u ? u.id_rol : '2';
    document.getElementById('usr-unidad').value = u && u.id_unidad ? u.id_unidad : 'null';
    
    document.getElementById('usr-pass').value = '';
    document.getElementById('usr-pass-hint').textContent = u ? '(Dejar en blanco para mantener actual)' : '(Obligatorio)';
    document.getElementById('usr-pass').required = !u;

    document.getElementById('modalUsuarioTitle').textContent = u ? 'Editar Usuario' : 'Nuevo Usuario';
    new bootstrap.Modal(document.getElementById('modalUsuario')).show();
}

async function guardarUsuario() {
    const id = document.getElementById('usr-id').value;
    const data = {
        nombre: document.getElementById('usr-nombre').value,
        username: document.getElementById('usr-email').value,
        password: document.getElementById('usr-pass').value,
        rol_id: document.getElementById('usr-rol').value,
        unidad_id: document.getElementById('usr-unidad').value
    };

    const url = id ? `/api/admin/usuarios/${id}` : '/api/admin/usuarios';
    const method = id ? 'PUT' : 'POST';

    await fetch(url, { 
        method, 
        headers: obtenerHeaders({'Content-Type': 'application/json'}), 
        body: JSON.stringify(data) 
    });
    bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
    cargarUsuarios();
}

async function eliminarUsuario(id) {
    if(!confirm('¿Eliminar este usuario definitivamente?')) return;
    await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE', headers: obtenerHeaders() });
    cargarUsuarios();
}