// Reglas de Parejas de números (ESPECIFICACION.md §5.3), sin pantalla.
//
// El tablero es una lista de números leída como un texto de 9 columnas.
// Cada casilla tiene su número (1–9) y si ya se ha quitado. Las filas enteras
// quitadas desaparecen. La partida es un objeto simple que se puede guardar tal cual.
import { crearAzar } from '../../core/azar.js';

export const COLUMNAS = 9;
export const AÑADIDOS_POR_PARTIDA = 4;

const fila = (i) => Math.floor(i / COLUMNAS);
const columna = (i) => i % COLUMNAS;

export function crearPartida(numeros) {
  return {
    valores: numeros.slice(),
    quitadas: numeros.map(() => false),
    añadidosRestantes: AÑADIDOS_POR_PARTIDA,
    historial: [],   // copias del estado anterior a cada jugada (para deshacer)
    pistas: 0,
    parejas: 0,      // parejas quitadas (para estadísticas)
  };
}

export const quedan = (p) => p.quitadas.reduce((n, q) => n + (q ? 0 : 1), 0);
export const vacio = (p) => quedan(p) === 0;
export const numerosCasan = (a, b) => a === b || a + b === 10;

function libresEntre(p, a, b, paso) {
  for (let k = a + paso; k !== b; k += paso) if (!p.quitadas[k]) return false;
  return true;
}

/**
 * ¿Están conectadas las casillas i y j? (sin mirar los números)
 * - Seguidas leyendo el tablero como un texto (también de final de fila a principio
 *   de la siguiente), saltando casillas quitadas.
 * - En la misma columna o diagonal, con solo casillas quitadas entre ellas.
 */
export function conectadas(p, i, j) {
  if (i === j) return false;
  const [a, b] = i < j ? [i, j] : [j, i];
  if (libresEntre(p, a, b, 1)) return true;                       // texto seguido / misma fila
  const df = fila(b) - fila(a);
  const dc = columna(b) - columna(a);
  if (dc === 0) return libresEntre(p, a, b, COLUMNAS);            // misma columna
  if (Math.abs(dc) === df) return libresEntre(p, a, b, COLUMNAS + Math.sign(dc)); // diagonal
  return false;
}

/** Motivo por el que no se pueden emparejar, o null si sí se puede. */
export function motivoNoPareja(p, i, j) {
  if (i === j || p.quitadas[i] || p.quitadas[j]) return 'casilla';
  if (!numerosCasan(p.valores[i], p.valores[j])) return 'numeros';
  if (!conectadas(p, i, j)) return 'conexion';
  return null;
}

export const puedenEmparejar = (p, i, j) => motivoNoPareja(p, i, j) === null;

/** Primera pareja válida (en orden de lectura), o null. */
export function buscarPareja(p) {
  const n = p.valores.length;
  for (let i = 0; i < n; i++) {
    if (p.quitadas[i]) continue;
    for (let j = i + 1; j < n; j++) {
      if (!p.quitadas[j] && puedenEmparejar(p, i, j)) return [i, j];
    }
  }
  return null;
}

/** Cuántas parejas válidas distintas hay ahora mismo. */
export function contarParejas(p) {
  let total = 0;
  const n = p.valores.length;
  for (let i = 0; i < n; i++) {
    if (p.quitadas[i]) continue;
    for (let j = i + 1; j < n; j++) if (!p.quitadas[j] && puedenEmparejar(p, i, j)) total++;
  }
  return total;
}

function guardarCopia(p) {
  p.historial.push({ valores: p.valores.slice(), quitadas: p.quitadas.slice(), añadidosRestantes: p.añadidosRestantes, parejas: p.parejas });
}

/** Quita las filas enteras ya vaciadas (las de en medio y también la última, aunque esté incompleta). */
function quitarFilasVacias(p) {
  for (let inicio = Math.floor((p.valores.length - 1) / COLUMNAS) * COLUMNAS; inicio >= 0; inicio -= COLUMNAS) {
    const fin = Math.min(inicio + COLUMNAS, p.valores.length);
    let vacia = true;
    for (let k = inicio; k < fin; k++) if (!p.quitadas[k]) { vacia = false; break; }
    if (vacia) {
      p.valores.splice(inicio, fin - inicio);
      p.quitadas.splice(inicio, fin - inicio);
    }
  }
}

/**
 * Empareja i y j. Devuelve true si se ha hecho.
 * Las casillas quedan quitadas (en gris); si una fila queda entera quitada, desaparece.
 */
export function emparejar(p, i, j) {
  if (!puedenEmparejar(p, i, j)) return false;
  guardarCopia(p);
  p.quitadas[i] = true;
  p.quitadas[j] = true;
  p.parejas++;
  quitarFilasVacias(p);
  return true;
}

/** «Añadir números»: copia los que quedan, en orden, al final. Devuelve true si se ha hecho. */
export function añadirNumeros(p) {
  if (p.añadidosRestantes <= 0 || vacio(p)) return false;
  guardarCopia(p);
  const restantes = p.valores.filter((_, k) => !p.quitadas[k]);
  p.valores.push(...restantes);
  p.quitadas.push(...restantes.map(() => false));
  p.añadidosRestantes--;
  return true;
}

export function deshacer(p) {
  const anterior = p.historial.pop();
  if (!anterior) return false;
  Object.assign(p, anterior);
  return true;
}

/** Estado del juego: 'jugando' | 'ganada' (tablero vacío) | 'sin-jugadas'. */
export function estado(p) {
  if (vacio(p)) return 'ganada';
  if (buscarPareja(p)) return 'jugando';
  return p.añadidosRestantes > 0 ? 'jugando' : 'sin-jugadas';
}

/** Pista: una pareja válida para iluminar, o 'añadir' si no hay y se puede añadir, o null. Cuenta la pista. */
export function darPista(p) {
  const par = buscarPareja(p);
  if (!par && p.añadidosRestantes <= 0) return null;
  p.pistas++;
  return par || 'añadir';
}

/**
 * Tablero inicial al azar: entre 27 y 36 números (3–4 filas) del 1 al 9,
 * con al menos `minParejas` parejas posibles desde el principio.
 */
export function generarTablero({ azar = crearAzar(), minParejas = 4 } = {}) {
  for (;;) {
    const total = azar.entero(27, 36);
    const numeros = Array.from({ length: total }, () => azar.entero(1, 9));
    if (contarParejas(crearPartida(numeros)) >= minParejas) return numeros;
  }
}

export function resumen(p) {
  const n = quedan(p);
  const texto = n === 0 ? 'No quedan números' : n === 1 ? 'Queda 1 número' : `Quedan ${n} números`;
  return { quedan: n, texto };
}
