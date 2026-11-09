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

/** Estadísticas de un juego por niveles (Palabras): nivel alcanzado y palabras extra. */
function contenidoNiveles(juego, resultados) {
  const e = calcularEstadisticas(resultados, juego.id, new Date());
  const propias = resultados.filter((r) => r.juego === juego.id && r.resultado === 'terminada');
  const nivel = Math.max(0, ...propias.map((r) => r.detalles?.nivel || 0));
  const extras = propias.reduce((s, r) => s + (r.detalles?.extras || 0), 0);
  const cifras = h('section', { class: 'cifras-grid', 'aria-label': 'Resumen' },
    cifra(nivel ? numero(nivel) : '—', 'Último nivel completado'),
    cifra(numero(extras), 'Palabras extra'),
    cifra(e.racha === 1 ? '1 día' : `${numero(e.racha)} días`, 'Racha actual'),
    cifra(duracionTexto(e.tiempoTotal).replace(/(\d) (h|min)/g, '$1\u00a0$2'), 'Tiempo total', true));
  const ultimas = e.ultimas.map((r) => h('div', { class: 'lista-fila' },
    h('span', {}, `${fechaRelativa(new Date(r.fin))} · Nivel ${numero(r.detalles?.nivel || 0)}`),
    h('span', { class: 'lista-derecha' },
      h('span', { class: 'negrita cifras' }, tiempo(r.duracionSeg)),
      h('span', { class: 'resultado-exito' }, juego.resultados?.[r.resultado] || NOMBRE_RESULTADO[r.resultado]))));
  return h('div', { class: 'estadisticas-cuerpo' },
    cifras,
    h('div', { class: 'estadisticas-listas' },
      lista('Últimos niveles', ultimas, 'Aún no has completado ningún nivel.')));
}

const NIVEL_RUMMY = { principiante: 'Principiante', intermedio: 'Intermedio', experto: 'Experto' };

/** Estadísticas del Rummy: partidas ganadas por cada jugador y puntos (ESPECIFICACION.md §4.2). */
function contenidoRummy(juego, resultados) {
  const e = calcularEstadisticas(resultados, juego.id, new Date());
  const propias = resultados.filter((r) => r.juego === juego.id && r.detalles?.nombres);
  const nombres = propias[0]?.detalles.nombres || ['Tú', 'Lola', 'Paco', 'Carmen'];
  const ganadas = nombres.map((_, i) => propias.filter((r) => r.detalles.ganador === i).length);
  const puntos = nombres.map((_, i) => propias.reduce((s, r) => s + (r.detalles.puntos?.[i] || 0), 0));
  const signo = (n) => `${n > 0 ? '+' : ''}${numero(n)}`;

  const cifras = h('section', { class: 'cifras-grid', 'aria-label': 'Resumen' },
    cifra(numero(e.jugadas), 'Partidas jugadas'),
    cifra(numero(e.exitos), 'Partidas ganadas'),
    cifra(e.racha === 1 ? '1 día' : `${numero(e.racha)} días`, 'Racha actual'),
    cifra(duracionTexto(e.tiempoTotal).replace(/(\d) (h|min)/g, '$1\u00a0$2'), 'Tiempo total', true));
  const porJugador = nombres.map((n, i) => h('div', { class: 'lista-fila' },
    h('span', { class: i === 0 ? 'negrita' : null }, n),
    h('span', { class: 'lista-derecha' },
      h('span', {}, ganadas[i] === 1 ? '1 ganada' : `${numero(ganadas[i])} ganadas`),
      h('span', { class: 'negrita cifras' }, `${signo(puntos[i])} puntos`))));
  const ultimas = e.ultimas.map((r) => {
    const ganador = r.detalles?.nombres?.[r.detalles.ganador];
    return h('div', { class: 'lista-fila' },
      h('span', {}, [fechaRelativa(new Date(r.fin)), NIVEL_RUMMY[r.detalles?.nivel]].filter(Boolean).join(' · ')),
      h('span', { class: 'lista-derecha' },
        h('span', { class: 'negrita cifras' }, tiempo(r.duracionSeg)),
        h('span', { class: esExito(r) ? 'resultado-exito' : 'texto-2' },
          esExito(r) ? 'Ganada' : ganador ? `Ganó ${ganador}` : 'Perdida')));
  });
  return h('div', { class: 'estadisticas-cuerpo' },
    cifras,
    h('div', { class: 'estadisticas-listas' },
      lista('Por jugador', propias.length ? porJugador : [], 'Aún no has jugado ninguna partida.'),
      lista('Últimas partidas', ultimas, 'Aún no has jugado ninguna partida.')));
}

function contenido(juego, resultados) {
  if (juego.porNiveles) return contenidoNiveles(juego, resultados);
  if (juego.estadisticasRummy) return contenidoRummy(juego, resultados);
  const e = calcularEstadisticas(resultados, juego.id, new Date());

  const cifras = h('section', { class: 'cifras-grid', 'aria-label': 'Resumen' },
    cifra(numero(e.jugadas), 'Partidas jugadas'),
    cifra(numero(e.exitos), juego.exito === 'ganadas' ? 'Partidas ganadas' : 'Partidas terminadas'),
    cifra(e.racha === 1 ? '1 día' : `${numero(e.racha)} días`, 'Racha actual'),
    // Espacio duro entre número y unidad: si no cabe, salta entre «12 h» y «30 min».
    cifra(duracionTexto(e.tiempoTotal).replace(/(\d) (h|min)/g, '$1\u00a0$2'), 'Tiempo total', true));

  const dificultades = juego.dificultades.length ? juego.dificultades : ['unica'];
  const mejores = dificultades.map((dif) => {
    const t = e.mejorTiempo[dif];
    return h('div', { class: 'lista-fila' },
      h('span', {}, DIFICULTADES[dif] || 'Partida más rápida'),
      t === undefined
        ? h('span', { class: 'texto-2' }, 'Sin partidas')
        : h('span', { class: 'negrita cifras' }, tiempo(t)));
  });

  const ultimas = e.ultimas.map((r) => h('div', { class: 'lista-fila' },
    h('span', {}, [fechaRelativa(new Date(r.fin)), r.dificultad ? DIFICULTADES[r.dificultad] : null]
      .filter(Boolean).join(' · ')),
    h('span', { class: 'lista-derecha' },
      h('span', { class: 'negrita cifras' }, tiempo(r.duracionSeg)),
      h('span', { class: esExito(r) ? 'resultado-exito' : 'texto-2' },
        juego.resultados?.[r.resultado] || NOMBRE_RESULTADO[r.resultado] || r.resultado))));

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
