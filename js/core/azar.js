// Números aleatorios con semilla (para poder repetir partidas en las pruebas).
// Algoritmo mulberry32: rápido y suficiente para juegos.

export function crearAzar(semilla = (Math.random() * 2 ** 32) >>> 0) {
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado + 0x6D2B79F5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    semilla,
    /** Número en [0, 1) */
    real: siguiente,
    /** Entero en [min, max] */
    entero: (min, max) => min + Math.floor(siguiente() * (max - min + 1)),
    /** Baraja una copia del array (Fisher–Yates) */
    barajar(lista) {
      const a = lista.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(siguiente() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    elegir: (lista) => lista[Math.floor(siguiente() * lista.length)],
  };
}
