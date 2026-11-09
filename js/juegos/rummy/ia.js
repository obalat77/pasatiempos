// Inteligencia de los rivales del Rummy (ESPECIFICACION.md §5.5).
// Se ejecuta en un Web Worker (worker.js) para no bloquear la pantalla; aquí no hay DOM.
import { buscar } from './buscador.js';
import { esComodin, motivoTurnoNoValido } from './reglas.js';

export const NIVELES = {
  principiante: { limiteMs: 300 },
  intermedio: { limiteMs: 1000 },
  experto: { limiteMs: 2500 },
};

/**
 * Decide la jugada de un rival.
 * @param {{ mesa: number[][], atril: number[], bajado: boolean, nivel: string,
 *           otros: number[], pozo: number, azar?: () => number, escala?: number }} e
 *   otros: número de fichas de los demás jugadores; pozo: fichas que quedan por robar;
 *   escala: multiplica los tiempos (las pruebas lo usan para ir más deprisa).
 * @returns {{ tipo: 'jugar', mesa: number[][], atril: number[], puestas: number[] } | { tipo: 'robar' }}
 */
export function decidir({ mesa, atril, bajado, nivel = 'intermedio', otros = [], pozo = 1, azar = Math.random, escala = 1 }) {
  const { limiteMs } = NIVELES[nivel] || NIVELES.intermedio;
  const tiempo = Math.max(10, limiteMs * escala);

  const intentar = (opcionales, ms) => (bajado
    ? buscar({ obligatorias: mesa.flat(), opcionales, limiteMs: ms })
    : buscar({ obligatorias: [], opcionales, limiteMs: ms, minPuntos: 30 }));

  const aJugada = (resultado, combinaciones = resultado.combinaciones) => {
    if (!combinaciones) return null;
    const nuevaMesa = bajado ? combinaciones : [...mesa, ...combinaciones];
    const enMesa = new Set(nuevaMesa.flat());
    const puestas = atril.filter((id) => enMesa.has(id));
    if (!puestas.length) return null;
    return { tipo: 'jugar', mesa: nuevaMesa, atril: atril.filter((id) => !enMesa.has(id)), puestas };
  };

  let jugada;
  if (nivel === 'experto') {
    const peligro = otros.some((n) => n <= 3) || pozo === 0;
    const propiosComodines = atril.filter(esComodin);
    const conTodo = intentar(atril, propiosComodines.length ? tiempo / 2 : tiempo);
    jugada = aJugada(conTodo);
    // El comodín solo cuando aporta mucho (o para cerrar la partida)
    if (jugada && propiosComodines.length && jugada.atril.length > 0 && !peligro) {
      const sinComodin = aJugada(intentar(atril.filter((id) => !esComodin(id)), tiempo / 2));
      if (sinComodin && sinComodin.puestas.length + 3 > jugada.puestas.length) jugada = sinComodin;
      else if (!sinComodin && jugada.puestas.length < 4) jugada = null;
    }
    // Guardarse fichas para bajar muchas de golpe, salvo que alguien vaya a cerrar
    if (jugada && bajado && !peligro && jugada.atril.length > 0 && jugada.puestas.length <= 2 && atril.length <= 12) {
      jugada = null;
    }
  } else {
    const resultado = intentar(atril, tiempo);
    jugada = aJugada(resultado);
    // Principiante: a veces se conforma con la primera jugada que encuentra
    if (nivel === 'principiante' && resultado.primera && azar() < 0.3) {
      jugada = aJugada(resultado, resultado.primera.combinaciones) || jugada;
    }
  }

  // Seguridad: nunca devolver una jugada que no cumpla las reglas
  if (jugada && motivoTurnoNoValido({ mesaAntes: mesa, atrilAntes: atril, mesa: jugada.mesa, atril: jugada.atril, bajado })) {
    jugada = null;
  }
  return jugada || { tipo: 'robar' };
}
