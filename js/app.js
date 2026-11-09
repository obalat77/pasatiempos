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
import { cargarJuego, JUEGOS } from './juegos/catalogo.js';
import * as inicio from './pantallas/inicio.js';
import * as estadisticas from './pantallas/estadisticas.js';
import * as pantallaAjustes from './pantallas/ajustes.js';

const contenedor = document.getElementById('app');
const PANTALLAS = { '': inicio, estadisticas, ajustes: pantallaAjustes };

let desmontarActual = null;
let turno = 0; // evita que una carga lenta pise una navegación posterior

function navegar(ruta) {
  const destino = `#/${ruta}`;
  if (location.hash === destino) mostrar();
  else location.hash = destino;
}

/** Contexto que reciben las pantallas y los juegos (ESPECIFICACION.md §2.4). */
const ctx = { db: null, ajustes: crearAjustes(), partidas: null, navegar };

async function mostrar() {
  const miTurno = ++turno;
  const ruta = location.hash.replace(/^#\/?/, '');

  try { desmontarActual?.(); } catch (e) { console.error(e); }
  desmontarActual = null;

  // Cada pantalla se monta en su propio hueco: si se navega mientras carga,
  // el hueco viejo ya no está en la página y no estorba.
  const hueco = document.createElement('div');
  contenedor.replaceChildren(hueco);
  window.scrollTo(0, 0);

  const [seccion, id] = ruta.split('/');
  try {
    if (seccion === 'juego' && JUEGOS.some((j) => j.id === id && j.disponible)) {
      const juego = await cargarJuego(id);
      if (miTurno !== turno) return;
      await juego.montar(hueco, ctx);
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

  // Pedir que el navegador no borre los datos por falta de espacio.
  navigator.storage?.persist?.().catch(() => {});

  window.addEventListener('hashchange', mostrar);
  await mostrar();
}

arrancar();
