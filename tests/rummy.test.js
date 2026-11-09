import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAzar } from '../js/core/azar.js';
import {
  fichaDe, analizar, esValida, puntosDe, puntosAtril, crearPartida, motivoTurnoNoValido, aplicarJugada, robar,
  ordenarPorNumero, ordenarPorColor, todasLasFichas, COMODINES, nombreFicha,
} from '../js/juegos/rummy/reglas.js';
import { buscar } from '../js/juegos/rummy/buscador.js';

// Ficha por texto: «r7» = 7 rojo (primera copia), «r7'» = segunda copia, «J» / «J'» = comodines.
const COL = { r: 0, b: 1, k: 2, o: 3 };
function f(texto) {
  if (texto === 'J') return 104;
  if (texto === "J'") return 105;
  const copia = texto.endsWith("'") ? 1 : 0;
  const t = texto.replace("'", '');
  return copia * 52 + COL[t[0]] * 13 + Number(t.slice(1)) - 1;
}
const F = (...xs) => xs.map(f);

test('106 fichas: 1–13 en 4 colores, dos de cada, y 2 comodines', () => {
  const todas = todasLasFichas();
  assert.equal(todas.length, 106);
  assert.deepEqual(fichaDe(f('r7')), { id: f('r7'), n: 7, c: 'r' });
  assert.deepEqual(fichaDe(f("o13'")), { id: f("o13'"), n: 13, c: 'o' });
  assert.equal(nombreFicha(f('k1')), '1 negra');
  assert.equal(nombreFicha(104), 'comodín');
  assert.deepEqual(COMODINES, [104, 105]);
});

test('series: 3 o 4 del mismo número y colores distintos', () => {
  assert.ok(esValida(F('r5', 'b5', 'k5')));
  assert.ok(esValida(F('r5', 'b5', 'k5', 'o5')));
  assert.ok(!esValida(F('r5', 'b5')), 'solo dos');
  assert.ok(!esValida(F('r5', "r5'", 'k5')), 'color repetido');
  assert.ok(!esValida(F('r5', 'b5', 'k6')), 'números distintos');
  assert.ok(esValida(F('r5', 'b5', 'J')), 'con comodín');
  assert.ok(!esValida(F('r5', 'b5', 'k5', 'o5', 'J')), 'cinco es demasiado');
  assert.equal(puntosDe(F('r9', 'b9', 'J')), 27);
});

test('escaleras: 3 o más seguidos del mismo color, sin pasar del 13 al 1', () => {
  assert.ok(esValida(F('r7', 'r8', 'r9')));
  assert.ok(esValida(F('k10', 'k11', 'k12', 'k13')));
  assert.ok(esValida(F('r9', 'r7', 'r8')), 'el orden no importa');
  assert.ok(!esValida(F('r12', 'r13', 'r1')), 'el 1 no va después del 13');
  assert.ok(!esValida(F('r7', 'r8', 'b9')), 'colores distintos');
  assert.ok(!esValida(F('r7', 'r9', 'r10')), 'falta el 8');
  assert.ok(esValida(F('r7', 'J', 'r9')), 'comodín en el hueco');
  assert.deepEqual(analizar(F('r9', 'J', 'r7')).orden, F('r7', 'J', 'r9'), 'se ordena para mostrarla');
  assert.ok(esValida(F('r12', 'r13', 'J')), 'comodín por debajo (11)');
  assert.deepEqual(analizar(F('r12', 'r13', 'J')).orden, F('J', 'r12', 'r13'));
  assert.equal(puntosDe(F('o1', 'o2', 'o3')), 6);
  assert.equal(puntosDe(F('r7', 'J', 'r9')), 24);
});

test('una ficha y dos comodines: se toma la lectura de más puntos', () => {
  const a = analizar(F('r10', 'J', "J'"));
  assert.equal(a.tipo, 'escalera', '10-11-12 (33) vale más que 10-10-10 (30)');
  assert.equal(a.puntos, 33);
  assert.equal(analizar(F('r13', 'J', "J'")).tipo, 'serie', 'con un 13 la escalera sería 11-12-13 (36) < 39');
});

test('puntos del atril: comodín vale 30', () => {
  assert.equal(puntosAtril(F('r1', 'b13', 'J')), 44);
});

test('ordenar el atril por número y por color (comodines al final)', () => {
  const atril = F('k2', 'J', 'r9', 'b2', 'r1');
  assert.deepEqual(ordenarPorNumero(atril), F('r1', 'b2', 'k2', 'r9', 'J'));
  assert.deepEqual(ordenarPorColor(atril), F('r1', 'r9', 'b2', 'k2', 'J'));
});

// ---------- Turnos ----------

