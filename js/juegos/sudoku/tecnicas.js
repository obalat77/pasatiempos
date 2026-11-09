// Resolutor «humano»: aplica técnicas de deducción de menor a mayor dificultad
// y anota la más difícil que ha necesitado. Sirve para clasificar los tableros.
//
// Niveles:
//   1  Casilla con un solo candidato y número que solo cabe en un sitio de una unidad
//   2  Intersecciones: candidatos de un bloque alineados en una fila/columna (y al revés)
//   3  Parejas y tríos (desnudos y ocultos) en una unidad
//   4  X-wing
// Si con todo eso no se puede terminar, `resuelto` es false (haría falta tantear).
import { UNIDADES, VECINAS, TODOS, contarBits, unicoNumero, fila, columna, bloque } from './tablero.js';

export const NIVEL_MAXIMO = 4;

const FILAS = UNIDADES.slice(0, 9);
const COLUMNAS = UNIDADES.slice(9, 18);
const BLOQUES = UNIDADES.slice(18, 27);

class Estado {
  constructor(tablero) {
    this.t = tablero.slice();
    this.cand = new Array(81).fill(0);
    this.valido = true;
    for (let i = 0; i < 81; i++) {
      if (this.t[i]) continue;
      let m = TODOS;
      for (const k of VECINAS[i]) if (this.t[k]) m &= ~(1 << this.t[k]);
      this.cand[i] = m;
      if (!m) this.valido = false;
    }
  }

  colocar(i, v) {
    this.t[i] = v;
    this.cand[i] = 0;
    const bit = 1 << v;
    for (const k of VECINAS[i]) {
      if (this.cand[k] & bit) {
        this.cand[k] &= ~bit;
        if (!this.cand[k] && !this.t[k]) this.valido = false;
      }
    }
  }

  /** Quita candidatos `mascara` de la casilla i. Devuelve true si cambió algo. */
  quitar(i, mascara) {
    if (this.t[i] || !(this.cand[i] & mascara)) return false;
    this.cand[i] &= ~mascara;
    if (!this.cand[i]) this.valido = false;
    return true;
  }

  get completo() {
    return this.t.every((v) => v !== 0);
  }
}

// ---------- Nivel 1 ----------

function soloUnCandidato(e) {
  for (let i = 0; i < 81; i++) {
    if (!e.t[i] && contarBits(e.cand[i]) === 1) {
      e.colocar(i, unicoNumero(e.cand[i]));
      return true;
    }
  }
  return false;
}

function soloUnSitio(e) {
  for (const u of UNIDADES) {
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      let lugar = -1, cuantos = 0, yaEsta = false;
      for (const i of u) {
        if (e.t[i] === v) { yaEsta = true; break; }
        if (e.cand[i] & bit) { lugar = i; cuantos++; }
      }
      if (!yaEsta && cuantos === 1) {
        e.colocar(lugar, v);
        return true;
      }
    }
  }
  return false;
}

// ---------- Nivel 2 ----------

function intersecciones(e) {
  let cambio = false;
  for (let v = 1; v <= 9; v++) {
    const bit = 1 << v;
    // Bloque → fila/columna
    for (const b of BLOQUES) {
      const sitios = b.filter((i) => e.cand[i] & bit);
      if (sitios.length < 2) continue;
      const f = fila(sitios[0]), c = columna(sitios[0]);
      if (sitios.every((i) => fila(i) === f)) {
        for (const i of FILAS[f]) if (bloque(i) !== bloque(sitios[0])) cambio = e.quitar(i, bit) || cambio;
      }
      if (sitios.every((i) => columna(i) === c)) {
        for (const i of COLUMNAS[c]) if (bloque(i) !== bloque(sitios[0])) cambio = e.quitar(i, bit) || cambio;
      }
    }
    // Fila/columna → bloque
    for (const linea of [...FILAS, ...COLUMNAS]) {
      const sitios = linea.filter((i) => e.cand[i] & bit);
      if (sitios.length < 2) continue;
      const b = bloque(sitios[0]);
      if (sitios.every((i) => bloque(i) === b)) {
        for (const i of BLOQUES[b]) if (!linea.includes(i)) cambio = e.quitar(i, bit) || cambio;
      }
    }
    if (cambio) return true;
  }
  return false;
}

