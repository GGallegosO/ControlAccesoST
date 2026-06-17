// Validar y formatear RUT Chileno
function validarRut(rut) {
  if (!rut || typeof rut !== 'string') return false;
  
  // Limpiar rut (quitar puntos y guión, mayúsculas)
  let rutLimpio = rut.replace(/[.\-]/g, '').toUpperCase();
  
  // Verificar formato básico (mínimo 8 chars: 7 números + 1 dígito)
  if (rutLimpio.length < 8) return false;

  // Separar cuerpo y dígito verificador
  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);

  // Verificar que el cuerpo sean solo números
  if (!/^\d+$/.test(cuerpo)) return false;

  // Calcular dígito verificador esperado
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = suma % 11;
  const dvEsperado = 11 - resto === 11 ? '0' : 11 - resto === 10 ? 'K' : (11 - resto).toString();

  return dv === dvEsperado;
}

function formatearRut(rut) {
  if (!rut) return '';
  let rutLimpio = rut.replace(/[.\-]/g, '').toUpperCase();
  if (rutLimpio.length < 8) return rut;
  
  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);
  
  // Agregar puntos
  let cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${cuerpoConPuntos}-${dv}`;
}

module.exports = { validarRut, formatearRut };