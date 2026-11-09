import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluar, SUMA, RESTA, POR, ENTRE, NIVELES, generarCalculos, contarSoluciones, cuentas, plano,
  crearPartida, bandeja, colocar, borrar, deshacer, darPista, resuelto, esError, resumen,
} from '../js/juegos/calculos/reglas.js';

test('evaluar: prioridad de operaciones', () => {
  assert.equal(evaluar([2, 3, 4], [SUMA, POR]), 14);       // 2 + 3×4
  assert.equal(evaluar([2, 3, 4], [POR, SUMA]), 10);       // 2×3 + 4
  assert.equal(evaluar([20, 4, 2], [RESTA, ENTRE]), 18);   // 20 − 4÷2
  assert.equal(evaluar([12, 3, 2], [ENTRE, POR]), 8);      // 12÷3×2, de izquierda a derecha
  assert.equal(evaluar([7, 2, 3, 4], [RESTA, POR, SUMA]), 5); // 7 − 2×3 + 4
  assert.equal(evaluar([9, 1, 1], [RESTA, RESTA]), 7);
});

test('evaluar: solo enteros no negativos y divisiones exactas', () => {
  assert.equal(evaluar([7, 2, 1], [ENTRE, SUMA]), null, '7÷2 no es exacta');
  assert.equal(evaluar([3, 5, 1], [RESTA, SUMA]), null, '3−5 baja de cero aunque luego suba');
  assert.equal(evaluar([3, 2, 2], [RESTA, POR]), null, '3 − 2×2 = −1');
  assert.equal(evaluar([5, 5, 1], [RESTA, POR]), 0, 'cero sí vale');
  assert.equal(evaluar([5, 0, 1], [ENTRE, SUMA]), null, 'entre cero, no');
});

test('plano del tablero 7×7 como en el diseño', () => {
  const t = { m: 3, opsFilas: [[SUMA, RESTA], [POR, SUMA], [SUMA, RESTA]], opsColumnas: [[SUMA, RESTA], [RESTA, SUMA], [SUMA, RESTA]],
    resFilas: [5, 11, 6], resColumnas: [6, 10, 5] };
  const { lado, casillas } = plano(t);
  assert.equal(lado, 7);
  const en = (f, c) => casillas[f * 7 + c];
  assert.deepEqual(en(0, 0), { tipo: 'numero', k: 0 });
  assert.deepEqual(en(0, 1), { tipo: 'operador', v: SUMA });
  assert.deepEqual(en(1, 0), { tipo: 'operador', v: SUMA });   // vertical de la columna 0
  assert.deepEqual(en(2, 3), { tipo: 'operador', v: SUMA });   // segunda fila, segundo operador
  assert.deepEqual(en(0, 5), { tipo: 'igual' });
  assert.deepEqual(en(0, 6), { tipo: 'resultado', v: 5 });
  assert.deepEqual(en(5, 2), { tipo: 'igual' });
  assert.deepEqual(en(6, 2), { tipo: 'resultado', v: 10 });
  assert.deepEqual(en(1, 1), { tipo: 'vacia' });
  assert.deepEqual(en(6, 6), { tipo: 'vacia' });
  assert.deepEqual(en(4, 4), { tipo: 'numero', k: 8 });
});

for (const dificultad of Object.keys(NIVELES)) {
  test(`generador ${dificultad}: cuentas correctas, reglas de números y solución única`, () => {
    const config = NIVELES[dificultad];
    for (let s = 1; s <= 8; s++) {
      const t = generarCalculos(dificultad, { semilla: 500 + s, tiempoMax: 4000 });
      assert.equal(t.m, config.m);
      assert.equal(plano(t).lado, config.m === 3 ? 7 : 9);
      assert.equal(t.huecos.length, config.huecos, 'número de huecos');
      assert.ok(t.solucion.every((n) => Number.isInteger(n) && n >= 1 && n <= config.max), `números de 1 a ${config.max}`);
      const usados = [...t.opsFilas.flat(), ...t.opsColumnas.flat()];
      assert.ok(usados.every((o) => config.ops.includes(o)), 'solo operadores de su dificultad');
      if (config.ops.includes(ENTRE)) assert.ok(usados.includes(ENTRE), 'hay alguna división');
      for (const c of cuentas(t)) {
        const r = evaluar(c.celdas.map((k) => t.solucion[k]), c.operadores);
        assert.equal(r, c.resultado, 'la cuenta da su resultado');
        assert.ok(r >= 0 && r <= config.resultadoMax);
      }
      assert.equal(contarSoluciones(t, t.solucion, t.huecos, 3), 1, 'solución única con los números de la bandeja');
    }
  });
}

