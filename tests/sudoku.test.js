import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAzar } from '../js/core/azar.js';
import { UNIDADES, VECINAS, tieneConflictos, candidatosDe, bitsANumeros } from '../js/juegos/sudoku/tablero.js';
import { contarSoluciones, tieneSolucionUnica, resolver, solucionAleatoria } from '../js/juegos/sudoku/resolutor.js';
import { resolverConTecnicas } from '../js/juegos/sudoku/tecnicas.js';
import { generarSudoku, NIVELES } from '../js/juegos/sudoku/generador.js';
import {
  crearPartida, ponerNumero, alternarNota, borrar, deshacer, darPista, esError, tieneNota,
  numeroCompleto, resuelto, casillasLlenas, resumen,
} from '../js/juegos/sudoku/reglas.js';

const leer = (texto) => [...texto.replace(/\s/g, '')].map((c) => (c === '.' ? 0 : Number(c)));

// Sudoku clásico de periódico (se resuelve solo con casillas únicas)
const FACIL = leer(`
  53..7....  6..195...  .98....6.
  8...6...3  4..8.3..1  7...2...6
  .6....28.  ...419..5  ....8..79`);
const FACIL_SOLUCION = leer(`
  534678912  672195348  198342567
  859761423  426853791  713924856
  961537284  287419635  345286179`);

function esSolucionValida(t) {
  return t.length === 81 && t.every((v) => v >= 1 && v <= 9)
    && UNIDADES.every((u) => new Set(u.map((i) => t[i])).size === 9);
}

test('geometría: 27 unidades de 9 casillas y 20 vecinas por casilla', () => {
  assert.equal(UNIDADES.length, 27);
  assert.ok(UNIDADES.every((u) => u.length === 9 && new Set(u).size === 9));
  assert.ok(VECINAS.every((v) => v.length === 20));
});

test('candidatos de una casilla', () => {
  // Casilla (0,2) del Sudoku de ejemplo: fila 5,3,7 · columna 8 · bloque 6,9,8
  assert.deepEqual(bitsANumeros(candidatosDe(FACIL, 2)), [1, 2, 4]);
  assert.equal(candidatosDe(FACIL, 0), 0, 'casilla llena');
});

test('resolutor por búsqueda', () => {
  assert.deepEqual(resolver(FACIL), FACIL_SOLUCION);
  assert.equal(contarSoluciones(FACIL), 1);
  assert.equal(contarSoluciones(new Array(81).fill(0), 2), 2, 'tablero vacío: muchas soluciones');
  const roto = FACIL.slice();
  roto[2] = 5; // dos 5 en la primera fila
  assert.ok(tieneConflictos(roto));
  assert.equal(contarSoluciones(roto), 0);
  assert.equal(resolver(roto), null);
});

