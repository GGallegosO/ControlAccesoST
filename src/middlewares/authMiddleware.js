const jwt = require('jsonwebtoken');

//  GUARDIA GENERAL: Verifica que la firma del token sea real y no haya expirado
exports.verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extrae el token del formato "Bearer TOKEN"

    if (!token) {
        return res.status(403).json({ success: false, message: 'Acceso denegado: No se proporcionó credencial de seguridad' });
    }

    try {
        // Valida criptográficamente el token con la llave de tu .env
        const decodificado = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decodificado; // Guarda los datos decodificados en la petición
        next(); // Token válido, permite continuar
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Sesión inválida o expirada. Vuelva a iniciar sesión.' });
    }
};

//  GUARDIA ESPECÍFICO: Zona exclusiva de Administradores
exports.esAdmin = (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso denegado: Se requieren privilegios de Administrador' });
    }
    next();
};

//  GUARDIA ESPECÍFICO: Zona exclusiva de Funcionarios
exports.esFuncionario = (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== 'funcionario') {
        return res.status(403).json({ success: false, message: 'Acceso denegado: Se requieren privilegios de Funcionario' });
    }
    next();
};

//  GUARDIA ESPECÍFICO: Zona exclusiva de Guardias
exports.esGuardia = (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== 'guardia') {
        return res.status(403).json({ success: false, message: 'Acceso denegado: Se requieren privilegios de Guardia' });
    }
    next();
};