// Cálculo de estadísticas a partir de `resultados` (ESPECIFICACION.md §4.2).
// Funciones puras: no tocan la base de datos ni el navegador.

const EXITO = new Set(['terminada', 'ganada']);

export const esExito = (r) => EXITO.has(r.resultado);

function claveDia(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Días seguidos con al menos una partida terminada o ganada.
 * La racha sigue viva si la última fue hoy o ayer (hoy aún se puede jugar).
 */
export function rachaActual(resultados, hoy = new Date()) {
  const dias = new Set(resultados.filter(esExito).map((r) => claveDia(r.fin)));
  const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12);
  if (!dias.has(claveDia(dia.getTime()))) dia.setDate(dia.getDate() - 1);
  let racha = 0;
  while (dias.has(claveDia(dia.getTime()))) {
    racha++;
    dia.setDate(dia.getDate() - 1);
  }
  return racha;
}

/**
 * Estadísticas de un juego.
 * @param {Array} resultados  filas de `resultados` (de cualquier juego; se filtran)
 * @param {string} juego
 * @param {Date} hoy
 * @returns {{
 *   jugadas: number, exitos: number, racha: number, tiempoTotal: number,
 *   mejorTiempo: Object<string, number>,   // dificultad → segundos (solo las que tienen)
 *   ultimas: Array                          // 5 como máximo, la más reciente primero
 * }}
 */
export function calcularEstadisticas(resultados, juego, hoy = new Date()) {
  const propias = resultados.filter((r) => r.juego === juego);
  const exitos = propias.filter(esExito);

  const mejorTiempo = {};
  for (const r of exitos) {
    const dif = r.dificultad ?? 'unica';
    if (r.duracionSeg > 0 && (mejorTiempo[dif] === undefined || r.duracionSeg < mejorTiempo[dif])) {
      mejorTiempo[dif] = r.duracionSeg;
    }
  }

  return {
    jugadas: propias.length,
    exitos: exitos.length,
    racha: rachaActual(propias, hoy),
    tiempoTotal: propias.reduce((s, r) => s + (r.duracionSeg || 0), 0),
    mejorTiempo,
    ultimas: [...propias].sort((a, b) => b.fin - a.fin).slice(0, 5),
  };
}
