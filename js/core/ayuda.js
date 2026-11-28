// Ayuda de cada juego (ESPECIFICACION.md §5.6): botón «?» a la derecha de la barra y
// ventana con instrucciones sencillas. Los textos están en js/juegos/<juego>/ayuda.js.
//
// Formato de los textos: { titulo, secciones: [{ titulo, texto? , pasos?: [], puntos?: [] }] }
//   texto  → un párrafo; pasos → lista numerada; puntos → lista sin números.
import { h, icono, dialogo } from './ui.js';

/** Ventana con la ayuda. `clase`: la del juego (p. ej. 'juego-sudoku'), para su color. */
export function mostrarAyuda(ayuda, clase = '') {
  return dialogo({
    titulo: ayuda.titulo,
    clase: `${clase} dialogo-ayuda`.trim(),
    contenido: () => h('div', { class: 'dialogo-cuerpo ayuda' }, ayuda.secciones.map((s) => h('section', {},
      h('h3', {}, s.titulo),
      s.texto ? h('p', {}, s.texto) : null,
      s.pasos ? h('ol', {}, s.pasos.map((x) => h('li', {}, x))) : null,
      s.puntos ? h('ul', {}, s.puntos.map((x) => h('li', {}, x))) : null))),
  });
}

/**
 * Botón «Ayuda» para la barra. Mientras la ventana está abierta la partida queda en pausa:
 * `alAbrir` para el reloj y `alCerrar` lo vuelve a poner en marcha.
 */
export function botonAyuda({ ayuda, clase = '', alAbrir = () => {}, alCerrar = () => {} }) {
  // Solo el «?», grande (a petición del usuario: excepción a «botones con texto»); el lector de
  // pantalla dice «Ayuda»
  return h('button', {
    type: 'button', class: 'boton-ayuda', 'aria-label': 'Ayuda', title: 'Ayuda',
    on: { click: async () => { alAbrir(); await mostrarAyuda(ayuda, clase); alCerrar(); } },
  }, icono('ayuda', 2));
}
