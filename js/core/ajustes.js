// Ajustes de la app (ESPECIFICACION.md §4.3), guardados en el almacén `ajustes`.

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

/** Valor guardado válido = mismo tipo que el valor por defecto. */
function valido(clave, valor) {
  return clave in AJUSTES_POR_DEFECTO && typeof valor === typeof AJUSTES_POR_DEFECTO[clave];
}

export function crearAjustes() {
  const valores = { ...AJUSTES_POR_DEFECTO };
  const oyentes = new Set();
  let db = null;

  return {
    /** Lee los ajustes guardados. A partir de aquí, cada cambio se guarda. */
    async cargar(baseDatos) {
      db = baseDatos;
      for (const [clave, valor] of await db.entradas('ajustes')) {
        if (valido(clave, valor)) valores[clave] = valor;
      }
    },
    obtener(clave) {
      if (!(clave in AJUSTES_POR_DEFECTO)) throw new Error(`Ajuste desconocido: ${clave}`);
      return valores[clave];
    },
    todos() {
      return { ...valores };
    },
    async cambiar(clave, valor) {
      if (!valido(clave, valor)) throw new Error(`Ajuste no válido: ${clave} = ${valor}`);
      valores[clave] = valor;
      for (const fn of oyentes) fn(clave, valor);
      if (db) await db.poner('ajustes', valor, clave);
    },
    /** Llama a `fn(clave, valor)` en cada cambio. Devuelve la función para dejar de escuchar. */
    alCambiar(fn) {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },
  };
}
