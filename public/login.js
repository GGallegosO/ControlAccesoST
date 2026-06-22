const loginForm = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');

// Verificar si ya hay sesión activa para saltarse el login
const savedUser = sessionStorage.getItem('user');
if (savedUser) {
    redirigirSegunRol(JSON.parse(savedUser).rol);
}

// Manejo del formulario
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            // Guardamos los datos del usuario
            sessionStorage.setItem('user', JSON.stringify(data.user));
            
            // 🔥 LA PIEZA CLAVE: Guardamos el Token de seguridad
            sessionStorage.setItem('token', data.token);
            
            redirigirSegunRol(data.user.rol);
        } else {
            showError(data.message);
        }
    } catch (err) {
        showError('Error de conexión con el servidor');
    }
});

// El "Viaje" hacia la otra página
function redirigirSegunRol(rol) {
    const rolNormalizado = rol ? rol.toLowerCase() : '';
    
    if (rolNormalizado === 'admin') {
        window.location.href = '/admin.html';
    } else if (rolNormalizado === 'funcionario') {
        window.location.href = '/funcionario.html';
    } else if (rolNormalizado === 'guardia') {
        window.location.href = '/guardia.html';
    } else {
        showError('Rol no reconocido');
        // Limpiamos todo si hay error
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token'); 
    }
}

function showError(msg) {
    errorMsg.innerText = msg;
    errorMsg.classList.remove('hidden');
    setTimeout(() => errorMsg.classList.add('hidden'), 3000);
}