test('generador: misma semilla, mismo tablero; dificultad desconocida da error', () => {
  assert.deepEqual(generarCalculos('medio', { semilla: 3 }), generarCalculos('medio', { semilla: 3 }));
  assert.throws(() => generarCalculos('imposible'));
});

// ---------- Partida ----------

// Tablero de ejemplo 7×7 con huecos en 1, 3, 5, 7 y 8 de la rejilla 3×3
const DISEÑO = {
  dificultad: 'facil', m: 3,
  opsFilas: [[SUMA, RESTA], [POR, SUMA], [SUMA, RESTA]],
  opsColumnas: [[SUMA, RESTA], [RESTA, SUMA], [SUMA, RESTA]],
  solucion: [3, 4, 2, 6, 1, 5, 2, 7, 3],
  resFilas: [5, 11, 6],                 // 3+4−2, 6×1+5, 2+7−3
  resColumnas: [7, 10, 4],              // 3+6−2, 4−1+7, 2+5−3
  huecos: [1, 3, 5, 7, 8],
};

test('el ejemplo de partida es coherente', () => {
  for (const c of cuentas(DISEÑO)) assert.equal(evaluar(c.celdas.map((k) => DISEÑO.solucion[k]), c.operadores), c.resultado);
});

test('bandeja: exactamente los números que faltan, con repeticiones', () => {
  const p = crearPartida(DISEÑO);
  assert.deepEqual(bandeja(p), [3, 4, 5, 6, 7]);
  assert.deepEqual(resumen(p), { progreso: 0, texto: 'Faltan 5 números' });
  const q = crearPartida({ ...DISEÑO, huecos: [2, 6] }); // dos «2»
  assert.deepEqual(bandeja(q), [2, 2]);
});

test('colocar, borrar (vuelve a la bandeja) y deshacer', () => {
  const p = crearPartida(DISEÑO);
  assert.equal(colocar(p, 0, 3), false, 'casilla dada');
  assert.equal(colocar(p, 1, 9), false, 'número que no está en la bandeja');
  assert.ok(colocar(p, 1, 4));
  assert.deepEqual(bandeja(p), [3, 5, 6, 7]);
  assert.ok(colocar(p, 1, 7), 'cambiar el número: el 4 vuelve');
  assert.deepEqual(bandeja(p), [3, 4, 5, 6]);
  assert.ok(esError(p, 1));
  assert.equal(p.errores, 1);
  assert.ok(borrar(p, 1));
  assert.deepEqual(bandeja(p), [3, 4, 5, 6, 7]);
  assert.equal(deshacer(p), 1);
  assert.equal(p.valores[1], 7);
  deshacer(p); deshacer(p);
  assert.equal(p.valores[1], 0);
  assert.equal(deshacer(p), -1);
});

test('pista: número correcto, aunque esté puesto por error en otro hueco', () => {
  const p = crearPartida(DISEÑO);
  colocar(p, 3, 4);                       // el 4 va en el hueco 1, no en el 3
  assert.equal(darPista(p, 1), 1);
  assert.equal(p.valores[1], 4);
  assert.equal(p.valores[3], 0, 'el 4 mal puesto vuelve a la bandeja');
  assert.equal(p.pistas, 1);
  assert.equal(p.errores, 1, 'la pista no suma errores');
});

test('resuelto cuando todas las cuentas están bien; partida completa con pistas', () => {
  const p = crearPartida(DISEÑO);
  assert.equal(resuelto(p), false);
  let vueltas = 0;
  while (!resuelto(p) && vueltas++ < 20) darPista(p);
  assert.ok(resuelto(p));
  assert.equal(p.pistas, 5);
  assert.equal(darPista(p), -1);
  assert.deepEqual(resumen(p), { progreso: 1, texto: 'Todos los números colocados' });
  assert.deepEqual(JSON.parse(JSON.stringify(p)).valores, p.valores, 'se puede guardar');
});

test('partida generada de cada dificultad se completa a base de pistas', () => {
  for (const dif of Object.keys(NIVELES)) {
    const p = crearPartida(generarCalculos(dif, { semilla: 77 }));
    // un error a propósito primero
    const [h0, h1] = p.huecos;
    if (p.solucion[h0] !== p.solucion[h1]) colocar(p, h0, p.solucion[h1]);
    let vueltas = 0;
    while (!resuelto(p) && vueltas++ < 40) darPista(p);
    assert.ok(resuelto(p), dif);
  }
});
