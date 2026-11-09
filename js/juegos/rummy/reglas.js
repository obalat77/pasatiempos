// Rummy de fichas (ESPECIFICACION.md §5.5), sin pantalla.
//
// Fichas: 106 = números del 1 al 13 en 4 colores, dos de cada, más 2 comodines.
// Una ficha es un número (su id, 0–105). Con fichaDe(id) se obtiene { id, n, c }:
//   n = 1–13 (0 en el comodín), c = 'r' (rojo) | 'b' (azul) | 'k' (negro) | 'o' (naranja) | null.
// Una combinación es una lista de ids. La mesa es una lista de combinaciones.

export const COLORES = ['r', 'b', 'k', 'o'];
export const NOMBRE_COLOR = { r: 'roja', b: 'azul', k: 'negra', o: 'naranja' };
export const SIMBOLO = { r: '●', b: '▲', k: '■', o: '◆' };
export const COMODINES = [104, 105];
export const VALOR_COMODIN_ATRIL = 30;
export const PRIMERA_BAJADA = 30;
export const FICHAS_INICIALES = 14;

const FICHAS = (() => {
  const lista = [];
  for (let copia = 0; copia < 2; copia++) {
    for (const c of COLORES) for (let n = 1; n <= 13; n++) lista.push({ id: lista.length, n, c });
  }
  lista.push({ id: 104, n: 0, c: null }, { id: 105, n: 0, c: null });
  return lista;
})();

export const fichaDe = (id) => FICHAS[id];
export const esComodin = (id) => id >= 104;
export const todasLasFichas = () => FICHAS.map((f) => f.id);

/** Nombre para leer en voz alta: «7 roja», «comodín». */
export const nombreFicha = (id) => (esComodin(id) ? 'comodín' : `${fichaDe(id).n} ${NOMBRE_COLOR[fichaDe(id).c]}`);

// ---------- Combinaciones ----------

/**
 * Analiza una combinación. Devuelve null si no es válida, o
 * { tipo: 'serie'|'escalera', orden: [ids en orden para mostrar], puntos, representa: Map(idComodín → {n, c}) }.
 * - Serie: 3 o 4 fichas del mismo número y colores distintos (los comodines completan colores).
 * - Escalera: 3 o más números seguidos del mismo color, sin pasar del 13 al 1.
 * Si una combinación vale de las dos formas (p. ej. una ficha y dos comodines), se toma la de más puntos.
 */
export function analizar(ids) {
  if (ids.length < 3) return null;
  const comodines = ids.filter(esComodin);
  const normales = ids.filter((id) => !esComodin(id)).map(fichaDe);
  if (!normales.length) return null;
  const opciones = [analizarSerie(normales, comodines), analizarEscalera(normales, comodines)].filter(Boolean);
  if (!opciones.length) return null;
  return opciones.sort((a, b) => b.puntos - a.puntos)[0];
}

function analizarSerie(normales, comodines) {
  const total = normales.length + comodines.length;
  if (total > 4) return null;
  const n = normales[0].n;
  if (normales.some((f) => f.n !== n)) return null;
  const colores = new Set(normales.map((f) => f.c));
  if (colores.size !== normales.length) return null;
  const libres = COLORES.filter((c) => !colores.has(c));
  const representa = new Map(comodines.map((j, i) => [j, { n, c: libres[i] }]));
  const orden = [...normales.sort((a, b) => COLORES.indexOf(a.c) - COLORES.indexOf(b.c)).map((f) => f.id), ...comodines];
  return { tipo: 'serie', orden, puntos: n * total, representa };
}

function analizarEscalera(normales, comodines) {
  const c = normales[0].c;
  if (normales.some((f) => f.c !== c)) return null;
  const ordenadas = [...normales].sort((a, b) => a.n - b.n);
  for (let i = 1; i < ordenadas.length; i++) if (ordenadas[i].n === ordenadas[i - 1].n) return null;
  const min = ordenadas[0].n, max = ordenadas.at(-1).n;
  const huecos = max - min + 1 - ordenadas.length;
  if (huecos > comodines.length) return null;
  const total = ordenadas.length + comodines.length;
  if (total > 13) return null;
  // Los comodines sobrantes alargan por arriba (o por abajo si no caben)
  let sobran = comodines.length - huecos;
  let alto = max, bajo = min;
  while (sobran > 0 && alto < 13) { alto++; sobran--; }
  while (sobran > 0 && bajo > 1) { bajo--; sobran--; }
  const pendientes = [...comodines];
  const orden = [];
  const representa = new Map();
  let puntos = 0;
  for (let n = bajo; n <= alto; n++) {
    const f = ordenadas.find((x) => x.n === n);
    if (f) orden.push(f.id);
    else { const j = pendientes.shift(); orden.push(j); representa.set(j, { n, c }); }
    puntos += n;
  }
  return { tipo: 'escalera', orden, puntos, representa };
}

export const esValida = (ids) => analizar(ids) !== null;
export const puntosDe = (ids) => analizar(ids)?.puntos ?? 0;

/** Puntos de las fichas que quedan en un atril (comodín = 30). */
export const puntosAtril = (ids) => ids.reduce((s, id) => s + (esComodin(id) ? VALOR_COMODIN_ATRIL : fichaDe(id).n), 0);

// ---------- Partida ----------

export const NOMBRES = ['Tú', 'Lola', 'Paco', 'Carmen']; // abajo, izquierda, arriba, derecha

