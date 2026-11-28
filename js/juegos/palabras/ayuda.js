// Ayuda de Palabras (ESPECIFICACION.md §5.6)
export const AYUDA = {
  titulo: 'Cómo se juega a Palabras',
  secciones: [
    { titulo: 'Objetivo', texto: 'Formar todas las palabras del nivel con las letras del círculo.' },
    { titulo: 'Cómo se juega', pasos: [
      'Desliza el dedo de una letra a otra sin levantarlo, o tócalas una a una.',
      'Al soltar (o al tocar la palabra que se va formando) se comprueba.',
      'Si es correcta, aparece en su sitio.',
    ] },
    { titulo: 'Los botones', puntos: [
      '«Mezclar»: cambia las letras de sitio; a veces así se ven otras palabras.',
      '«Pista»: descubre una letra.',
    ] },
    { titulo: 'Consejo', texto: 'Las palabras que existen pero no son del nivel también cuentan: se guardan como «Palabras extra».' },
  ],
};
