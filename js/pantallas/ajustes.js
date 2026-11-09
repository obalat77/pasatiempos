// Pantalla de Ajustes (ESPECIFICACION.md §4.3; diseños Settings-*).
// Solo se muestran las secciones de los juegos disponibles.
// La copia de seguridad se añade en el paso 6.
import { h, botonInicio, segmentado, filaInterruptor } from '../core/ui.js';
import { buscarJuego } from '../juegos/catalogo.js';
import { VERSION } from '../version.js';

const disponible = (id) => buscarJuego(id)?.disponible;

export function montar(contenedor, { ajustes, navegar }) {
  const opcion = (clave, etiqueta, opciones) =>
    segmentado(etiqueta, opciones, ajustes.obtener(clave), (v) => ajustes.cambiar(clave, v));
  const interruptor = (clave, texto) =>
    filaInterruptor(texto, ajustes.obtener(clave), (v) => ajustes.cambiar(clave, v));
  const seccionOpciones = (titulo, clave, opciones, orden) =>
    h('section', { class: 'tarjeta seccion-ajustes', style: { order: orden } },
      h('div', { class: 'grupo-ajuste' }, h('h2', {}, titulo), opcion(clave, titulo, opciones)));

  const apariencia = h('section', { class: 'tarjeta seccion-ajustes', style: { order: 1 } },
    h('div', { class: 'grupo-ajuste' },
      h('h2', {}, 'Tema'),
      opcion('tema', 'Tema', [
        { valor: 'claro', texto: 'Claro' },
        { valor: 'oscuro', texto: 'Oscuro' },
        { valor: 'auto', texto: 'Automático' },
      ])),
    h('div', { class: 'grupo-ajuste' },
      h('h2', {}, 'Tamaño del texto'),
      opcion('texto', 'Tamaño del texto', [
        { valor: 'normal', texto: 'Normal' },
        { valor: 'grande', texto: 'Grande', clase: 'texto-grande' },
      ])));

  const sudoku = disponible('sudoku') && h('section', { class: 'tarjeta seccion-interruptores', style: { order: 2 } },
    h('h2', {}, 'Sudoku'),
    interruptor('sudoku.marcarErrores', 'Marcar errores en rojo'),
    interruptor('sudoku.cronometro', 'Mostrar cronómetro'),
    interruptor('sudoku.resaltarIguales', 'Resaltar números iguales'));

  const palabras = disponible('palabras') && seccionOpciones('Palabras: modo de juego', 'palabras.modo', [
    { valor: 'crucigrama', texto: 'Crucigrama' },
    { valor: 'lista', texto: 'Lista (más difícil)' },
  ], 3);

  const calculos = disponible('calculos') && h('section', { class: 'tarjeta seccion-interruptores', style: { order: 4 } },
    h('h2', {}, 'Cálculos cruzados'),
    interruptor('calculos.marcarErrores', 'Marcar errores en rojo'));

  const rummy = disponible('rummy') && h('section', { class: 'tarjeta seccion-ajustes', style: { order: 5 } },
    h('div', { class: 'grupo-ajuste' },
      h('h2', {}, 'Rummy: nivel de los rivales'),
      opcion('rummy.nivel', 'Rummy: nivel de los rivales', [
        { valor: 'principiante', texto: 'Principiante' },
        { valor: 'intermedio', texto: 'Intermedio' },
        { valor: 'experto', texto: 'Experto' },
      ]),
      h('p', { class: 'nota' }, 'Se aplica desde la próxima partida.')));

  contenedor.append(h('div', { class: 'pantalla ajustes' },
    h('header', { class: 'cabecera-pantalla' },
      botonInicio(() => navegar('')),
      h('h1', { class: 'titulo-pantalla' }, 'Ajustes')),
    h('div', { class: 'ajustes-columnas' },
      h('div', { class: 'ajustes-columna' }, apariencia),
      h('div', { class: 'ajustes-columna' }, sudoku, palabras, calculos, rummy)),
    h('p', { class: 'pie' }, `Pasatiempos · versión ${VERSION}`)));
}
