import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearAzar } from '../js/core/azar.js';
import {
  crearPartida, conectadas, puedenEmparejar, motivoNoPareja, emparejar, añadirNumeros, deshacer,
  buscarPareja, contarParejas, estado, darPista, generarTablero, quedan, resumen, numerosCasan,
  AÑADIDOS_POR_PARTIDA,
} from '../js/juegos/parejas/reglas.js';

// Construye una partida a partir de filas de texto: dígito = número, «x» = ya quitado.
function tablero(...filas) {
  const texto = filas.join('');
  const p = crearPartida([...texto].map((c) => (c === 'x' ? 5 : Number(c))));
  [...texto].forEach((c, i) => { if (c === 'x') p.quitadas[i] = true; });
  return p;
}
const idx = (fila, col) => fila * 9 + col;

test('números que casan: iguales o que suman 10', () => {
  assert.ok(numerosCasan(3, 3));
  assert.ok(numerosCasan(3, 7));
  assert.ok(numerosCasan(5, 5));
  assert.ok(numerosCasan(1, 9));
  assert.ok(!numerosCasan(3, 4));
  assert.ok(!numerosCasan(9, 2));
});

test('conexión: juntas en horizontal, vertical y diagonal', () => {
  const p = tablero('123456789', '987654321', '111111111');
  assert.ok(conectadas(p, idx(0, 0), idx(0, 1)), 'horizontal');
  assert.ok(conectadas(p, idx(0, 4), idx(1, 4)), 'vertical');
  assert.ok(conectadas(p, idx(0, 4), idx(1, 5)), 'diagonal ↘');
  assert.ok(conectadas(p, idx(0, 4), idx(1, 3)), 'diagonal ↙');
  assert.ok(conectadas(p, idx(1, 3), idx(0, 4)), 'el orden no importa');
  assert.ok(!conectadas(p, idx(0, 0), idx(0, 2)), 'con un número en medio, no');
  assert.ok(!conectadas(p, idx(0, 0), idx(2, 0)), 'columna con número en medio, no');
  assert.ok(!conectadas(p, idx(0, 0), idx(1, 2)), 'ni fila, ni columna, ni diagonal');
  assert.ok(!conectadas(p, idx(0, 0), idx(0, 0)), 'consigo misma, no');
});

test('conexión: a distancia si solo hay casillas quitadas en medio', () => {
  const p = tablero(
    '1xxx1xxx2',
    'xxxx5xxxx',
    'xx4xxxx6x',
    '8xxx9xxx7');
  assert.ok(conectadas(p, idx(0, 0), idx(0, 4)), 'misma fila');
  assert.ok(conectadas(p, idx(0, 4), idx(3, 4)) === false, 'columna: hay un 5 en medio');
  assert.ok(conectadas(p, idx(1, 4), idx(3, 4)), 'columna con quitadas en medio');
  assert.ok(conectadas(p, idx(0, 0), idx(2, 2)), 'diagonal ↘ larga');
  const q = tablero('1xxxxxxxx', 'x3xxxxxxx', 'xx4xxxxxx');
  assert.ok(!conectadas(q, idx(0, 0), idx(2, 2)), 'diagonal con un número en medio, no');
  assert.ok(conectadas(p, idx(0, 8), idx(2, 6)), 'diagonal ↙ con quitada en medio');
  assert.ok(conectadas(p, idx(2, 7), idx(3, 8)), 'diagonal ↘ junta');
});

test('conexión: final de una fila con principio de la siguiente (texto seguido)', () => {
  const p = tablero(
    '12345678x',
    'xx3456789');
  // El 8 (fila 0, col 7) y el 3 (fila 1, col 2): seguidos leyendo, saltando quitadas
  assert.ok(conectadas(p, idx(0, 7), idx(1, 2)));
  assert.ok(puedenEmparejar(p, idx(0, 7), idx(1, 2)) === false, 'conectados pero 8 y 3 no casan');
  const q = tablero('123456787', 'x3');
  assert.ok(puedenEmparejar(q, idx(0, 8), idx(1, 1)), '7 y 3 seguidos de una fila a otra');
  assert.ok(conectadas(q, idx(0, 8), idx(1, 1)));
});

test('motivo por el que no se puede emparejar', () => {
  const p = tablero('123456789', '9x7654321');
  assert.equal(motivoNoPareja(p, idx(0, 0), idx(0, 1)), 'numeros');      // 1 y 2
  assert.equal(motivoNoPareja(p, idx(0, 0), idx(0, 8)), 'conexion');     // 1 y 9 lejos
  assert.equal(motivoNoPareja(p, idx(0, 0), idx(1, 1)), 'casilla');      // quitada
  assert.equal(motivoNoPareja(p, idx(0, 8), idx(1, 0)), null);           // 9 y 9 seguidos de fila a fila
  assert.equal(motivoNoPareja(p, idx(0, 2), idx(1, 2)), null);           // 3 y 7 en columna
});

