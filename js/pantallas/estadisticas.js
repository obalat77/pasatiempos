// Pantalla de Estadísticas (ESPECIFICACION.md §4.2; diseños Stats-*).
import { h, botonInicio, segmentado } from '../core/ui.js';
import { calcularEstadisticas, esExito } from '../core/estadisticas.js';
import { fechaRelativa, numero, tiempo, duracionTexto } from '../core/formato.js';
import { DIFICULTADES, juegosDisponibles, buscarJuego } from '../juegos/catalogo.js';

// Juego elegido en el selector; se recuerda mientras la app esté abierta.
let juegoElegido = null;

const NOMBRE_RESULTADO = { terminada: 'Terminada', ganada: 'Ganada', abandonada: 'Abandonada', perdida: 'Perdida' };

function cifra(valor, etiqueta, pequena = false) {
  return h('div', { class: 'cifra' },
    h('span', { class: `cifra-valor cifras${pequena ? ' cifra-larga' : ''}` }, valor),
    h('span', { class: 'cifra-etiqueta' }, etiqueta));
}

function lista(titulo, filas, vacia) {
  return h('section', { class: 'bloque-lista' },
    h('h2', {}, titulo),
    h('div', { class: 'lista' }, filas.length ? filas : h('div', { class: 'lista-fila texto-2' }, vacia)));
}

function contenido(juego, resultados) {
  const e = calcularEstadisticas(resultados, juego.id, new Date());

  const cifras = h('section', { class: 'cifras-grid', 'aria-label': 'Resumen' },
    cifra(numero(e.jugadas), 'Partidas jugadas'),
    cifra(numero(e.exitos), juego.exito === 'ganadas' ? 'Partidas ganadas' : 'Partidas terminadas'),
    cifra(e.racha === 1 ? '1 día' : `${numero(e.racha)} días`, 'Racha actual'),
    cifra(duracionTexto(e.tiempoTotal), 'Tiempo total', true));

  const dificultades = juego.dificultades.length ? juego.dificultades : ['unica'];
  const mejores = dificultades.map((dif) => {
    const t = e.mejorTiempo[dif];
    return h('div', { class: 'lista-fila' },
      h('span', {}, DIFICULTADES[dif] || 'Mejor tiempo'),
      t === undefined
        ? h('span', { class: 'texto-2' }, 'Sin partidas')
        : h('span', { class: 'negrita cifras' }, tiempo(t)));
  });

  const ultimas = e.ultimas.map((r) => h('div', { class: 'lista-fila' },
    h('span', {}, [fechaRelativa(new Date(r.fin)), r.dificultad ? DIFICULTADES[r.dificultad] : null]
      .filter(Boolean).join(' · ')),
    h('span', { class: 'lista-derecha' },
      h('span', { class: 'negrita cifras' }, tiempo(r.duracionSeg)),
      h('span', { class: esExito(r) ? 'resultado-exito' : 'texto-2' }, NOMBRE_RESULTADO[r.resultado] || r.resultado))));

  return h('div', { class: 'estadisticas-cuerpo' },
    cifras,
    h('div', { class: 'estadisticas-listas' },
      lista('Mejor tiempo', mejores, 'Sin partidas'),
      lista('Últimas partidas', ultimas, 'Aún no has jugado ninguna partida.')));
}

export async function montar(contenedor, { navegar, partidas }) {
  const disponibles = juegosDisponibles();
  if (!juegoElegido || !disponibles.some((j) => j.id === juegoElegido)) juegoElegido = disponibles[0].id;

  const resultados = await partidas.resultados();
  const titulo = h('h1', { class: 'titulo-pantalla' });
  const zona = h('div', { class: 'estadisticas-zona' });

  const pintar = () => {
    const juego = buscarJuego(juegoElegido);
    // Con un solo juego no hay selector: el nombre va en el título.
    titulo.textContent = disponibles.length > 1 ? 'Estadísticas' : `Estadísticas · ${juego.nombre}`;
    zona.replaceChildren(contenido(juego, resultados));
  };

  const selector = disponibles.length > 1
    ? segmentado('Juego', disponibles.map((j) => ({ valor: j.id, texto: j.nombreCorto })), juegoElegido,
        (id) => { juegoElegido = id; pintar(); })
    : null;
  selector?.classList.add('selector-juego');

  pintar();
  contenedor.append(h('div', { class: 'pantalla estadisticas' },
    h('header', { class: 'cabecera-pantalla cabecera-estadisticas' },
      botonInicio(() => navegar('')), titulo, selector),
    zona));
}
