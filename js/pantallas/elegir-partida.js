// Ventana que aparece al tocar «Jugar» (ESPECIFICACION.md §4.1):
// pregunta la dificultad (recordando la última) y, si hay una partida a medias,
// ofrece seguir con ella.
import { h, dialogo } from '../core/ui.js';
import { DIFICULTADES } from '../juegos/catalogo.js';

const claveUltima = (id) => `${id}.ultimaDificultad`;

/**
 * Devuelve { continuar: true } | { dificultad } | undefined (cancelado).
 * Si el juego no tiene dificultades ni partida a medias, empieza directamente.
 */
export async function elegirPartida(juego, { db, partidas }) {
  const enCurso = await partidas.obtener(juego.id);
  if (!juego.dificultades.length && !enCurso) return { dificultad: null };

  const ultima = (await db.obtener('progreso', claveUltima(juego.id))) ?? juego.dificultades[0];

  const eleccion = await dialogo({
    titulo: juego.nombre,
    contenido: (cerrar) => {
      const partes = [];
      if (enCurso) {
        partes.push(
          h('button', { type: 'button', class: 'boton boton-principal boton-grande boton-ancho',
            on: { click: () => cerrar({ continuar: true }) } },
            'Seguir con la partida empezada'),
          h('p', { class: 'dialogo-nota' },
            [DIFICULTADES[enCurso.dificultad], enCurso.resumen?.detalle].filter(Boolean).join(' · ')),
          h('p', { class: 'dialogo-subtitulo' },
            juego.dificultades.length ? 'O empieza una nueva:' : 'O empieza otra:'));
      } else {
        partes.push(h('p', { class: 'dialogo-subtitulo' }, 'Elige la dificultad'));
      }
      if (juego.dificultades.length) {
        partes.push(h('div', { class: 'dialogo-opciones' }, juego.dificultades.map((dif) =>
          h('button', {
            type: 'button',
            class: `boton boton-grande boton-ancho ${dif === ultima && !enCurso ? 'boton-principal' : 'boton-secundario'}`,
            'aria-label': dif === ultima ? `${DIFICULTADES[dif]} (la última que elegiste)` : DIFICULTADES[dif],
            on: { click: () => cerrar({ dificultad: dif }) },
          }, DIFICULTADES[dif]))));
      } else {
        partes.push(h('button', { type: 'button', class: 'boton boton-secundario boton-grande boton-ancho',
          on: { click: () => cerrar({ dificultad: null }) } }, 'Nueva partida'));
      }
      return h('div', { class: 'dialogo-cuerpo' }, partes);
    },
  });

  if (!eleccion) return undefined;
  if (eleccion.continuar) return eleccion;
  if (eleccion.dificultad) await db.poner('progreso', eleccion.dificultad, claveUltima(juego.id));
  // Empezar una nueva deja la anterior como abandonada.
  if (enCurso) await partidas.cerrar(juego.id, 'abandonada');
  return eleccion;
}
