// Cálculos cruzados (ESPECIFICACION.md §5.4), sin pantalla.
//
// Hay una rejilla de m×m números (3×3 en el tablero 7×7, 4×4 en el 9×9). Cada fila y
// cada columna de números forma una cuenta «a op b op c (op d) = resultado».
// Entre números van los operadores; el «=» y el resultado ocupan las dos últimas
// filas/columnas del tablero. Se respeta la prioridad (× y ÷ antes que + y −); todos
// los pasos son enteros no negativos y las divisiones, exactas.
import { crearAzar } from '../../core/azar.js';

export const SUMA = '+';
export const RESTA = '−';   // signo menos tipográfico
export const POR = '×';
export const ENTRE = '÷';

export const NIVELES = {
  facil:   { m: 3, ops: [SUMA, RESTA], max: 10, huecos: 5, resultadoMax: 30 },
  medio:   { m: 3, ops: [SUMA, RESTA, POR], max: 20, huecos: 6, resultadoMax: 100 },
  dificil: { m: 4, ops: [SUMA, RESTA, POR, ENTRE], max: 20, huecos: 8, resultadoMax: 100 },
  experto: { m: 4, ops: [SUMA, RESTA, POR, ENTRE], max: 20, huecos: 11, resultadoMax: 100 },
};

/**
 * Evalúa a op b op c… con prioridad de operaciones.
 * Devuelve el resultado, o null si algún paso no es un entero no negativo
 * (división no exacta, entre cero o resta que baja de cero).
 */
export function evaluar(numeros, operadores) {
  // 1.º × y ÷, de izquierda a derecha
  const terminos = [numeros[0]];
  const sumas = [];
  for (let k = 0; k < operadores.length; k++) {
    const op = operadores[k];
    const b = numeros[k + 1];
    if (op === POR || op === ENTRE) {
      const a = terminos[terminos.length - 1];
      if (op === POR) terminos[terminos.length - 1] = a * b;
      else {
        if (b === 0 || a % b !== 0) return null;
        terminos[terminos.length - 1] = a / b;
      }
    } else {
      sumas.push(op);
      terminos.push(b);
    }
  }
  // 2.º + y −, de izquierda a derecha, sin bajar de cero
  let total = terminos[0];
  for (let k = 0; k < sumas.length; k++) {
    total = sumas[k] === SUMA ? total + terminos[k + 1] : total - terminos[k + 1];
    if (total < 0) return null;
  }
  return total;
}

// ---------- Geometría ----------

/** Índices (en la rejilla m×m) de la fila i y de la columna j. */
const filaDe = (m, i) => Array.from({ length: m }, (_, j) => i * m + j);
const columnaDe = (m, j) => Array.from({ length: m }, (_, i) => i * m + j);

/** Las 2m cuentas: { celdas, operadores, resultado }. */
export function cuentas(t) {
  const lista = [];
  for (let i = 0; i < t.m; i++) lista.push({ tipo: 'fila', n: i, celdas: filaDe(t.m, i), operadores: t.opsFilas[i], resultado: t.resFilas[i] });
  for (let j = 0; j < t.m; j++) lista.push({ tipo: 'columna', n: j, celdas: columnaDe(t.m, j), operadores: t.opsColumnas[j], resultado: t.resColumnas[j] });
  return lista;
}

/** Celda del tablero grande (lado 2m+1) que corresponde al número k de la rejilla. */
export const posicionEnTablero = (m, k) => ({ fila: 2 * Math.floor(k / m), col: 2 * (k % m) });

/**
 * Tablero completo para dibujar: lado = 2m+1. Cada casilla es
 * { tipo: 'numero', k } | { tipo: 'operador', v } | { tipo: 'igual' } | { tipo: 'resultado', v } | { tipo: 'vacia' }.
 */
export function plano(t) {
  const lado = 2 * t.m + 1;
  const casillas = [];
  for (let f = 0; f < lado; f++) {
    for (let c = 0; c < lado; c++) {
      let casilla = { tipo: 'vacia' };
      const fNum = f < 2 * t.m - 1, cNum = c < 2 * t.m - 1;
      if (fNum && cNum) {
        if (f % 2 === 0 && c % 2 === 0) casilla = { tipo: 'numero', k: (f / 2) * t.m + c / 2 };
        else if (f % 2 === 0) casilla = { tipo: 'operador', v: t.opsFilas[f / 2][(c - 1) / 2] };
        else if (c % 2 === 0) casilla = { tipo: 'operador', v: t.opsColumnas[c / 2][(f - 1) / 2] };
      } else if (fNum && f % 2 === 0) {
        casilla = c === lado - 2 ? { tipo: 'igual' } : { tipo: 'resultado', v: t.resFilas[f / 2] };
      } else if (cNum && c % 2 === 0) {
        casilla = f === lado - 2 ? { tipo: 'igual' } : { tipo: 'resultado', v: t.resColumnas[c / 2] };
      }
      casillas.push(casilla);
    }
  }
  return { lado, casillas };
}

