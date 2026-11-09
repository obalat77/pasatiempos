// Reglas de una partida de Sudoku (ESPECIFICACION.md §5.1), sin pantalla.
// La partida es un objeto simple (se puede guardar tal cual en IndexedDB).
// Las funciones lo modifican y apuntan cada cambio en `historial` para poder deshacer.
import { VECINAS, candidatosDe, contarBits } from './tablero.js';

/**
 * @param {{ tablero: number[], solucion: number[], dificultad: string }} sudoku
 */
export function crearPartida({ tablero, solucion, dificultad }) {
  return {
    dificultad,
    dados: tablero.slice(),          // números iniciales (no se pueden cambiar)
    solucion: solucion.slice(),
    valores: tablero.slice(),        // lo que hay ahora en cada casilla
    notas: new Array(81).fill(0),    // máscara de bits 1–9 por casilla
    historial: [],                   // cambios para deshacer
    pistas: 0,
    errores: 0,                      // números equivocados puestos (para estadísticas)
  };
}

export const esDado = (p, i) => p.dados[i] !== 0;
export const esError = (p, i) => p.valores[i] !== 0 && p.valores[i] !== p.solucion[i];
export const tieneNota = (p, i, n) => (p.notas[i] & (1 << n)) !== 0;
export const casillasLlenas = (p) => p.valores.reduce((s, v) => s + (v ? 1 : 0), 0);
export const resuelto = (p) => p.valores.every((v, i) => v === p.solucion[i]);

/** Cuántas veces está puesto el número n (los 9 → su botón se atenúa). */
export const vecesPuesto = (p, n) => p.valores.reduce((s, v) => s + (v === n ? 1 : 0), 0);
export const numeroCompleto = (p, n) => vecesPuesto(p, n) >= 9;

function apuntar(p, i) {
  const cambio = { i, valor: p.valores[i], notas: p.notas[i], vecinas: [] };
  p.historial.push(cambio);
  return cambio;
}

/**
 * Pone el número n en la casilla i y quita esa nota de su fila, columna y bloque.
 * Devuelve false si no se puede (casilla inicial o el mismo número ya puesto).
 */
export function ponerNumero(p, i, n, { esPista = false } = {}) {
  if (esDado(p, i) || p.valores[i] === n) return false;
  const cambio = apuntar(p, i);
  p.valores[i] = n;
  p.notas[i] = 0;
  const bit = 1 << n;
  for (const k of VECINAS[i]) {
    if (p.notas[k] & bit) {
      cambio.vecinas.push([k, p.notas[k]]);
      p.notas[k] &= ~bit;
    }
  }
  if (!esPista && n !== p.solucion[i]) p.errores++;
  return true;
}

/** Pone o quita la nota n en la casilla i (solo si está vacía). */
export function alternarNota(p, i, n) {
  if (esDado(p, i) || p.valores[i]) return false;
  apuntar(p, i);
  p.notas[i] ^= 1 << n;
  return true;
}

/** Vacía la casilla i (número y notas). */
export function borrar(p, i) {
  if (esDado(p, i) || (!p.valores[i] && !p.notas[i])) return false;
  apuntar(p, i);
  p.valores[i] = 0;
  p.notas[i] = 0;
  return true;
}

/** Deshace el último cambio. Devuelve la casilla afectada, o -1 si no había nada. */
export function deshacer(p) {
  const cambio = p.historial.pop();
  if (!cambio) return -1;
  p.valores[cambio.i] = cambio.valor;
  p.notas[cambio.i] = cambio.notas;
  for (const [k, notas] of cambio.vecinas) p.notas[k] = notas;
  return cambio.i;
}

/**
 * Pista: rellena correctamente la casilla seleccionada si está vacía o equivocada;
 * si no, una casilla que solo admita un número; si no hay, la vacía con menos posibilidades.
 * Devuelve la casilla rellenada, o -1 si el tablero ya está resuelto.
 */
export function darPista(p, seleccionada = -1) {
  const pendiente = (i) => p.valores[i] !== p.solucion[i];
  let elegida = -1;

  if (seleccionada >= 0 && !esDado(p, seleccionada) && pendiente(seleccionada)) {
    elegida = seleccionada;
  } else {
    // Candidatos calculados solo con los números correctos (los errores no cuentan).
    const correctos = p.valores.map((v, i) => (v === p.solucion[i] ? v : 0));
    let menos = 10;
    for (let i = 0; i < 81; i++) {
      if (!pendiente(i)) continue;
      const n = contarBits(candidatosDe(correctos, i));
      if (n < menos) { menos = n; elegida = i; }
      if (n === 1) break;
    }
  }
  if (elegida < 0) return -1;
  ponerNumero(p, elegida, p.solucion[elegida], { esPista: true });
  p.pistas++;
  return elegida;
}

/** Resumen para Inicio («Continuar partida»). */
export function resumen(p) {
  const llenas = casillasLlenas(p);
  return { llenas, progreso: llenas / 81, texto: `${llenas} de 81 casillas` };
}

