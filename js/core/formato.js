// Formatos en español de España. Sin dependencias del navegador: se prueba con node --test.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** «lunes, 9 de noviembre» */
export function fechaLarga(fecha = new Date()) {
  return `${DIAS[fecha.getDay()]}, ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

/** «Hoy», «Ayer» o «7 nov» (con año si no es el actual: «7 nov 2025») */
export function fechaRelativa(fecha, hoy = new Date()) {
  const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicioDia(hoy) - inicioDia(fecha)) / 86400000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  const base = `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
  return fecha.getFullYear() === hoy.getFullYear() ? base : `${base} ${fecha.getFullYear()}`;
}

/** Números con punto de millar: 1250 → «1.250»; -30 → «−30» */
export function numero(n) {
  const signo = n < 0 ? '−' : '';
  const entero = String(Math.trunc(Math.abs(n)));
  return signo + entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Duración de cronómetro: 252 → «04:12»; 3725 → «1:02:05» */
export function cronometro(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

/** Duración en palabras para totales: «45 min», «3 h 20 min», «menos de 1 min» */
export function duracionTexto(segundos) {
  const min = Math.floor(segundos / 60);
  if (min < 1) return segundos > 0 ? 'menos de 1 min' : '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${numero(h)} h` : `${numero(h)} h ${m} min`;
}
