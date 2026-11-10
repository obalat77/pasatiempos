// Arranque y navegación entre pantallas.
// Rutas (en el hash, para que recargar mantenga la pantalla):
//   #/              Inicio
//   #/estadisticas  Estadísticas
//   #/ajustes       Ajustes
//   #/juego/<id>    Un juego
import { abrirBD } from './core/db.js';
import { crearAjustes } from './core/ajustes.js';
import { crearPartidas } from './core/partidas.js';
import { iniciarTema } from './core/tema.js';
import { iniciarActualizaciones } from './core/actualizacion.js';
import { h } from './core/ui.js';
import { cargarJuego, JUEGOS } from './juegos/catalogo.js';
import * as inicio from './pantallas/inicio.js';
import * as estadisticas from './pantallas/estadisticas.js';
import * as pantallaAjustes from './pantallas/ajustes.js';

const contenedor = document.getElementById('app');
const PANTALLAS = { '': inicio, estadisticas, ajustes: pantallaAjustes };

let desmontarActual = null;
let juegoActual = null; // módulo del juego montado (para guardar antes de actualizar)
let turno = 0; // evita que una carga lenta pise una navegación posterior

function navegar(ruta) {
  const destino = `#/${ruta}`;
  if (location.hash === destino) mostrar();
  else location.hash = destino;
}

/** Partida nueva pedida desde Inicio; el juego la recibe en `ctx.nueva` al montarse. */
let nuevaPendiente = null;

/**
 * Abre un juego. `eleccion`: { continuar: true } para seguir la partida guardada,
 * o { dificultad } para empezar una nueva.
 */
function jugar(id, eleccion = { continuar: true }) {
  nuevaPendiente = eleccion.continuar ? null : { dificultad: eleccion.dificultad ?? null };
  navegar(`juego/${id}`);
}

/**
 * Contexto que reciben las pantallas y los juegos (ESPECIFICACION.md §2.4):
 *   db, ajustes, partidas, navegar(ruta), jugar(id, eleccion)
 * Los juegos reciben además `nueva`: { dificultad } si hay que empezar partida nueva,
 * o null para reanudar la guardada (si no hay, el juego decide).
 */
const ctx = { db: null, ajustes: crearAjustes(), partidas: null, navegar, jugar };

async function mostrar() {
  const miTurno = ++turno;
  const ruta = location.hash.replace(/^#\/?/, '');

  try { desmontarActual?.(); } catch (e) { console.error(e); }
  desmontarActual = null;
  juegoActual = null;

  // Cada pantalla se monta en su propio hueco: si se navega mientras carga,
  // el hueco viejo ya no está en la página y no estorba.
  const hueco = document.createElement('div');
  contenedor.replaceChildren(hueco);
  window.scrollTo(0, 0);

  const [seccion, id] = ruta.split('/');
  try {
    if (seccion === 'juego' && JUEGOS.some((j) => j.id === id && j.disponible)) {
      const nueva = nuevaPendiente;
      nuevaPendiente = null;
      const juego = await cargarJuego(id);
      if (miTurno !== turno) return;
      await juego.montar(hueco, { ...ctx, nueva });
      juegoActual = juego;
      desmontarActual = () => juego.desmontar();
      return;
    }
    const pantalla = PANTALLAS[seccion] || inicio;
    const fin = await pantalla.montar(hueco, ctx);
    if (typeof fin === 'function') {
      if (miTurno === turno) desmontarActual = fin;
      else fin();
    }
  } catch (error) {
    console.error(error);
    hueco.textContent = 'Algo ha fallado. Vuelve a abrir la app.';
  }
}

async function arrancar() {
  ctx.db = await abrirBD();
  ctx.partidas = crearPartidas(ctx.db);
  try {
    await ctx.ajustes.cargar(ctx.db);
  } catch (error) {
    console.error('No se pudieron leer los ajustes', error);
  }
  iniciarTema(ctx.ajustes);
  if (ctx.db.tipo === 'memoria') avisarSinGuardado();

  // Pedir que el navegador no borre los datos por falta de espacio.
  navigator.storage?.persist?.().catch(() => {});

  window.addEventListener('hashchange', mostrar);
  await mostrar();

  // Modo sin conexión y aviso «Hay una versión nueva».
  iniciarActualizaciones(() => juegoActual?.guardar?.());
}

/** IndexedDB no se ha podido abrir: lo que se juegue ahora no se guardará. */
function avisarSinGuardado() {
  document.body.append(h('button', {
    type: 'button',
    class: 'aviso-guardado',
    on: { click: () => location.reload() },
  }, 'No se puede guardar el progreso. Toca para volver a intentarlo.'));
  document.body.classList.add('con-aviso');
}

arrancar();