test('emparejar quita las casillas y las filas que quedan vacías', () => {
  const p = tablero('19xxxxxxx', '55', );
  assert.equal(p.valores.length, 11);
  assert.ok(emparejar(p, 0, 1));
  assert.equal(p.valores.length, 2, 'la primera fila, ya vacía, desaparece');
  assert.deepEqual(p.valores, [5, 5]);
  assert.ok(emparejar(p, 0, 1));
  assert.equal(p.valores.length, 0, 'también la última fila incompleta');
  assert.equal(estado(p), 'ganada');
  assert.equal(p.parejas, 2);
});

test('emparejar no hace nada si la pareja no es válida', () => {
  const p = tablero('123456789');
  assert.equal(emparejar(p, 0, 1), false);
  assert.equal(p.historial.length, 0);
  assert.equal(quedan(p), 9);
});

test('añadir números: copia los que quedan al final, 4 veces como máximo', () => {
  const p = tablero('12x45xxxx', '6');
  assert.ok(añadirNumeros(p));
  assert.deepEqual(p.valores.slice(10), [1, 2, 4, 5, 6]);
  assert.equal(quedan(p), 10);
  assert.equal(p.añadidosRestantes, AÑADIDOS_POR_PARTIDA - 1);
  añadirNumeros(p); añadirNumeros(p); añadirNumeros(p);
  assert.equal(p.añadidosRestantes, 0);
  assert.equal(añadirNumeros(p), false);
});

test('deshacer devuelve emparejamientos (con filas) y añadidos', () => {
  const p = tablero('19xxxxxxx', '2345');
  const inicio = JSON.stringify([p.valores, p.quitadas]);
  emparejar(p, 0, 1);           // borra la primera fila
  añadirNumeros(p);
  assert.ok(deshacer(p));
  assert.equal(p.añadidosRestantes, AÑADIDOS_POR_PARTIDA);
  assert.ok(deshacer(p));
  assert.equal(JSON.stringify([p.valores, p.quitadas]), inicio);
  assert.equal(p.parejas, 0);
  assert.equal(deshacer(p), false);
});

test('pista: una pareja válida, o «añadir», o nada', () => {
  const p = tablero('193456782');
  assert.deepEqual(darPista(p), [0, 1]);
  assert.ok(puedenEmparejar(p, 0, 1));
  const sinParejas = tablero('1212');
  assert.equal(darPista(sinParejas), 'añadir');
  sinParejas.añadidosRestantes = 0;
  assert.equal(darPista(sinParejas), null);
  assert.equal(estado(sinParejas), 'sin-jugadas');
  assert.equal(p.pistas, 1);
});

test('estado: sin parejas pero con añadidos se sigue jugando', () => {
  const p = tablero('1212');
  assert.equal(estado(p), 'jugando');
  añadirNumeros(p); // 1 2 1 2 1 2 1 2 → siguen sin casar
  assert.equal(buscarPareja(p), null);
});

test('tablero inicial: 27–36 números del 1 al 9, con parejas posibles', () => {
  const azar = crearAzar(5);
  for (let k = 0; k < 50; k++) {
    const t = generarTablero({ azar });
    assert.ok(t.length >= 27 && t.length <= 36);
    assert.ok(t.every((v) => Number.isInteger(v) && v >= 1 && v <= 9));
    assert.ok(contarParejas(crearPartida(t)) >= 4);
  }
});

test('partida completa: jugando siempre la primera pareja se llega al final', () => {
  const azar = crearAzar(11);
  let ganadas = 0;
  for (let k = 0; k < 30; k++) {
    const p = crearPartida(generarTablero({ azar }));
    let pasos = 0;
    while (estado(p) === 'jugando' && pasos++ < 5000) {
      const par = buscarPareja(p);
      if (par) assert.ok(emparejar(p, ...par));
      else assert.ok(añadirNumeros(p));
    }
    assert.ok(['ganada', 'sin-jugadas'].includes(estado(p)));
    if (estado(p) === 'ganada') ganadas++;
    // copia JSON: la partida se puede guardar
    assert.deepEqual(JSON.parse(JSON.stringify(p)).valores, p.valores);
  }
  assert.ok(ganadas > 0, 'alguna partida se gana');
});

test('resumen en español', () => {
  assert.equal(resumen(tablero('12')).texto, 'Quedan 2 números');
  assert.equal(resumen(tablero('1x')).texto, 'Queda 1 número');
  assert.equal(resumen(tablero('xx')).texto, 'No quedan números');
});