/** Reparte: 14 fichas a cada jugador; empieza uno al azar. */
export function crearPartida({ azar, nivel = 'intermedio' }) {
  const pozo = azar.barajar(todasLasFichas());
  const jugadores = NOMBRES.map((nombre) => ({ nombre, atril: pozo.splice(0, FICHAS_INICIALES), bajado: false }));
  return {
    nivel,
    jugadores,
    mesa: [],
    pozo,
    turno: azar.entero(0, 3),
    pasesSeguidos: 0,      // turnos seguidos sin jugar ni robar (pozo vacío)
    terminada: false,
    ganador: null,
  };
}

/** Clave de una mesa para comparar contenidos (sin importar el orden de las combinaciones). */
const claveMesa = (mesa) => mesa.map((c) => [...c].sort((a, b) => a - b).join(',')).sort().join('|');

/**
 * ¿Es válido terminar el turno pasando de (mesaAntes, atrilAntes) a (mesa, atril)?
 * Devuelve null si sí, o el motivo:
 *  'invalida'     hay una combinación no válida en la mesa
 *  'sin-fichas'   no se ha puesto ninguna ficha propia
 *  'fichas'       la mesa ha perdido fichas o han aparecido fichas que no eran del atril
 *  'primera'      la primera bajada no llega a 30 puntos (o toca la mesa)
 */
export function motivoTurnoNoValido({ mesaAntes, atrilAntes, mesa, atril, bajado }) {
  const antes = new Set(mesaAntes.flat());
  const ahora = mesa.flat();
  const puestas = ahora.filter((id) => !antes.has(id));
  // Las fichas de la mesa no pueden volver al atril y solo puede bajar fichas del atril
  if (ahora.length !== new Set(ahora).size) return 'fichas';
  if ([...antes].some((id) => !ahora.includes(id))) return 'fichas';
  if (puestas.some((id) => !atrilAntes.includes(id))) return 'fichas';
  if (atril.length !== atrilAntes.length - puestas.length || atril.some((id) => !atrilAntes.includes(id) || ahora.includes(id))) return 'fichas';
  if (mesa.some((c) => !esValida(c))) return 'invalida';
  if (!puestas.length) return 'sin-fichas';
  if (!bajado) {
    // Primera bajada: combinaciones nuevas solo con fichas propias, sin tocar las de la mesa.
    const originales = mesa.filter((c) => c.every((id) => antes.has(id)));
    if (claveMesa(originales) !== claveMesa(mesaAntes)) return 'primera';
    const nuevas = mesa.filter((c) => c.some((id) => !antes.has(id)));
    if (nuevas.some((c) => c.some((id) => antes.has(id)))) return 'primera';
    if (nuevas.reduce((s, c) => s + puntosDe(c), 0) < PRIMERA_BAJADA) return 'primera';
  }
  return null;
}

/** Puntos de la primera bajada que se está preparando (combinaciones nuevas, solo con fichas propias). */
export function puntosBajada(mesaAntes, mesa) {
  const antes = new Set(mesaAntes.flat());
  return mesa.filter((c) => c.every((id) => !antes.has(id)) && esValida(c)).reduce((s, c) => s + puntosDe(c), 0);
}

/** Aplica un turno ya validado: nueva mesa y atril; si se ha quedado sin fichas, gana. */
export function aplicarJugada(p, j, mesa, atril) {
  const jugador = p.jugadores[j];
  jugador.atril = atril;
  jugador.bajado = true;
  p.mesa = mesa.map((c) => analizar(c).orden);
  p.pasesSeguidos = 0;
  if (!atril.length) terminar(p, j);
  else siguienteTurno(p);
}

/** Roba una ficha (o pasa si el pozo está vacío). */
export function robar(p, j) {
  const jugador = p.jugadores[j];
  const ficha = p.pozo.shift();
  if (ficha !== undefined) { jugador.atril.push(ficha); p.pasesSeguidos = 0; }
  else p.pasesSeguidos++;
  // Pozo vacío y una vuelta entera sin que nadie juegue: gana quien tenga menos puntos.
  if (!p.pozo.length && p.pasesSeguidos >= p.jugadores.length) {
    const puntos = p.jugadores.map((x) => puntosAtril(x.atril));
    terminar(p, puntos.indexOf(Math.min(...puntos)));
  } else siguienteTurno(p);
  return ficha;
}

function siguienteTurno(p) {
  p.turno = (p.turno + 1) % p.jugadores.length;
}

/** Puntuación final: cada perdedor resta lo que tiene en el atril; el ganador suma el total. */
function terminar(p, ganador) {
  p.terminada = true;
  p.ganador = ganador;
  const restas = p.jugadores.map((x, i) => (i === ganador ? 0 : puntosAtril(x.atril)));
  const total = restas.reduce((s, x) => s + x, 0);
  p.puntos = p.jugadores.map((_, i) => (i === ganador ? total : -restas[i]));
}

// ---------- Atril ----------

const ordenNumero = (a, b) => {
  const fa = fichaDe(a), fb = fichaDe(b);
  if (esComodin(a) !== esComodin(b)) return esComodin(a) ? 1 : -1;
  return fa.n - fb.n || COLORES.indexOf(fa.c) - COLORES.indexOf(fb.c) || a - b;
};
const ordenColor = (a, b) => {
  const fa = fichaDe(a), fb = fichaDe(b);
  if (esComodin(a) !== esComodin(b)) return esComodin(a) ? 1 : -1;
  return COLORES.indexOf(fa.c) - COLORES.indexOf(fb.c) || fa.n - fb.n || a - b;
};
export const ordenarPorNumero = (atril) => [...atril].sort(ordenNumero);
export const ordenarPorColor = (atril) => [...atril].sort(ordenColor);
