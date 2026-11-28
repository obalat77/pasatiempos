// Ayuda de Cálculos cruzados (ESPECIFICACION.md §5.6)
export const AYUDA = {
  titulo: 'Cómo se juega a Cálculos cruzados',
  secciones: [
    { titulo: 'Objetivo', texto: 'Completar las cuentas, que se cruzan como en un crucigrama, para que todas den bien.' },
    { titulo: 'Cómo se juega', pasos: [
      'Toca una casilla vacía.',
      'Toca un número de abajo: solo están los que faltan.',
      'Las multiplicaciones y divisiones se hacen antes que las sumas y restas.',
    ] },
    { titulo: 'Los botones', puntos: [
      '«Borrar»: devuelve el número a su sitio.',
      '«Deshacer»: vuelve atrás.',
      '«Pista»: pone un número correcto.',
    ] },
    { titulo: 'Consejo', texto: 'Empieza por la cuenta a la que le falte un solo número.' },
  ],
};
