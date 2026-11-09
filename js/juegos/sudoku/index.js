// Sudoku — interfaz común de juego (ESPECIFICACION.md §2.4).
// Provisional: el tablero llega en los pasos 4 y 5.
import { h, botonInicio } from '../../core/ui.js';

let raiz = null;

export default {
  id: 'sudoku',
  nombre: 'Sudoku',
  descripcion: 'Fácil · Medio · Difícil · Experto',

  montar(contenedor, ctx) {
    raiz = h('div', { class: 'pantalla' },
      h('header', { class: 'cabecera-pantalla' },
        botonInicio(() => ctx.navegar('')),
        h('h1', { class: 'titulo-pantalla' }, 'Sudoku')),
      h('p', { class: 'provisional' }, 'El tablero estará disponible muy pronto.'));
    contenedor.append(raiz);
  },

  desmontar() {
    raiz?.remove();
    raiz = null;
  },

  partidaEnCurso() {
    return null;
  },
};
