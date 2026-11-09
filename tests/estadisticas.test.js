import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularEstadisticas, rachaActual } from '../js/core/estadisticas.js';

const dia = (d, h = 10) => new Date(2026, 10, d, h).getTime();
const r = (juego, d, resultado, duracionSeg, dificultad = 'medio') =>
  ({ juego, dificultad, inicio: dia(d) - duracionSeg * 1000, fin: dia(d), duracionSeg, resultado, detalles: {} });

const HOY = new Date(2026, 10, 9, 18);

test('racha: días seguidos con alguna partida terminada', () => {
  assert.equal(rachaActual([], HOY), 0);
  assert.equal(rachaActual([r('sudoku', 9, 'terminada', 60)], HOY), 1);
  assert.equal(rachaActual([r('sudoku', 9, 'terminada', 60), r('sudoku', 8, 'terminada', 60), r('sudoku', 7, 'terminada', 60)], HOY), 3);
  // Hoy aún no ha jugado: la racha de ayer sigue viva
  assert.equal(rachaActual([r('sudoku', 8, 'terminada', 60), r('sudoku', 7, 'terminada', 60)], HOY), 2);
  // Hueco de un día: se rompe
  assert.equal(rachaActual([r('sudoku', 9, 'terminada', 60), r('sudoku', 7, 'terminada', 60)], HOY), 1);
  // Las abandonadas no cuentan
  assert.equal(rachaActual([r('sudoku', 9, 'abandonada', 60), r('sudoku', 8, 'terminada', 60)], HOY), 1);
  // Ni las de anteayer solas
  assert.equal(rachaActual([r('sudoku', 7, 'terminada', 60)], HOY), 0);
});

test('racha que cruza un cambio de mes', () => {
  const hoy = new Date(2026, 11, 1, 9);
  const filas = [
    { juego: 'sudoku', resultado: 'ganada', fin: new Date(2026, 11, 1, 8).getTime() },
    { juego: 'sudoku', resultado: 'ganada', fin: new Date(2026, 10, 30, 22).getTime() },
  ];
  assert.equal(rachaActual(filas, hoy), 2);
});

test('estadísticas de un juego', () => {
  const resultados = [
    r('sudoku', 9, 'terminada', 300, 'facil'),
    r('sudoku', 9, 'terminada', 250, 'facil'),
    r('sudoku', 8, 'abandonada', 100, 'facil'),
    r('sudoku', 8, 'terminada', 900, 'dificil'),
    r('sudoku', 3, 'terminada', 50, 'medio'),
    r('sudoku', 2, 'terminada', 40, 'medio'),
    r('rummy', 9, 'ganada', 1000, null),
  ];
  const e = calcularEstadisticas(resultados, 'sudoku', HOY);
  assert.equal(e.jugadas, 6);
  assert.equal(e.exitos, 5);
  assert.equal(e.racha, 2);
  assert.equal(e.tiempoTotal, 300 + 250 + 100 + 900 + 50 + 40);
  assert.deepEqual(e.mejorTiempo, { facil: 250, dificil: 900, medio: 40 });
  assert.equal(e.ultimas.length, 5);
  assert.ok(e.ultimas.every((u, i, a) => i === 0 || a[i - 1].fin >= u.fin), 'de más reciente a más antigua');

  const rummy = calcularEstadisticas(resultados, 'rummy', HOY);
  assert.deepEqual(rummy.mejorTiempo, { unica: 1000 });

  const vacio = calcularEstadisticas([], 'parejas', HOY);
  assert.deepEqual(vacio, { jugadas: 0, exitos: 0, racha: 0, tiempoTotal: 0, mejorTiempo: {}, ultimas: [] });
});
