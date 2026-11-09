import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaLarga, fechaRelativa, numero, cronometro, tiempo, duracionTexto } from '../js/core/formato.js';

test('fecha larga en español', () => {
  assert.equal(fechaLarga(new Date(2026, 10, 9)), 'lunes, 9 de noviembre');
  assert.equal(fechaLarga(new Date(2026, 0, 1)), 'jueves, 1 de enero');
  assert.equal(fechaLarga(new Date(2026, 6, 15)), 'miércoles, 15 de julio');
});

test('fecha relativa', () => {
  const hoy = new Date(2026, 10, 9, 10, 0);
  assert.equal(fechaRelativa(new Date(2026, 10, 9, 0, 5), hoy), 'Hoy');
  assert.equal(fechaRelativa(new Date(2026, 10, 8, 23, 59), hoy), 'Ayer');
  assert.equal(fechaRelativa(new Date(2026, 10, 7), hoy), '7 nov');
  assert.equal(fechaRelativa(new Date(2025, 11, 31), hoy), '31 dic 2025');
});

test('números con punto de millar', () => {
  assert.equal(numero(0), '0');
  assert.equal(numero(999), '999');
  assert.equal(numero(1250), '1.250');
  assert.equal(numero(1234567), '1.234.567');
  assert.equal(numero(-30), '−30');
});

test('cronómetro', () => {
  assert.equal(cronometro(0), '00:00');
  assert.equal(cronometro(252), '04:12');
  assert.equal(cronometro(3725), '1:02:05');
});

test('duración en texto', () => {
  assert.equal(duracionTexto(0), '0 min');
  assert.equal(duracionTexto(30), 'menos de 1 min');
  assert.equal(duracionTexto(45 * 60), '45 min');
  assert.equal(duracionTexto(3 * 3600 + 20 * 60), '3 h 20 min');
  assert.equal(duracionTexto(2 * 3600), '2 h');
});

test('tiempo de partida', () => {
  assert.equal(tiempo(0), '0:00');
  assert.equal(tiempo(408), '6:48');
  assert.equal(tiempo(692), '11:32');
  assert.equal(tiempo(3725), '1:02:05');
});
