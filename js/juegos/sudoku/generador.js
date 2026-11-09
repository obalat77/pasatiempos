// Generador de Sudokus con solución única, en el dispositivo (ESPECIFICACION.md §5.1).
//
// 1. Se crea una solución completa al azar.
// 2. Se quitan números en orden aleatorio; cada hueco se mantiene solo si el tablero
//    sigue pudiéndose resolver por deducción con las técnicas permitidas
//    (eso garantiza también que la solución es única).
// 3. Se comprueba que el tablero necesita la técnica mínima de su dificultad.
//    Si no, se prueba con otra solución (hasta agotar el tiempo; entonces se usa el mejor).
import { crearAzar } from '../../core/azar.js';
import { solucionAleatoria } from './resolutor.js';
import { resolverConTecnicas } from './tecnicas.js';

export const NIVELES = {
  //        números dados   técnica mínima y máxima (ver tecnicas.js)
  facil:   { dados: 40, nivelMin: 1, nivelMax: 1 },
  medio:   { dados: 32, nivelMin: 1, nivelMax: 1 },
  dificil: { dados: 27, nivelMin: 2, nivelMax: 2 },
  experto: { dados: 24, nivelMin: 3, nivelMax: 4 },
};

const contarDados = (t) => t.reduce((n, v) => n + (v ? 1 : 0), 0);

function vaciar(solucion, { dados, nivelMax }, azar) {
  const t = solucion.slice();
  let quedan = 81;
  for (const i of azar.barajar([...Array(81).keys()])) {
    if (quedan <= dados) break;
    const v = t[i];
    t[i] = 0;
    if (resolverConTecnicas(t, nivelMax).resuelto) quedan--;
    else t[i] = v;
  }
  return t;
}

/**
 * @param {'facil'|'medio'|'dificil'|'experto'} dificultad
 * @param {{ azar?: object, semilla?: number, tiempoMax?: number, ahora?: () => number }} opciones
 * @returns {{ tablero: number[], solucion: number[], dificultad: string, nivel: number,
 *             dados: number, intentos: number }}
 */
export function generarSudoku(dificultad, opciones = {}) {
  const config = NIVELES[dificultad];
  if (!config) throw new Error(`Dificultad desconocida: ${dificultad}`);
  const azar = opciones.azar || crearAzar(opciones.semilla);
  const ahora = opciones.ahora || (() => Date.now());
  const limite = ahora() + (opciones.tiempoMax ?? 1500);

  let mejor = null;
  let intentos = 0;
  do {
    intentos++;
    const solucion = solucionAleatoria(azar);
    const tablero = vaciar(solucion, config, azar);
    const { nivel } = resolverConTecnicas(tablero, config.nivelMax);
    const candidato = { tablero, solucion, dificultad, nivel, dados: contarDados(tablero) };
    // Ideal: nivel suficiente y número de dados alcanzado.
    if (nivel >= config.nivelMin && candidato.dados <= config.dados) return { ...candidato, intentos };
    // Si no, quedarse con el mejor: primero el que llega al nivel, después el de menos dados.
    const puntos = (c) => (c.nivel >= config.nivelMin ? 1000 : c.nivel * 100) - c.dados;
    if (!mejor || puntos(candidato) > puntos(mejor)) mejor = candidato;
  } while (ahora() < limite);
  return { ...mejor, intentos };
}
