// Ayuda de Parejas de números (ESPECIFICACION.md §5.6)
export const AYUDA = {
  titulo: 'Cómo se juega a Parejas de números',
  secciones: [
    { titulo: 'Objetivo', texto: 'Quitar todos los números del tablero, de dos en dos.' },
    { titulo: 'Cómo se juega', pasos: [
      'Toca un número y después otro.',
      'Se quitan si son iguales (5 y 5) o si suman 10 (3 y 7).',
      'Tienen que estar juntos: al lado, encima, debajo o en diagonal. También valen si entre ellos solo hay casillas ya quitadas, o si uno está al final de una fila y el otro al principio de la siguiente.',
    ] },
    { titulo: 'Los botones', puntos: [
      '«Añadir números»: copia al final los números que quedan (4 veces por partida).',
      '«Pista»: señala una pareja.',
      '«Deshacer»: vuelve atrás.',
    ] },
    { titulo: 'Consejo', texto: 'Antes de añadir números, busca bien: suele quedar alguna pareja.' },
  ],
};