test('primera bajada: 30 puntos o más, solo con fichas propias y sin tocar la mesa', () => {
  const mesaAntes = [F('o1', 'o2', 'o3')];
  const atrilAntes = F('r10', 'b10', 'k10', 'r2', 'o4');
  const base = { mesaAntes, atrilAntes, bajado: false };
  assert.equal(motivoTurnoNoValido({ ...base, mesa: [...mesaAntes, F('r10', 'b10', 'k10')], atril: F('r2', 'o4') }), null);
  // 2+... no llega: serie de 10 sin la k10 no es válida; probamos algo de pocos puntos
  const poco = { mesaAntes, atrilAntes: F('r2', 'b2', 'k2', 'o9'), bajado: false };
  assert.equal(motivoTurnoNoValido({ ...poco, mesa: [...mesaAntes, F('r2', 'b2', 'k2')], atril: F('o9') }), 'primera');
  // usar la mesa en la primera bajada no vale
  assert.equal(motivoTurnoNoValido({ ...base, mesa: [F('o1', 'o2', 'o3', 'o4'), F('r10', 'b10', 'k10')], atril: F('r2') }), 'primera');
});

test('después de bajar se puede reorganizar la mesa, pero todo debe quedar válido', () => {
  const mesaAntes = [F('r7', 'r8', 'r9', 'r10')];
  const atrilAntes = F('r6', 'b10', 'k10', 'o2');
  const base = { mesaAntes, atrilAntes, bajado: true };
  // r10 pasa a una serie nueva con b10 y k10, y r6 alarga la escalera
  assert.equal(motivoTurnoNoValido({ ...base, mesa: [F('r6', 'r7', 'r8', 'r9'), F('r10', 'b10', 'k10')], atril: F('o2') }), null);
  assert.equal(motivoTurnoNoValido({ ...base, mesa: [F('r7', 'r8'), F('r9', 'r10', 'b10', 'k10')], atril: F('r6', 'o2') }), 'invalida');
  assert.equal(motivoTurnoNoValido({ ...base, mesa: mesaAntes, atril: atrilAntes }), 'sin-fichas');
  // una ficha de la mesa no puede volver al atril
  assert.equal(motivoTurnoNoValido({ ...base, mesa: [F('r7', 'r8', 'r9')], atril: [...atrilAntes, f('r10')] }), 'fichas');
});

test('comodín recuperado: se sustituye por su ficha y se usa en el mismo turno', () => {
  const mesaAntes = [F('r7', 'J', 'r9')];
  const atrilAntes = F('r8', 'b5', 'k5');
  const mesa = [F('r7', 'r8', 'r9'), F('b5', 'k5', 'J')];
  assert.equal(motivoTurnoNoValido({ mesaAntes, atrilAntes, mesa, atril: [], bajado: true }), null);
  // quedarse el comodín en el atril no vale
  assert.equal(motivoTurnoNoValido({ mesaAntes, atrilAntes, mesa: [F('r7', 'r8', 'r9')], atril: F('b5', 'k5', 'J'), bajado: true }), 'fichas');
});

test('reparto, turnos, robar y fin por quedarse sin fichas con puntuación', () => {
  const p = crearPartida({ azar: crearAzar(3) });
  assert.equal(p.jugadores.length, 4);
  assert.ok(p.jugadores.every((j) => j.atril.length === 14));
  assert.equal(p.pozo.length, 106 - 56);
  const t = p.turno;
  robar(p, t);
  assert.equal(p.jugadores[t].atril.length, 15);
  assert.equal(p.turno, (t + 1) % 4);
  // Forzar un final: el jugador en turno baja sus 3 últimas fichas
  const j = p.turno;
  p.jugadores[j].atril = F('r10', 'b10', 'k10');
  p.jugadores[j].bajado = false;
  aplicarJugada(p, j, [F('r10', 'b10', 'k10')], []);
  assert.ok(p.terminada);
  assert.equal(p.ganador, j);
  const total = p.jugadores.reduce((s, x, i) => s + (i === j ? 0 : puntosAtril(x.atril)), 0);
  assert.equal(p.puntos[j], total);
  assert.equal(p.puntos.reduce((s, x) => s + x, 0), 0, 'lo que suma el ganador lo restan los demás');
});

test('pozo vacío y una vuelta sin jugar: gana quien tenga menos puntos', () => {
  const p = crearPartida({ azar: crearAzar(4) });
  p.pozo = [];
  p.jugadores[2].atril = F('r1');
  for (let k = 0; k < 4; k++) robar(p, p.turno);
  assert.ok(p.terminada);
  assert.equal(p.ganador, 2);
});

// ---------- Buscador ----------

function comprobarSolucion(r, obligatorias, opcionales) {
  const puestas = r.combinaciones.flat();
  assert.equal(puestas.length, new Set(puestas).size, 'cada ficha una vez');
  for (const id of obligatorias) assert.ok(puestas.includes(id), 'todas las de la mesa siguen en la mesa');
  for (const id of puestas) assert.ok(obligatorias.includes(id) || opcionales.includes(id), 'solo fichas disponibles');
  for (const c of r.combinaciones) assert.ok(esValida(c), `combinación válida: ${c.map(nombreFicha)}`);
  assert.deepEqual([...r.usadas].sort(), puestas.filter((id) => opcionales.includes(id)).sort());
}

