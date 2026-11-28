// Ayuda del Sudoku (ESPECIFICACION.md §5.6)
export const AYUDA = {
  titulo: 'Cómo se juega al Sudoku',
  secciones: [
    { titulo: 'Objetivo', texto: 'Rellenar todas las casillas con números del 1 al 9 sin que se repita ninguno en la misma fila, en la misma columna ni en el mismo cuadrado de 3 × 3.' },
    { titulo: 'Cómo se juega', pasos: [
      'Toca una casilla vacía.',
      'Toca un número de abajo.',
      'Si te equivocas, toca «Borrar» o «Deshacer».',
    ] },
    { titulo: 'Los botones', puntos: [
      '«Notas»: si está en «sí», los números se apuntan pequeños, como recordatorio.',
      '«Pista»: pone el número correcto en la casilla elegida.',
      '«Pausa»: para el reloj.',
    ] },
    { titulo: 'Consejo', texto: 'Empieza por las filas, columnas o cuadrados a los que les faltan pocos números.' },
  ],
};
