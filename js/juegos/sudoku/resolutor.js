// Resolutor por búsqueda (vuelta atrás con la casilla más restringida primero).
// Sirve para comprobar que un tablero tiene solución única y para crear soluciones al azar.
import { fila, columna, bloque, contarBits, TODOS } from './tablero.js';

const F = Array.from({ length: 81 }, (_, i) => fila(i));
const C = Array.from({ length: 81 }, (_, i) => columna(i));
const B = Array.from({ length: 81 }, (_, i) => bloque(i));

/**
 * Recorre soluciones. `alEncontrar(tablero)` devuelve true para parar.
 * `orden(mascara)` da el orden en que probar los números (por defecto, de menor a mayor).
 */
function buscar(inicial, alEncontrar, orden) {
  const t = inicial.slice();
  const fs = new Array(9).fill(0), cs = new Array(9).fill(0), bs = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = t[i];
    if (!v) continue;
    const bit = 1 << v;
    if ((fs[F[i]] | cs[C[i]] | bs[B[i]]) & bit) return; // tablero contradictorio
    fs[F[i]] |= bit; cs[C[i]] |= bit; bs[B[i]] |= bit;
  }

  const paso = () => {
    let mejor = -1, mejorMascara = 0, mejorCuenta = 10;
    for (let i = 0; i < 81; i++) {
      if (t[i]) continue;
      const m = TODOS & ~(fs[F[i]] | cs[C[i]] | bs[B[i]]);
      const n = contarBits(m);
      if (n === 0) return false;
      if (n < mejorCuenta) {
        mejor = i; mejorMascara = m; mejorCuenta = n;
        if (n === 1) break;
      }
    }
    if (mejor === -1) return alEncontrar(t);

    const f = F[mejor], c = C[mejor], b = B[mejor];
    for (const v of orden(mejorMascara)) {
      const bit = 1 << v;
      t[mejor] = v; fs[f] |= bit; cs[c] |= bit; bs[b] |= bit;
      if (paso()) return true;
      t[mejor] = 0; fs[f] &= ~bit; cs[c] &= ~bit; bs[b] &= ~bit;
    }
    return false;
  };
  paso();
}

const ordenNatural = (m) => {
  const r = [];
  for (let n = 1; n <= 9; n++) if (m & (1 << n)) r.push(n);
  return r;
};

/** Cuántas soluciones tiene (deja de contar al llegar a `limite`). */
export function contarSoluciones(tablero, limite = 2) {
  let n = 0;
  buscar(tablero, () => ++n >= limite, ordenNatural);
  return n;
}

export const tieneSolucionUnica = (tablero) => contarSoluciones(tablero, 2) === 1;

/** Primera solución encontrada, o null. */
export function resolver(tablero) {
  let sol = null;
  buscar(tablero, (t) => { sol = t.slice(); return true; }, ordenNatural);
  return sol;
}

/** Un tablero completo y válido al azar. */
export function solucionAleatoria(azar) {
  let sol = null;
  buscar(new Array(81).fill(0), (t) => { sol = t.slice(); return true; },
    (m) => azar.barajar(ordenNatural(m)));
  return sol;
}
