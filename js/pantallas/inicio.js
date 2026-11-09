// Pantalla de Inicio (ESPECIFICACION.md §4.1; diseños Main / Home-H-Light).
import { h, icono } from '../core/ui.js';
import { fechaLarga } from '../core/formato.js';
import { JUEGOS } from '../juegos/catalogo.js';

function iconoJuego(id) {
  const base = { class: `icono-juego icono-${id}`, 'aria-hidden': 'true' };
  switch (id) {
    case 'sudoku':
      return h('div', base, [1, 0, 0, 0, 1, 0, 0, 0, 1].map((v) => h('span', { class: v ? 'lleno' : null })));
    case 'palabras':
      return h('div', base,
        h('span', { style: { left: '31px', top: '5px' } }, 'A'),
        h('span', { style: { left: '53px', top: '26px' } }, 'M'),
        h('span', { style: { left: '31px', top: '47px' } }, 'O'),
        h('span', { style: { left: '7px', top: '26px' } }, 'R'));
    case 'parejas':
      return h('div', base, h('span', {}, '3'), h('span', {}, '7'));
    case 'calculos':
      return h('div', base, '2+3');
    case 'rummy':
      return h('div', base, h('span', {}, '7'), h('span', {}, '8'), h('span', {}, '9'));
    default:
      return h('div', base);
  }
}

function tarjetaJuego(juego, navegar) {
  const boton = juego.disponible
    ? h('button', { type: 'button', class: 'boton boton-secundario', 'aria-label': `Jugar a ${juego.nombre}`,
        on: { click: () => navegar(`juego/${juego.id}`) } }, 'Jugar')
    : h('span', { class: 'juego-sub' }, 'Próximamente');
  return h('div', { class: 'juego' },
    iconoJuego(juego.id),
    h('div', { class: 'juego-texto' },
      h('span', { class: 'juego-nombre' }, juego.nombre),
      juego.subtituloCorto
        ? [h('span', { class: 'juego-sub solo-vertical' }, juego.subtitulo),
           h('span', { class: 'juego-sub solo-horizontal' }, juego.subtituloCorto)]
        : h('span', { class: 'juego-sub' }, juego.subtitulo)),
    boton);
}

export function montar(contenedor, { navegar }) {
  const cabecera = h('header', { class: 'inicio-cabecera' },
    h('div', { class: 'logo', 'aria-hidden': 'true' }, 'P'),
    h('div', {},
      h('h1', {}, 'Pasatiempos'),
      h('p', {}, fechaLarga(new Date()))));

  // «Continuar partida» se añade en el paso 2, cuando haya partidas guardadas.

  const nav = h('nav', { class: 'inicio-nav', 'aria-label': 'Otras pantallas' },
    h('button', { type: 'button', class: 'boton boton-claro', on: { click: () => navegar('estadisticas') } },
      icono('estadisticas'), 'Estadísticas'),
    h('button', { type: 'button', class: 'boton boton-claro', on: { click: () => navegar('ajustes') } },
      icono('ajustes'), 'Ajustes'));

  const juegos = h('section', { class: 'juegos', 'aria-labelledby': 'titulo-juegos' },
    h('h2', { class: 'titulo-seccion', id: 'titulo-juegos' }, 'Juegos'),
    JUEGOS.map((j) => tarjetaJuego(j, navegar)));

  contenedor.append(h('div', { class: 'pantalla inicio' },
    h('div', { class: 'inicio-izquierda' }, cabecera, nav),
    juegos));
}