// ---------- Generación ----------

function operadoresAlAzar(config, azar) {
  const { m, ops } = config;
  const uno = () => azar.elegir(ops);
  const opsFilas = Array.from({ length: m }, () => Array.from({ length: m - 1 }, uno));
  const opsColumnas = Array.from({ length: m }, () => Array.from({ length: m - 1 }, uno));
  return { opsFilas, opsColumnas };
}

/**
 * Comprobación temprana con una cuenta a medias: las divisiones ya conocidas deben ser
 * exactas (× y ÷ van de izquierda a derecha, así que una división no cambia después).
 */
function prefijoValido(numeros, operadores) {
  let termino = numeros[0];
  for (let k = 0; k < numeros.length - 1; k++) {
    const op = operadores[k], b = numeros[k + 1];
    if (op === POR) termino *= b;
    else if (op === ENTRE) {
      if (termino % b !== 0) return false;
      termino /= b;
    } else termino = b;
  }
  return true;
}

function cuentaValida(valor, config) {
  return valor !== null && valor <= config.resultadoMax;
}

/** Rellena la rejilla con números que cumplan todas las cuentas (vuelta atrás). null si no lo consigue. */
function rellenar(config, opsFilas, opsColumnas, azar, limitePasos = 4000) {
  const { m, max } = config;
  const v = new Array(m * m).fill(0);
  let pasos = 0;
  const valores = Array.from({ length: max }, (_, k) => k + 1);
  const paso = (k) => {
    if (k === m * m) return true;
    if (++pasos > limitePasos) return false;
    const i = Math.floor(k / m), j = k % m;
    for (const n of azar.barajar(valores)) {
      v[k] = n;
      const enFila = filaDe(m, i).slice(0, j + 1).map((x) => v[x]);
      const enColumna = columnaDe(m, j).slice(0, i + 1).map((x) => v[x]);
      if (!prefijoValido(enFila, opsFilas[i]) || !prefijoValido(enColumna, opsColumnas[j])) continue;
      if (j === m - 1 && !cuentaValida(evaluar(enFila, opsFilas[i]), config)) continue;
      if (i === m - 1 && !cuentaValida(evaluar(enColumna, opsColumnas[j]), config)) continue;
      if (paso(k + 1)) return true;
    }
    v[k] = 0;
    return false;
  };
  return paso(0) ? v : null;
}

/**
 * Cuenta las formas de colocar la bandeja (los números que faltan) en los huecos
 * cumpliendo todas las cuentas. Para en `limite`.
 */
export function contarSoluciones(t, valores, huecos, limite = 2) {
  const v = valores.slice();
  const lista = cuentas(t);
  const cuentasDe = huecos.map((k) => lista.filter((c) => c.celdas.includes(k)));
  const bandeja = new Map();
  for (const k of huecos) bandeja.set(t.solucion[k], (bandeja.get(t.solucion[k]) || 0) + 1);
  const disponibles = [...bandeja.keys()];
  let soluciones = 0;
  const paso = (h) => {
    if (h === huecos.length) return ++soluciones >= limite;
    const k = huecos[h];
    for (const n of disponibles) {
      if (!bandeja.get(n)) continue;
      v[k] = n;
      bandeja.set(n, bandeja.get(n) - 1);
      const ok = cuentasDe[h].every((c) => c.celdas.some((x) => v[x] === 0)
        || evaluar(c.celdas.map((x) => v[x]), c.operadores) === c.resultado);
      if (ok && paso(h + 1)) return true;
      bandeja.set(n, bandeja.get(n) + 1);
      v[k] = 0;
    }
    return false;
  };
  for (const k of huecos) v[k] = 0;
  paso(0);
  return soluciones;
}

/**
 * Genera un tablero con solución única.
 * @returns {{ dificultad, m, opsFilas, opsColumnas, resFilas, resColumnas, solucion, huecos }}
 */
