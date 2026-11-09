import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearBDMemoria, abrirBD } from '../js/core/db.js';
import { crearPartidas } from '../js/core/partidas.js';
import { crearAjustes, AJUSTES_POR_DEFECTO } from '../js/core/ajustes.js';

test('sin IndexedDB se usa la base de datos en memoria', async () => {
  const db = await abrirBD(undefined);
  assert.equal(db.tipo, 'memoria');
});

test('base de datos en memoria: claves, autoincremento y copias', async () => {
  const db = crearBDMemoria();
  await db.poner('ajustes', 'oscuro', 'tema');
  assert.equal(await db.obtener('ajustes', 'tema'), 'oscuro');

  const id1 = await db.poner('resultados', { juego: 'sudoku' });
  const id2 = await db.poner('resultados', { juego: 'sudoku' });
  assert.equal(id1, 1);
  assert.equal(id2, 2);

  const original = { juego: 'sudoku', estado: { a: 1 } };
  await db.poner('partidas_en_curso', original);
  original.estado.a = 99;
  assert.equal((await db.obtener('partidas_en_curso', 'sudoku')).estado.a, 1, 'guarda una copia');

  await assert.rejects(db.poner('inventado', 1, 'x'));
  await assert.rejects(db.poner('ajustes', 1), 'falta la clave');
});

test('reemplazarTodo es todo o nada', async () => {
  const db = crearBDMemoria();
  await db.poner('ajustes', 'oscuro', 'tema');
  await assert.rejects(db.reemplazarTodo({
    ajustes: [['tema', 'claro']],
    partidas_en_curso: [[null, { sin: 'juego' }]], // inválida: falta keyPath
  }));
  assert.equal(await db.obtener('ajustes', 'tema'), 'oscuro', 'no se ha tocado nada');

  await db.reemplazarTodo({ ajustes: [['tema', 'claro']], resultados: [[5, { id: 5, juego: 'sudoku' }]] });
  assert.equal(await db.obtener('ajustes', 'tema'), 'claro');
  assert.equal(await db.poner('resultados', { juego: 'sudoku' }), 6, 'el autoincremento sigue tras el máximo');
});

test('ajustes: valores por defecto, carga, validación y guardado', async () => {
  const db = crearBDMemoria();
  await db.poner('ajustes', 'oscuro', 'tema');
  await db.poner('ajustes', 'enorme', 'texto-viejo');       // clave desconocida: se ignora
  await db.poner('ajustes', 'sí', 'sudoku.cronometro');      // tipo incorrecto: se ignora

  const ajustes = crearAjustes();
  await ajustes.cargar(db);
  assert.equal(ajustes.obtener('tema'), 'oscuro');
  assert.equal(ajustes.obtener('sudoku.cronometro'), AJUSTES_POR_DEFECTO['sudoku.cronometro']);

  const vistos = [];
  ajustes.alCambiar((c, v) => vistos.push([c, v]));
  await ajustes.cambiar('texto', 'grande');
  assert.deepEqual(vistos, [['texto', 'grande']]);
  assert.equal(await db.obtener('ajustes', 'texto'), 'grande');

  await assert.rejects(ajustes.cambiar('sudoku.cronometro', 'no'));
  assert.throws(() => ajustes.obtener('inventado'));
});

test('partidas: guardar, más reciente y cerrar', async () => {
  const db = crearBDMemoria();
  let reloj = 1000;
  const partidas = crearPartidas(db, () => reloj);

  assert.equal(await partidas.masReciente(), null);

  await partidas.guardar({ juego: 'sudoku', dificultad: 'medio', inicio: 500, segundos: 60, estado: {} });
  reloj = 2000;
  await partidas.guardar({ juego: 'palabras', dificultad: null, inicio: 1500, segundos: 10, estado: {} });
  assert.equal((await partidas.masReciente()).juego, 'palabras');

  reloj = 3000;
  await partidas.guardar({ juego: 'sudoku', dificultad: 'medio', inicio: 500, segundos: 90, estado: {} });
  assert.equal((await partidas.masReciente()).juego, 'sudoku');

  reloj = 4000;
  const fila = await partidas.cerrar('sudoku', 'terminada', { segundos: 95.4, detalles: { pistas: 2 } });
  assert.deepEqual(
    { ...fila, id: undefined },
    { id: undefined, juego: 'sudoku', dificultad: 'medio', inicio: 500, fin: 4000, duracionSeg: 95, resultado: 'terminada', detalles: { pistas: 2 } },
  );
  assert.equal(await partidas.obtener('sudoku'), undefined, 'ya no está en curso');
  assert.equal((await partidas.resultados('sudoku')).length, 1);
  assert.equal((await partidas.resultados('palabras')).length, 0);

  assert.equal(await partidas.cerrar('sudoku', 'abandonada'), null, 'nada que cerrar');
  await assert.rejects(partidas.guardar({ dificultad: 'medio' }));
});
