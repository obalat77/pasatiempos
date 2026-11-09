// Lista de juegos que muestra Inicio, en el orden de ESPECIFICACION.md §4.1.
// Solo datos de presentación; la lógica de cada juego vive en js/juegos/<id>/.
// `subtituloCorto` (opcional) se usa en horizontal, donde la tarjeta es más estrecha.
// `disponible: false` → la tarjeta aparece con «Próximamente» en lugar de «Jugar».

export const JUEGOS = [
  { id: 'sudoku', nombre: 'Sudoku', subtitulo: 'Fácil · Medio · Difícil · Experto', subtituloCorto: '4 dificultades', disponible: true },
  { id: 'palabras', nombre: 'Palabras', subtitulo: 'Forma palabras con las letras', disponible: false },
  { id: 'parejas', nombre: 'Parejas de números', subtitulo: 'Iguales o que sumen 10', disponible: false },
  { id: 'calculos', nombre: 'Cálculos cruzados', subtitulo: 'Cuentas en forma de crucigrama', disponible: false },
  { id: 'rummy', nombre: 'Rummy', subtitulo: 'Contra 3 rivales', disponible: false },
];

export function cargarJuego(id) {
  return import(`./${id}/index.js`).then((m) => m.default);
}
