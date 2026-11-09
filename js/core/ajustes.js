// Ajustes de la app (ESPECIFICACION.md §4.3).
// Paso 1: se guardan solo en memoria. En el paso 2 se conectan con IndexedDB.

export const AJUSTES_POR_DEFECTO = Object.freeze({
  tema: 'auto',                    // 'claro' | 'oscuro' | 'auto'
  texto: 'normal',                 // 'normal' | 'grande'
  'sudoku.marcarErrores': true,
  'sudoku.cronometro': true,
  'sudoku.resaltarIguales': false,
  'palabras.modo': 'crucigrama',   // 'crucigrama' | 'lista'
  'calculos.marcarErrores': true,
  'rummy.nivel': 'intermedio',     // 'principiante' | 'intermedio' | 'experto'
});

const valores = { ...AJUSTES_POR_DEFECTO };
const oyentes = new Set();

export const ajustes = {
  obtener(clave) {
    return clave in valores ? valores[clave] : AJUSTES_POR_DEFECTO[clave];
  },
  todos() {
    return { ...valores };
  },
  async cambiar(clave, valor) {
    if (!(clave in AJUSTES_POR_DEFECTO)) throw new Error(`Ajuste desconocido: ${clave}`);
    valores[clave] = valor;
    for (const fn of oyentes) fn(clave, valor);
  },
  /** Llama a `fn(clave, valor)` en cada cambio. Devuelve la función para dejar de escuchar. */
  alCambiar(fn) {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
  },
};
