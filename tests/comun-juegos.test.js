import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Reloj } from '../js/core/reloj.js';
import { datoDestacado, esRecord } from '../js/core/final.js';

test('reloj: cuenta solo mientras corre y redondea al final', () => {
  let ms = 0;
  const pintados = [];
  const r = new Reloj(10, (s) => pintados.push(s), () => ms);
  assert.equal(r.segundos(), 10);
  r.arrancar();
  ms = 5400;
  assert.equal(r.segundos(), 15.4);
  r.parar();
  ms = 60000;                       // en pausa no cuenta
  assert.equal(r.segundos(), 15.4);
  r.arrancar();
  r.arrancar();                     // arrancar dos veces no duplica
  ms = 61000;
  assert.equal(r.segundos(), 16.4);
  assert.equal(r.detenerFinal(), 16);
  assert.equal(r.corriendo, false);
  assert.equal(pintados.at(-1), 16);
});

test('dato destacado y récord', () => {
  assert.equal(datoDestacado({ record: true, pistas: 3 }), '¡Nuevo mejor tiempo!');
  assert.equal(datoDestacado({ record: false, pistas: 0 }), 'Sin usar ninguna pista');
  assert.equal(datoDestacado({ record: false, pistas: 1 }), 'Con 1 pista');
  assert.equal(datoDestacado({ record: false, pistas: 4 }), 'Con 4 pistas');
  assert.equal(esRecord(100, []), false, 'la primera partida no es récord');
  assert.equal(esRecord(100, [{ duracionSeg: 120 }, { duracionSeg: 101 }]), true);
  assert.equal(esRecord(100, [{ duracionSeg: 100 }]), false, 'empatar no es récord');
});

test('ayuda: los cinco juegos tienen sus instrucciones, con los mismos apartados', async () => {
  for (const [juego, articulo] of [['sudoku', 'al Sudoku'], ['palabras', 'a Palabras'], ['parejas', 'a Parejas de números'],
    ['calculos', 'a Cálculos cruzados'], ['rummy', 'al Rummy']]) {
    const { AYUDA } = await import(`../js/juegos/${juego}/ayuda.js`);
    assert.equal(AYUDA.titulo, `Cómo se juega ${articulo}`);
    const titulos = AYUDA.secciones.map((s) => s.titulo);
    assert.equal(titulos[0], 'Objetivo', juego);
    for (const t of ['Cómo se juega', 'Los botones', 'Consejo']) assert.ok(titulos.includes(t), `${juego}: falta «${t}»`);
    for (const s of AYUDA.secciones) {
      assert.ok(s.texto || s.pasos?.length || s.puntos?.length, `${juego}: «${s.titulo}» vacío`);
      for (const frase of [s.texto, ...(s.pasos || []), ...(s.puntos || [])].filter(Boolean)) {
        assert.doesNotMatch(frase, /\p{Extended_Pictographic}/u, 'sin emojis');
      }
    }
  }
});
