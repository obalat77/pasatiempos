// Pantalla de Estadísticas (ESPECIFICACION.md §4.2). Provisional hasta el paso 3.
import { h, botonInicio } from '../core/ui.js';

export function montar(contenedor, { navegar }) {
  contenedor.append(h('div', { class: 'pantalla' },
    h('header', { class: 'cabecera-pantalla' },
      botonInicio(() => navegar('')),
      h('h1', { class: 'titulo-pantalla' }, 'Estadísticas')),
    h('p', { class: 'provisional' }, 'Aún no hay partidas.')));
}
