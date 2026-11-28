// Pantalla de Inicio (ESPECIFICACION.md §4.1 y §3.3, v1.6: baldosas de colores por juego;
// referencia visual diseno/estilo-a.html).
import { h, icono } from '../core/ui.js';
import { fechaLarga } from '../core/formato.js';
import { JUEGOS } from '../juegos/catalogo.js';
import { elegirPartida } from './elegir-partida.js';

/** Dibujo de cada juego (decorativo: lo lee el nombre de la baldosa). */
function iconoJuego(id) {
  const base = { class: `icono-juego icono-${id}`, 'aria-hidden': 'true' };
  switch (id) {
    case 'sudoku':
      return h('div', base, ['5', '', '3', '', '8', '', '1', '', '9'].map((n, i) =>
        h('span', { class: i % 4 === 0 ? 'lleno' : null }, n)));
    case 'palabras':
      return h('div', base,
        h('span', { style: { left: '50%', top: '22%' } }, 'A'),
        h('span', { style: { left: '80%', top: '55%' } }, 'M'),
        h('span', { style: { left: '50%', top: '83%' } }, 'O'),
        h('span', { style: { left: '20%', top: '55%' } }, 'R'));
    case 'parejas':
      return h('div', base, h('span', {}, '3'), h('span', {}, '7'));
    case 'calculos':
      return h('div', base, h('span', {}, '2+3'));
    case 'rummy':
      return h('div', base, ['7', '8', '9'].map((n) => h('span', { class: 'mini-ficha rojo' }, n, h('i', {}, '●'))));
    default:
      return h('div', base);
  }
}

function baldosa(juego, ctx) {
  const contenido = (sub) => [
    iconoJuego(juego.id),
    h('span', { class: 'baldosa-texto' },
      h('span', { class: 'baldosa-nombre' }, juego.nombre),
      sub),
  ];
  // En horizontal la baldosa es más baja: subtítulo corto si lo hay.
  const sub = juego.subtituloCorto
    ? [h('span', { class: 'baldosa-sub solo-vertical' }, juego.subtitulo),
       h('span', { class: 'baldosa-sub solo-horizontal' }, juego.subtituloCorto)]
    : h('span', { class: 'baldosa-sub' }, juego.subtitulo);
  if (!juego.disponible) {
    return h('div', { class: `baldosa juego-${juego.id}` }, contenido(sub),
      h('span', { class: 'baldosa-jugar' }, 'Próximamente'));
  }
  return h('button', {
    type: 'button', class: `baldosa juego-${juego.id}`, 'aria-label': `Jugar a ${juego.nombre}`,
    on: { click: async () => {
      if (juego.sinEleccion) { ctx.jugar(juego.id); return; }
      const eleccion = await elegirPartida(juego, ctx);
      if (eleccion) ctx.jugar(juego.id, eleccion);
    } },
  }, contenido(sub), h('span', { class: 'baldosa-jugar', 'aria-hidden': 'true' }, 'Jugar'));
}

function tarjetaContinuar(partida, jugar) {
  const juego = JUEGOS.find((j) => j.id === partida.juego);
  const { titulo, detalle, progreso, muestra } = partida.resumen || {};
  const porcentaje = Math.round(Math.min(1, Math.max(0, progreso ?? 0)) * 100);
  // Rummy con fichas guardadas: sobre el tapete y con las fichas. El resto: color del juego y progreso.
  const conFichas = juego.id === 'rummy' && Array.isArray(muestra) && muestra.length > 0;
  const indicador = conFichas
    ? h('div', { class: 'continuar-fichas', 'aria-hidden': 'true' },
        muestra.map((f) => h('span', { class: `mini-ficha ${{ r: 'rojo', b: 'azul', k: 'negro', o: 'verde' }[f.c] || ''}` },
          String(f.n), h('i', {}, f.simbolo || ''))))
    : h('div', { class: 'progreso', role: 'progressbar', 'aria-label': 'Progreso de la partida',
        'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(porcentaje) },
        h('span', { style: { width: `${porcentaje}%` } }));
  return h('section', {
    class: `continuar juego-${juego.id}${conFichas ? ' continuar-tapete' : ''}`, 'aria-labelledby': 'titulo-continuar',
  },
    h('div', { class: 'continuar-texto' },
      h('p', { class: 'etiqueta' }, 'Continuar partida'),
      h('h2', { id: 'titulo-continuar' }, titulo || juego.nombre),
      detalle ? h('p', {}, detalle) : null),
    h('button', { type: 'button', class: 'boton continuar-reanudar',
      on: { click: () => jugar(juego.id) } }, 'Reanudar'),
    indicador);
}

export async function montar(contenedor, ctx) {
  const { navegar, partidas } = ctx;
  const cabecera = h('header', { class: 'inicio-cabecera' },
    h('h1', {}, 'Pasatiempos'),
    h('p', {}, fechaLarga(new Date())));

  // «Continuar partida»: la más reciente de un juego disponible.
  let continuar = null;
  try {
    const partida = await partidas.masReciente();
    if (partida && JUEGOS.some((j) => j.id === partida.juego && j.disponible)) {
      continuar = tarjetaContinuar(partida, ctx.jugar);
    }
  } catch (error) {
    console.error('No se pudo leer la partida en curso', error);
  }

  const nav = h('nav', { class: 'inicio-nav', 'aria-label': 'Otras pantallas' },
    h('button', { type: 'button', class: 'boton boton-claro', on: { click: () => navegar('estadisticas') } },
      icono('estadisticas'), 'Estadísticas'),
    h('button', { type: 'button', class: 'boton boton-claro', on: { click: () => navegar('ajustes') } },
      icono('ajustes'), 'Ajustes'));

  // Subtítulos que dependen del progreso (p. ej. «Nivel 3 de 1.000»)
  const baldosas = JUEGOS.map((j) => baldosa(j, ctx));
  await Promise.all(JUEGOS.map(async (j, i) => {
    if (!j.disponible || !j.subtituloDinamico) return;
    try {
      const texto = await j.subtituloDinamico(ctx.db);
      baldosas[i].querySelectorAll('.baldosa-sub').forEach((el) => { el.textContent = texto; });
    } catch (e) { console.error(e); }
  }));

  const juegos = h('section', { class: 'juegos', 'aria-labelledby': 'titulo-juegos' },
    h('h2', { class: 'solo-lectores', id: 'titulo-juegos' }, 'Juegos'),
    baldosas);

  contenedor.append(h('div', { class: 'pantalla inicio' },
    h('div', { class: 'inicio-izquierda' }, cabecera, continuar, nav),
    juegos));
}
