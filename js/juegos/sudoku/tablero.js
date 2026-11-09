// Geometría del tablero 9×9 y utilidades de máscaras de bits.
// Un tablero es un array de 81 enteros: 0 = vacía, 1–9 = número.
// Las máscaras de candidatos usan los bits 1–9 (bit n = el número n es posible).

export const TODOS = 0b1111111110; // bits 1–9

export const fila = (i) => (i / 9) | 0;
export const columna = (i) => i % 9;
export const bloque = (i) => ((fila(i) / 3) | 0) * 3 + ((columna(i) / 3) | 0);

/** Las 27 unidades: 9 filas, 9 columnas, 9 bloques (cada una, 9 índices). */
export const UNIDADES = (() => {
  const u = [];
  for (let f = 0; f < 9; f++) u.push(Array.from({ length: 9 }, (_, c) => f * 9 + c));
  for (let c = 0; c < 9; c++) u.push(Array.from({ length: 9 }, (_, f) => f * 9 + c));
  for (let b = 0; b < 9; b++) {
    const f0 = ((b / 3) | 0) * 3, c0 = (b % 3) * 3;
    u.push(Array.from({ length: 9 }, (_, k) => (f0 + ((k / 3) | 0)) * 9 + c0 + (k % 3)));
  }
  return u;
})();

/** Para cada casilla, las 20 casillas que comparten fila, columna o bloque. */
export const VECINAS = Array.from({ length: 81 }, (_, i) => {
  const s = new Set();
  for (let k = 0; k < 81; k++) {
    if (k !== i && (fila(k) === fila(i) || columna(k) === columna(i) || bloque(k) === bloque(i))) s.add(k);
  }
  return [...s];
});

export function contarBits(m) {
  let n = 0;
  while (m) { m &= m - 1; n++; }
  return n;
}

/** Números presentes en una máscara: 0b10010 → [1, 4] */
export function bitsANumeros(m) {
  const r = [];
  for (let n = 1; n <= 9; n++) if (m & (1 << n)) r.push(n);
  return r;
}

/** Único número de una máscara con un solo bit. */
export function unicoNumero(m) {
  return 31 - Math.clz32(m);
}

/** Candidatos de una casilla según los números puestos en el tablero. */
export function candidatosDe(tablero, i) {
  if (tablero[i]) return 0;
  let usados = 0;
  for (const k of VECINAS[i]) if (tablero[k]) usados |= 1 << tablero[k];
  return TODOS & ~usados;
}

/** ¿Hay dos números iguales en alguna unidad? (ignora vacías) */
export function tieneConflictos(tablero) {
  for (const u of UNIDADES) {
    let vistos = 0;
    for (const i of u) {
      const v = tablero[i];
      if (!v) continue;
      if (vistos & (1 << v)) return true;
      vistos |= 1 << v;
    }
  }
  return false;
}