test('solución aleatoria válida y repetible con la misma semilla', () => {
  const a = solucionAleatoria(crearAzar(42));
  const b = solucionAleatoria(crearAzar(42));
  const c = solucionAleatoria(crearAzar(43));
  assert.ok(esSolucionValida(a));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('resolutor con técnicas', () => {
  const r = resolverConTecnicas(FACIL);
  assert.ok(r.resuelto);
  assert.equal(r.nivel, 1);
  assert.deepEqual(r.tablero, FACIL_SOLUCION);

  // Sudoku de Arto Inkala (2012), conocido por necesitar técnicas avanzadas
  const DIFICIL = leer(`
    8........  ..36.....  .7..9.2..
    .5...7...  ....457..  ...1...3.
    ..1....68  ..85...1.  .9....4..`);
  assert.ok(tieneSolucionUnica(DIFICIL));
  const d = resolverConTecnicas(DIFICIL);
  assert.equal(d.resuelto, false, 'ni con todas las técnicas: haría falta tantear');
  assert.ok(!tieneConflictos(d.tablero), 'lo que deduce es correcto');
  const sol = resolver(DIFICIL);
  assert.ok(d.tablero.every((v, i) => v === 0 || v === sol[i]));
});

for (const dificultad of Object.keys(NIVELES)) {
  test(`generador: ${dificultad} (solución única, dados y técnica)`, () => {
    const { dados, nivelMin, nivelMax } = NIVELES[dificultad];
    for (let s = 1; s <= 6; s++) {
      const g = generarSudoku(dificultad, { semilla: 1000 + s, tiempoMax: 4000 });
      assert.ok(esSolucionValida(g.solucion));
      assert.ok(g.tablero.every((v, i) => v === 0 || v === g.solucion[i]), 'los dados coinciden con la solución');
      assert.ok(tieneSolucionUnica(g.tablero), 'solución única');
      assert.deepEqual(resolver(g.tablero), g.solucion);
      assert.equal(g.dados, dados, 'número de dados');
      assert.ok(g.nivel >= nivelMin && g.nivel <= nivelMax, `nivel ${g.nivel}`);
      const r = resolverConTecnicas(g.tablero, nivelMax);
      assert.ok(r.resuelto, 'se resuelve sin tantear');
      assert.deepEqual(r.tablero, g.solucion, 'las deducciones son correctas');
    }
  });
}

test('generador: misma semilla, mismo Sudoku; dificultad desconocida da error', () => {
  const a = generarSudoku('medio', { semilla: 7 });
  const b = generarSudoku('medio', { semilla: 7 });
  assert.deepEqual(a.tablero, b.tablero);
  assert.throws(() => generarSudoku('imposible'));
});

// ---------- Reglas de la partida ----------

function partidaDeEjemplo() {
  return crearPartida({ tablero: FACIL, solucion: FACIL_SOLUCION, dificultad: 'facil' });
}

test('poner número: no en casillas iniciales; cuenta errores', () => {
  const p = partidaDeEjemplo();
  assert.equal(ponerNumero(p, 0, 1), false, 'casilla inicial');
  assert.equal(ponerNumero(p, 2, 4), true);
  assert.equal(esError(p, 2), false);
  assert.equal(ponerNumero(p, 2, 4), false, 'mismo número otra vez');
  assert.equal(ponerNumero(p, 3, 9), true);
  assert.equal(esError(p, 3), true);
  assert.equal(p.errores, 1);
});

test('al poner un número se borra esa nota en fila, columna y bloque', () => {
  const p = partidaDeEjemplo();
  alternarNota(p, 3, 6);   // misma fila que la casilla 2
  alternarNota(p, 10, 6);  // mismo bloque
  alternarNota(p, 29, 6);  // misma columna
  alternarNota(p, 40, 6);  // ni fila, ni columna, ni bloque
  alternarNota(p, 3, 2);   // otra nota en la misma casilla
  ponerNumero(p, 2, 6);    // error a propósito, también quita notas
  assert.equal(tieneNota(p, 3, 6), false);
  assert.equal(tieneNota(p, 10, 6), false);
  assert.equal(tieneNota(p, 29, 6), false);
  assert.equal(tieneNota(p, 40, 6), true);
  assert.equal(tieneNota(p, 3, 2), true);
});

test('notas solo en casillas vacías; borrar vacía número y notas', () => {
  const p = partidaDeEjemplo();
  assert.equal(alternarNota(p, 0, 1), false, 'casilla inicial');
  alternarNota(p, 2, 1);
  alternarNota(p, 2, 2);
  assert.ok(tieneNota(p, 2, 1) && tieneNota(p, 2, 2));
  alternarNota(p, 2, 1);
  assert.ok(!tieneNota(p, 2, 1), 'tocar otra vez la quita');
  ponerNumero(p, 2, 4);
  assert.equal(p.notas[2], 0, 'el número sustituye a las notas');
  assert.equal(alternarNota(p, 2, 3), false, 'no se anota sobre un número');
  assert.equal(borrar(p, 2), true);
  assert.equal(p.valores[2], 0);
  assert.equal(borrar(p, 2), false, 'nada que borrar');
  assert.equal(borrar(p, 0), false, 'casilla inicial');
});

test('deshacer ilimitado devuelve números y notas, también las de las vecinas', () => {
  const p = partidaDeEjemplo();
  const inicial = JSON.stringify({ v: p.valores, n: p.notas });
  alternarNota(p, 3, 6);
  alternarNota(p, 10, 6);
  ponerNumero(p, 2, 6);
  borrar(p, 2);
  ponerNumero(p, 2, 4);
  assert.equal(deshacer(p), 2);
  assert.equal(p.valores[2], 0);
  deshacer(p);
  assert.equal(p.valores[2], 6);
  deshacer(p);
  assert.ok(tieneNota(p, 3, 6) && tieneNota(p, 10, 6), 'vuelven las notas de las vecinas');
  deshacer(p);
  deshacer(p);
  assert.equal(JSON.stringify({ v: p.valores, n: p.notas }), inicial);
  assert.equal(deshacer(p), -1, 'nada más que deshacer');
});

test('pista: la casilla seleccionada, o una con una sola posibilidad', () => {
  const p = partidaDeEjemplo();
  assert.equal(darPista(p, 2), 2);
  assert.equal(p.valores[2], 4);
  assert.equal(p.pistas, 1);
  assert.equal(p.errores, 0, 'la pista no cuenta como error');

  ponerNumero(p, 3, 9); // error
  assert.equal(darPista(p, 3), 3, 'corrige la seleccionada si está mal');
  assert.equal(p.valores[3], 6);

  const i = darPista(p, 0); // casilla inicial seleccionada → busca otra
  assert.ok(i >= 0 && p.valores[i] === FACIL_SOLUCION[i]);
  const correctos = p.valores.map((v, k) => (k === i ? 0 : v));
  assert.ok(bitsANumeros(candidatosDe(correctos, i)).length === 1, 'tenía una sola posibilidad');
});

test('partida completa a base de pistas: resuelta, llenas y números completos', () => {
  const p = partidaDeEjemplo();
  assert.equal(numeroCompleto(p, 5), false);
  assert.deepEqual(resumen(p), { llenas: 30, progreso: 30 / 81, texto: '30 de 81 casillas' });
  let vueltas = 0;
  while (!resuelto(p) && vueltas++ < 100) darPista(p);
  assert.ok(resuelto(p));
  assert.equal(casillasLlenas(p), 81);
  assert.equal(p.pistas, 51);
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8, 9].every((n) => numeroCompleto(p, n)));
  assert.equal(darPista(p), -1, 'nada que rellenar');
});

test('la partida se puede guardar como JSON y seguir', () => {
  const p = partidaDeEjemplo();
  ponerNumero(p, 2, 4);
  alternarNota(p, 3, 6);
  const copia = JSON.parse(JSON.stringify(p));
  assert.equal(deshacer(copia), 3);
  assert.equal(deshacer(copia), 2);
  assert.equal(copia.valores[2], 0);
});
