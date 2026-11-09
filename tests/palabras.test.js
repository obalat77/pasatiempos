// Validación de los niveles de Palabras (ESPECIFICACION.md §5.2) y pruebas de sus reglas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sePuedeFormar, problemasCrucigrama, problemasNivel, tamaño,
  crearPartida, comprobar, completo, darPista, casillaVisible, casillasDe, mezclar,
} from '../js/juegos/palabras/reglas.js';

const raiz = new URL('..', import.meta.url);
const niveles = JSON.parse(readFileSync(new URL('data/palabras/niveles.json', raiz), 'utf8'));
const excluidas = new Set(readFileSync(new URL('data/palabras/excluidas.txt', raiz), 'utf8')
  .split('\n').filter((l) => !l.startsWith('#')).join(' ').split(/\s+/).filter(Boolean));

// ---------- Validador de los niveles ----------

test('hay 1.000 niveles numerados del 1 al 1.000', () => {
  assert.equal(niveles.length, 1000);
  niveles.forEach((n, i) => assert.equal(n.id, i + 1));
});

test('todos los niveles son válidos', () => {
  const malos = [];
  for (const n of niveles) {
    const p = problemasNivel(n, excluidas);
    if (p.length) malos.push(`nivel ${n.id}: ${p.join('; ')}`);
  }
  assert.deepEqual(malos, []);
});

test('de 4 letras al principio a 7 al final, sin bajar nunca', () => {
  assert.equal(niveles[0].letras.length, 4);
  assert.equal(niveles.at(-1).letras.length, 7);
  for (let i = 1; i < niveles.length; i++) assert.ok(niveles[i].letras.length >= niveles[i - 1].letras.length, `nivel ${i + 1}`);
});

test('cada rueda de letras es distinta y una de las palabras usa todas las letras', () => {
  const ruedas = new Set();
  for (const n of niveles) {
    const rueda = [...n.letras].sort().join('');
    assert.ok(!ruedas.has(rueda), `rueda repetida en el nivel ${n.id}`);
    ruedas.add(rueda);
    assert.ok(n.palabras.some((w) => w.length === n.letras.length), `nivel ${n.id}: falta la palabra larga`);
  }
});

test('los crucigramas caben en 9×9 casillas y tienen al menos 3 palabras', () => {
  for (const n of niveles) {
    const { filas, columnas } = tamaño(n.crucigrama);
    assert.ok(filas <= 9 && columnas <= 9, `nivel ${n.id}: ${filas}×${columnas}`);
    assert.ok(n.palabras.length >= 3, `nivel ${n.id}`);
  }
});

test('ninguna palabra excluida aparece en ningún nivel (ni como extra)', () => {
  const todas = niveles.flatMap((n) => [...n.palabras, ...n.extra]);
  assert.deepEqual(todas.filter((w) => excluidas.has(w)), []);
});

// ---------- Reglas ----------

test('formar palabras respetando cuántas veces está cada letra', () => {
  assert.ok(sePuedeFormar('AMOR', ['A', 'M', 'O', 'R']));
  assert.ok(sePuedeFormar('MAR', 'AMOR'));
  assert.ok(!sePuedeFormar('MAMA', 'AMOR'), 'solo hay una M y una A');
  assert.ok(sePuedeFormar('NIÑO', 'OÑIN'));
  assert.ok(!sePuedeFormar('NINO', 'OÑIN'), 'la Ñ no vale como N');
});

test('crucigrama: detecta contradicciones, palabras accidentales y palabras sueltas', () => {
  const bien = [
    { palabra: 'AMOR', fila: 0, col: 0, dir: 'H' },
    { palabra: 'MORA', fila: 0, col: 1, dir: 'V' },
  ];
  assert.deepEqual(problemasCrucigrama(bien), []);
  assert.ok(problemasCrucigrama([...bien, { palabra: 'ROMA', fila: 0, col: 1, dir: 'V' }]).length, 'contradicción');
  // RAMO justo debajo de AMOR en paralelo: forma tiras verticales «AR», «MA»…
  const accidental = [...bien.slice(0, 1), { palabra: 'RAMO', fila: 1, col: 0, dir: 'H' }];
  assert.ok(problemasCrucigrama(accidental).some((p) => p.includes('accidental')));
  const suelta = [...bien, { palabra: 'SOL', fila: 5, col: 5, dir: 'H' }];
  assert.ok(problemasCrucigrama(suelta).some((p) => p.includes('no se cruzan')));
});

const NIVEL = {
  id: 3, letras: ['A', 'M', 'O', 'R'],
  palabras: ['AMOR', 'MORA'],
  extra: ['MAR', 'AMO'],
  crucigrama: [
    { palabra: 'AMOR', fila: 0, col: 0, dir: 'H' },
    { palabra: 'MORA', fila: 0, col: 1, dir: 'V' },
  ],
};

test('el nivel de ejemplo de la especificación es válido', () => {
  assert.deepEqual(problemasNivel(NIVEL), []);
  assert.ok(problemasNivel({ ...NIVEL, extra: ['AMOR'] }).length, 'repetida');
  assert.ok(problemasNivel({ ...NIVEL, palabras: ['AMOR', 'MORA', 'SOL'] }).length, 'no se puede formar');
  assert.ok(problemasNivel(NIVEL, new Set(['MAR'])).length, 'excluida');
});

test('comprobar palabras: nuevas, repetidas, extra, cortas y no válidas', () => {
  const p = crearPartida(NIVEL);
  assert.equal(comprobar(p, NIVEL, 'AM'), 'corta');
  assert.equal(comprobar(p, NIVEL, 'ROMA'), 'no');
  assert.equal(comprobar(p, NIVEL, 'AMOR'), 'nueva');
  assert.equal(comprobar(p, NIVEL, 'AMOR'), 'repetida');
  assert.equal(comprobar(p, NIVEL, 'MAR'), 'extra');
  assert.equal(comprobar(p, NIVEL, 'MAR'), 'extra-repetida');
  assert.deepEqual(p.extras, ['MAR']);
  assert.equal(completo(p, NIVEL), false);
  assert.equal(comprobar(p, NIVEL, 'MORA'), 'nueva');
  assert.equal(completo(p, NIVEL), true);
});

test('las letras compartidas se ven al encontrar cualquiera de las dos palabras', () => {
  const p = crearPartida(NIVEL);
  comprobar(p, NIVEL, 'AMOR');
  assert.ok(casillaVisible(p, NIVEL, '0,1'), 'la M de AMOR es también la de MORA');
  assert.ok(!casillaVisible(p, NIVEL, '1,1'));
});

test('pista: descubre letras de la palabra pendiente más corta; si se completa, cuenta', () => {
  const p = crearPartida(NIVEL);
  comprobar(p, NIVEL, 'AMOR');
  const vistas = [];
  for (let k = 0; k < 3; k++) vistas.push(darPista(p, NIVEL));
  assert.deepEqual(vistas.map((v) => v.clave), ['1,1', '2,1', '3,1'], 'la M ya se veía');
  assert.equal(vistas.at(-1).completada, true);
  assert.ok(p.encontradas.includes('MORA'));
  assert.equal(p.pistas, 3);
  assert.equal(darPista(p, NIVEL), null);
  assert.ok(casillasDe(NIVEL.crucigrama[1]).every((c) => casillaVisible(p, NIVEL, c)));
});

test('mezclar cambia el orden y conserva las letras', () => {
  const p = crearPartida(NIVEL);
  const antes = p.letras.join('');
  mezclar(p);
  assert.notEqual(p.letras.join(''), antes);
  assert.equal([...p.letras].sort().join(''), [...antes].sort().join(''));
});
