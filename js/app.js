// Arranque y navegación entre pantallas.
// Rutas (en el hash, para que recargar mantenga la pantalla):
//   #/              Inicio
//   #/estadisticas  Estadísticas
//   #/ajustes       Ajustes
//   #/juego/<id>    Un juego
import { ajustes } from './core/ajustes.js';
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

const ctx = { ajustes, navegar, db: null, estadisticas: null };

async function mostrar() {
  const miTurno = ++turno;
  const ruta = location.hash.replace(/^#\/?/, '');

  try { desmontarActual?.(); } catch (e) { console.error(e); }
  desmontarActual = null;
  contenedor.replaceChildren();
  window.scrollTo(0, 0);

  const [seccion, id] = ruta.split('/');
  if (seccion === 'juego' && JUEGOS.some((j) => j.id === id && j.disponible)) {
    const juego = await cargarJuego(id);
    if (miTurno !== turno) return;
    juego.montar(contenedor, ctx);
    desmontarActual = () => juego.desmontar();
    return;
  }

  const pantalla = PANTALLAS[seccion] || inicio;
  const fin = pantalla.montar(contenedor, ctx);
  if (typeof fin === 'function') desmontarActual = fin;
}

iniciarTema(ajustes);
window.addEventListener('hashchange', mostrar);
mostrar();
