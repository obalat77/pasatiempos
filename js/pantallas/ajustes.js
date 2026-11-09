// Pantalla de Ajustes (ESPECIFICACION.md §4.3; diseños Settings-*).
// Paso 1: Tema y Tamaño del texto. El resto de secciones llega en el paso 3.
import { h, botonInicio, segmentado } from '../core/ui.js';

export function montar(contenedor, { ajustes, navegar }) {
  const apariencia = h('section', { class: 'tarjeta seccion-ajustes' },
    h('div', { class: 'grupo-ajuste' },
      h('h2', {}, 'Tema'),
      segmentado('Tema', [
        { valor: 'claro', texto: 'Claro' },
        { valor: 'oscuro', texto: 'Oscuro' },
        { valor: 'auto', texto: 'Automático' },
      ], ajustes.obtener('tema'), (v) => ajustes.cambiar('tema', v))),
    h('div', { class: 'grupo-ajuste' },
      h('h2', {}, 'Tamaño del texto'),
      segmentado('Tamaño del texto', [
        { valor: 'normal', texto: 'Normal' },
        { valor: 'grande', texto: 'Grande', clase: 'texto-grande' },
      ], ajustes.obtener('texto'), (v) => ajustes.cambiar('texto', v))));

  contenedor.append(h('div', { class: 'pantalla' },
    h('header', { class: 'cabecera-pantalla' },
      botonInicio(() => navegar('')),
      h('h1', { class: 'titulo-pantalla' }, 'Ajustes')),
    h('div', { class: 'ajustes-columnas' },
      h('div', { class: 'ajustes-columna' }, apariencia))));
}