test('buscador: reorganiza la mesa para colocar más fichas', () => {
  const obligatorias = F('r7', 'r8', 'r9', 'r10');
  const opcionales = F('b10', 'k10', 'r6', 'o2');
  const r = buscar({ obligatorias, opcionales, limiteMs: 2000 });
  comprobarSolucion(r, obligatorias, opcionales);
  assert.equal(r.usadas.length, 3, 'r6 en la escalera y la r10 a una serie con b10 y k10');
  assert.ok(r.completa);
});

test('buscador: primera bajada solo si llega a 30 puntos', () => {
  const poco = buscar({ obligatorias: [], opcionales: F('r2', 'b2', 'k2', 'o9'), minPuntos: 30 });
  assert.equal(poco.usadas.length, 0);
  const bastante = buscar({ obligatorias: [], opcionales: F('r10', 'b10', 'k10', 'o1', 'o2', 'o3', 'b4'), minPuntos: 30 });
  assert.equal(bastante.usadas.length, 6);
  assert.ok(bastante.puntos >= 30);
});

test('buscador: usa comodines de la mesa y del atril', () => {
  const obligatorias = F('r7', 'J', 'r9');
  const opcionales = F('r8', 'b5', 'k5');
  const r = buscar({ obligatorias, opcionales, limiteMs: 2000 });
  comprobarSolucion(r, obligatorias, opcionales);
  assert.equal(r.usadas.length, 3, 'recupera el comodín con la r8 y forma b5 k5 J');
});

test('buscador: soluciones siempre válidas en mesas al azar', () => {
  const azar = crearAzar(77);
  for (let k = 0; k < 40; k++) {
    // mesa: varias combinaciones válidas formadas al azar desde una partida
    const p = crearPartida({ azar });
    const mano = p.jugadores[0].atril;
    const previa = buscar({ obligatorias: [], opcionales: [...p.jugadores[1].atril, ...p.jugadores[2].atril], limiteMs: 150 });
    const mesa = previa.combinaciones || [];
    const obligatorias = mesa.flat();
    const r = buscar({ obligatorias, opcionales: mano, limiteMs: 150 });
    assert.ok(r.combinaciones, 'encuentra al menos la mesa tal cual');
    comprobarSolucion(r, obligatorias, mano);
  }
});

test('buscador: respeta el límite de tiempo y devuelve lo mejor encontrado', () => {
  const azar = crearAzar(9);
  const p = crearPartida({ azar });
  const grande = buscar({ obligatorias: [], opcionales: [...p.jugadores[0].atril, ...p.jugadores[1].atril, ...p.jugadores[2].atril], limiteMs: 100 });
  const mesa = grande.combinaciones.flat();
  const t0 = Date.now();
  const r = buscar({ obligatorias: mesa, opcionales: p.pozo.slice(0, 20), limiteMs: 200 });
  assert.ok(Date.now() - t0 < 1000, `tardó ${Date.now() - t0} ms`);
  comprobarSolucion(r, mesa, p.pozo.slice(0, 20));
});

// ---------- Partidas completas con la inteligencia ----------
import { decidir } from '../js/juegos/rummy/ia.js';

function jugarPartida(nivel, semilla, escala) {
  const azar = crearAzar(semilla);
  const p = crearPartida({ azar, nivel });
  let turnos = 0;
  const contar = () => p.mesa.flat().length + p.pozo.length + p.jugadores.reduce((s, j) => s + j.atril.length, 0);
  while (!p.terminada && turnos++ < 600) {
    const j = p.turno;
    const yo = p.jugadores[j];
    const d = decidir({
      mesa: p.mesa, atril: yo.atril, bajado: yo.bajado, nivel,
      otros: p.jugadores.filter((_, i) => i !== j).map((x) => x.atril.length),
      pozo: p.pozo.length, azar: azar.real, escala,
    });
    if (d.tipo === 'jugar') {
      assert.equal(motivoTurnoNoValido({ mesaAntes: p.mesa, atrilAntes: yo.atril, mesa: d.mesa, atril: d.atril, bajado: yo.bajado }), null);
      aplicarJugada(p, j, d.mesa, d.atril);
    } else robar(p, j);
    assert.equal(contar(), 106, 'no se pierde ni se duplica ninguna ficha');
    assert.ok(p.mesa.every(esValida), 'la mesa siempre es válida');
  }
  return { p, turnos };
}

for (const nivel of ['principiante', 'intermedio', 'experto']) {
  test(`partidas completas entre rivales: ${nivel}`, () => {
    for (const semilla of [1, 2, 3]) {
      const { p, turnos } = jugarPartida(nivel, semilla * 31 + nivel.length, 0.03);
      assert.ok(p.terminada, `la partida termina (${turnos} turnos)`);
      assert.ok(p.ganador >= 0 && p.ganador < 4);
      assert.equal(p.puntos.reduce((s, x) => s + x, 0), 0);
      assert.ok(p.puntos[p.ganador] >= 0);
    }
  });
}