// ---------- Nivel 3 ----------

function combinaciones(lista, k, desde = 0, actual = [], salida = []) {
  if (actual.length === k) { salida.push(actual.slice()); return salida; }
  for (let i = desde; i < lista.length; i++) {
    actual.push(lista[i]);
    combinaciones(lista, k, i + 1, actual, salida);
    actual.pop();
  }
  return salida;
}

function subconjuntos(e) {
  for (const u of UNIDADES) {
    const vacias = u.filter((i) => !e.t[i]);
    for (let k = 2; k <= 3; k++) {
      if (vacias.length <= k) continue;
      // Desnudos: k casillas cuyos candidatos juntos son k números
      for (const grupo of combinaciones(vacias, k)) {
        let union = 0;
        for (const i of grupo) union |= e.cand[i];
        if (contarBits(union) !== k) continue;
        let cambio = false;
        for (const i of vacias) if (!grupo.includes(i)) cambio = e.quitar(i, union) || cambio;
        if (cambio) return true;
      }
      // Ocultos: k números que solo caben en las mismas k casillas
      const faltan = [];
      for (let v = 1; v <= 9; v++) if (!u.some((i) => e.t[i] === v)) faltan.push(v);
      for (const nums of combinaciones(faltan, k)) {
        let mascara = 0;
        for (const v of nums) mascara |= 1 << v;
        const sitios = vacias.filter((i) => e.cand[i] & mascara);
        if (sitios.length !== k) continue;
        // cada número debe aparecer en alguno de los sitios (si no, el tablero es inválido)
        let cambio = false;
        for (const i of sitios) cambio = e.quitar(i, TODOS & ~mascara) || cambio;
        if (cambio) return true;
      }
    }
  }
  return false;
}

// ---------- Nivel 4 ----------

function xWing(e) {
  for (let v = 1; v <= 9; v++) {
    const bit = 1 << v;
    for (const [lineas, cruzadas, posicion] of [[FILAS, COLUMNAS, columna], [COLUMNAS, FILAS, fila]]) {
      const pares = [];
      lineas.forEach((linea, n) => {
        const sitios = linea.filter((i) => e.cand[i] & bit);
        if (sitios.length === 2) pares.push({ n, a: posicion(sitios[0]), b: posicion(sitios[1]) });
      });
      for (let x = 0; x < pares.length; x++) {
        for (let y = x + 1; y < pares.length; y++) {
          const p = pares[x], q = pares[y];
          if (p.a !== q.a || p.b !== q.b) continue;
          let cambio = false;
          for (const pos of [p.a, p.b]) {
            for (const i of cruzadas[pos]) {
              const n = lineas === FILAS ? fila(i) : columna(i);
              if (n !== p.n && n !== q.n) cambio = e.quitar(i, bit) || cambio;
            }
          }
          if (cambio) return true;
        }
      }
    }
  }
  return false;
}

const TECNICAS = [
  [1, soloUnCandidato],
  [1, soloUnSitio],
  [2, intersecciones],
  [3, subconjuntos],
  [4, xWing],
];

/**
 * Intenta resolver solo con deducción.
 * @returns {{ resuelto: boolean, nivel: number, tablero: number[] }}
 *   nivel = técnica más difícil que hizo falta (0 si ya estaba completo).
 */
export function resolverConTecnicas(tablero, nivelMaximo = NIVEL_MAXIMO) {
  const e = new Estado(tablero);
  let nivel = 0;
  while (e.valido && !e.completo) {
    let avance = false;
    for (const [n, tecnica] of TECNICAS) {
      if (n > nivelMaximo) break;
      if (tecnica(e)) {
        nivel = Math.max(nivel, n);
        avance = true;
        break; // volver a empezar por las técnicas más fáciles
      }
    }
    if (!avance) break;
  }
  return { resuelto: e.valido && e.completo, nivel, tablero: e.t };
}