export function generarCalculos(dificultad, { azar = crearAzar(), semilla, tiempoMax = 1500, ahora = () => Date.now() } = {}) {
  const config = NIVELES[dificultad];
  if (!config) throw new Error(`Dificultad desconocida: ${dificultad}`);
  if (semilla !== undefined) azar = crearAzar(semilla);
  const limite = ahora() + tiempoMax;
  let mejor = null;

  do {
    const { opsFilas, opsColumnas } = operadoresAlAzar(config, azar);
    // En Medio y más, que haya al menos una multiplicación o división.
    const todos = [...opsFilas.flat(), ...opsColumnas.flat()];
    if (config.ops.length > 2 && !todos.some((o) => o === POR || o === ENTRE)) continue;
    if (config.ops.includes(ENTRE) && !todos.includes(ENTRE)) continue;

    const solucion = rellenar(config, opsFilas, opsColumnas, azar);
    if (!solucion) continue;
    const t = {
      dificultad, m: config.m, opsFilas, opsColumnas, solucion,
      resFilas: Array.from({ length: config.m }, (_, i) => evaluar(filaDe(config.m, i).map((x) => solucion[x]), opsFilas[i])),
      resColumnas: Array.from({ length: config.m }, (_, j) => evaluar(columnaDe(config.m, j).map((x) => solucion[x]), opsColumnas[j])),
    };

    // Quitar números mientras la solución siga siendo única.
    const huecos = [];
    for (const k of azar.barajar([...Array(config.m * config.m).keys()])) {
      if (huecos.length >= config.huecos) break;
      const prueba = [...huecos, k].sort((a, b) => a - b);
      if (contarSoluciones(t, solucion, prueba) === 1) huecos.splice(0, huecos.length, ...prueba);
    }
    const candidato = { ...t, huecos };
    if (huecos.length === config.huecos) return candidato;
    if (!mejor || huecos.length > mejor.huecos.length) mejor = candidato;
  } while (ahora() < limite);
  if (!mejor) throw new Error('No se pudo generar el tablero');
  return mejor;
}

// ---------- Partida ----------

export function crearPartida(t) {
  const valores = t.solucion.map((v, k) => (t.huecos.includes(k) ? 0 : v));
  return { ...t, valores, historial: [], pistas: 0, errores: 0 };
}

export const esHueco = (p, k) => p.huecos.includes(k);
export const esError = (p, k) => esHueco(p, k) && p.valores[k] !== 0 && p.valores[k] !== p.solucion[k];

/** Números que quedan en la bandeja (los que faltan menos los ya colocados), ordenados. */
export function bandeja(p) {
  const quedan = p.huecos.map((k) => p.solucion[k]);
  for (const k of p.huecos) {
    const v = p.valores[k];
    if (v) quedan.splice(quedan.indexOf(v), 1);
  }
  return quedan.sort((a, b) => a - b);
}

/** Coloca n (de la bandeja) en el hueco k. Si ya había otro número, vuelve a la bandeja. */
export function colocar(p, k, n, { esPista = false } = {}) {
  if (!esHueco(p, k) || p.valores[k] === n) return false;
  const disponibles = bandeja(p);
  if (p.valores[k]) disponibles.push(p.valores[k]); // el que se quita vuelve a la bandeja
  if (!disponibles.includes(n)) return false;
  p.historial.push({ k, antes: p.valores[k] });
  p.valores[k] = n;
  if (!esPista && n !== p.solucion[k]) p.errores++;
  return true;
}

export function borrar(p, k) {
  if (!esHueco(p, k) || !p.valores[k]) return false;
  p.historial.push({ k, antes: p.valores[k] });
  p.valores[k] = 0;
  return true;
}

export function deshacer(p) {
  const cambio = p.historial.pop();
  if (!cambio) return -1;
  p.valores[cambio.k] = cambio.antes;
  return cambio.k;
}

/**
 * Pista: coloca el número correcto en el hueco seleccionado (si está vacío o mal),
 * o en el primero pendiente. Si ese número está puesto por error en otro hueco,
 * lo devuelve antes a la bandeja. Devuelve el hueco rellenado o -1.
 */
export function darPista(p, seleccionado = -1) {
  const pendiente = (k) => p.valores[k] !== p.solucion[k];
  const k = seleccionado >= 0 && esHueco(p, seleccionado) && pendiente(seleccionado)
    ? seleccionado
    : p.huecos.find(pendiente);
  if (k === undefined) return -1;
  const n = p.solucion[k];
  if (!bandeja(p).includes(n)) {
    // Si falta en la bandeja es porque está puesto por error en otro hueco: se devuelve.
    const otro = p.huecos.find((x) => x !== k && p.valores[x] === n && p.valores[x] !== p.solucion[x]);
    if (otro !== undefined) borrar(p, otro);
  }
  colocar(p, k, n, { esPista: true });
  p.pistas++;
  return k;
}

/** ¿Están todas las cuentas bien? */
export function resuelto(p) {
  if (p.huecos.some((k) => !p.valores[k])) return false;
  return cuentas(p).every((c) => evaluar(c.celdas.map((x) => p.valores[x]), c.operadores) === c.resultado);
}

export function resumen(p) {
  const puestos = p.huecos.filter((k) => p.valores[k]).length;
  const faltan = p.huecos.length - puestos;
  return {
    progreso: puestos / p.huecos.length,
    texto: faltan === 0 ? 'Todos los números colocados' : faltan === 1 ? 'Falta 1 número' : `Faltan ${faltan} números`,
  };
}
