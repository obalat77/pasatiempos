// Ayuda del Rummy (ESPECIFICACION.md §5.6)
export const AYUDA = {
  titulo: 'Cómo se juega al Rummy',
  secciones: [
    { titulo: 'Objetivo', texto: 'Quedarte sin fichas antes que Lola, Paco y Carmen.' },
    { titulo: 'Combinaciones', puntos: [
      'Serie: 3 o 4 fichas del mismo número y de colores distintos (7 rojo, 7 azul, 7 negro).',
      'Escalera: 3 o más números seguidos del mismo color (4, 5 y 6 azules).',
      'El comodín (la carita) sirve por cualquier ficha.',
    ] },
    { titulo: 'Cómo se juega', pasos: [
      'En tu turno, toca una ficha de tu atril y después dónde ponerla: una combinación de la mesa o «Nueva combinación». También puedes arrastrarla.',
      'Cuando todo esté bien, toca «Terminar turno».',
      'Si no puedes o no quieres poner nada, toca «Robar ficha».',
    ] },
    { titulo: 'La primera vez', texto: 'Tus primeras fichas en la mesa tienen que sumar al menos 30 puntos, solo con fichas tuyas. Después ya puedes cambiar de sitio las fichas de la mesa, siempre que al terminar todo quede bien.' },
    { titulo: 'Los botones', puntos: [
      '«Ordenar 1 2 3» y «Ordenar por color»: colocan tu atril y separan lo que ya tienes formado.',
      '«Deshacer jugada»: devuelve todo a como estaba al empezar tu turno.',
    ] },
    { titulo: 'Consejo', texto: 'Lo que acaban de poner los rivales se ve en amarillo.' },
  ],
};
