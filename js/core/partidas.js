// Partidas en curso (una por juego) y registro de resultados.
//
// Forma de una partida en curso (la escribe cada juego):
//   {
//     juego: 'sudoku',
//     dificultad: 'medio',             // o null si el juego no tiene
//     inicio: 1762700000000,           // ms; cuándo empezó
//     segundos: 252,                   // tiempo jugado (sin pausas)
//     resumen: { titulo: 'Sudoku · Medio', detalle: '37 de 81 casillas · 04:12', progreso: 0.46 },
//     estado: { … }                    // lo que necesite el juego para reanudar
//     actualizada: 1762700252000       // ms; la pone este módulo
//   }

export function crearPartidas(db, ahora = () => Date.now()) {
  return {
    /** Guarda (o sustituye) la partida en curso de un juego. */
    async guardar(partida) {
      if (!partida?.juego) throw new Error('La partida necesita «juego»');
      await db.poner('partidas_en_curso', { ...partida, actualizada: ahora() });
    },

    obtener(juego) {
      return db.obtener('partidas_en_curso', juego);
    },

    borrar(juego) {
      return db.borrar('partidas_en_curso', juego);
    },

    /** La partida en curso más reciente de cualquier juego, o null. */
    async masReciente() {
      const todas = await db.todos('partidas_en_curso');
      if (!todas.length) return null;
      return todas.reduce((a, b) => ((b.actualizada || 0) > (a.actualizada || 0) ? b : a));
    },

    /**
     * Cierra la partida en curso: la pasa a `resultados` y la borra de las partidas en curso.
     * `resultado`: 'terminada' | 'abandonada' | 'ganada' | 'perdida'.
     * `extra` puede traer `segundos` (si cambió desde el último guardado) y `detalles`.
     * Si no había partida en curso pero se pasa `partida`, se usa esa.
     * Devuelve la fila guardada en `resultados`, o null si no había nada que cerrar.
     */
    async cerrar(juego, resultado, extra = {}) {
      const guardada = (await db.obtener('partidas_en_curso', juego)) || extra.partida;
      if (!guardada) return null;
      const fin = ahora();
      const fila = {
        juego,
        dificultad: guardada.dificultad ?? null,
        inicio: guardada.inicio ?? fin,
        fin,
        duracionSeg: Math.round(extra.segundos ?? guardada.segundos ?? 0),
        resultado,
        detalles: extra.detalles ?? {},
      };
      fila.id = await db.poner('resultados', fila);
      await db.borrar('partidas_en_curso', juego);
      return fila;
    },

    /** Resultados guardados, opcionalmente solo de un juego. */
    async resultados(juego) {
      const todos = await db.todos('resultados');
      return juego ? todos.filter((r) => r.juego === juego) : todos;
    },
  };
}
