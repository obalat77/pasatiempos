// Lista de juegos que muestra la plataforma, en el orden de ESPECIFICACION.md §4.1.
// Solo datos de presentación; la lógica de cada juego vive en js/juegos/<id>/.
//
//   nombreCorto     en el selector de Estadísticas
//   subtituloCorto  (opcional) en horizontal, donde la tarjeta de Inicio es más estrecha
//   dificultades    [] si el juego no pregunta dificultad
//   exito           'terminadas' | 'ganadas' (cómo se llaman las partidas con éxito)
//   resultados      (opcional) nombres propios de resultados en Estadísticas, p. ej. { perdida: 'Sin jugadas' }
//   disponible      false → en Inicio aparece «Próximamente» y no sale en Ajustes ni Estadísticas

export const DIFICULTADES = {
  facil: 'Fácil',
  medio: 'Medio',
  dificil: 'Difícil',
  experto: 'Experto',
};

const CUATRO = ['facil', 'medio', 'dificil', 'experto'];

export const JUEGOS = [
  { id: 'sudoku', nombre: 'Sudoku', nombreCorto: 'Sudoku', subtitulo: 'Fácil · Medio · Difícil · Experto',
    subtituloCorto: '4 dificultades', dificultades: CUATRO, exito: 'terminadas', disponible: true },
  { id: 'palabras', nombre: 'Palabras', nombreCorto: 'Palabras', subtitulo: 'Forma palabras con las letras',
    dificultades: [], exito: 'terminadas', disponible: false },
  { id: 'parejas', nombre: 'Parejas de números', nombreCorto: 'Parejas', subtitulo: 'Iguales o que sumen 10',
    dificultades: [], exito: 'ganadas', resultados: { perdida: 'Sin jugadas' }, disponible: true },
  { id: 'calculos', nombre: 'Cálculos cruzados', nombreCorto: 'Cálculos', subtitulo: 'Cuentas en forma de crucigrama',
    dificultades: CUATRO, exito: 'terminadas', disponible: true },
  { id: 'rummy', nombre: 'Rummy', nombreCorto: 'Rummy', subtitulo: 'Contra 3 rivales',
    dificultades: [], exito: 'ganadas', disponible: false },
];

export const juegosDisponibles = () => JUEGOS.filter((j) => j.disponible);
export const buscarJuego = (id) => JUEGOS.find((j) => j.id === id);

export function cargarJuego(id) {
  return import(`./${id}/index.js`).then((m) => m.default);
}
