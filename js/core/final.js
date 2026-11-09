// Tarjeta del final de partida (ESPECIFICACION.md §4.4): sencilla, sin animaciones,
// con el tiempo, un dato destacado y los botones «Otra partida» e «Inicio».
import { h } from './ui.js';
import { tiempo } from './formato.js';

/**
 * @param {{ titulo: string, texto: string, segundos?: number, destacado?: string,
 *           alOtraPartida: () => void, alInicio: () => void, textoOtra?: string }} opciones
 */
export function tarjetaFinal({ titulo, texto, segundos, destacado, alOtraPartida, alInicio, textoOtra = 'Otra partida' }) {
  return h('section', { class: 'tarjeta-final', role: 'status' },
    h('h2', {}, titulo),
    h('p', {}, texto),
    segundos !== undefined ? h('p', { class: 'tiempo-final' }, tiempo(segundos)) : null,
    destacado ? h('p', { class: 'destacado' }, destacado) : null,
    h('div', { class: 'botones' },
      h('button', { type: 'button', class: 'boton boton-principal', on: { click: alOtraPartida } }, textoOtra),
      h('button', { type: 'button', class: 'boton boton-secundario', on: { click: alInicio } }, 'Inicio')));
}

/** «¡Nuevo mejor tiempo!», «Sin usar ninguna pista», «Con 1 pista», «Con 3 pistas». */
export function datoDestacado({ record, pistas }) {
  if (record) return '¡Nuevo mejor tiempo!';
  if (!pistas) return 'Sin usar ninguna pista';
  return pistas === 1 ? 'Con 1 pista' : `Con ${pistas} pistas`;
}

/** ¿Es `segundos` mejor que todos los tiempos anteriores con éxito? (falso si no había ninguno) */
export function esRecord(segundos, anteriores) {
  return anteriores.length > 0 && anteriores.every((r) => segundos < r.duracionSeg);
}
