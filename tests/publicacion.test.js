// Comprobaciones antes de publicar: versión, archivos del modo sin conexión e instalación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../js/version.js';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');
const sw = leer('sw.js');

function archivosDe(carpeta) {
  const salida = [];
  for (const nombre of readdirSync(join(RAIZ, carpeta))) {
    const ruta = join(carpeta, nombre);
    if (statSync(join(RAIZ, ruta)).isDirectory()) salida.push(...archivosDe(ruta));
    else salida.push(relative('.', ruta).split('\\').join('/'));
  }
  return salida;
}

const listaSW = () => {
  const bloque = sw.match(/const ARCHIVOS = \[([\s\S]*?)\];/)[1];
  return [...bloque.matchAll(/'([^']+)'/g)].map((m) => m[1]);
};

test('la versión de la app coincide con la del service worker', () => {
  const versionSW = Number(sw.match(/const VERSION = (\d+);/)[1]);
  assert.equal(versionSW, VERSION, 'subir VERSION en sw.js y en js/version.js a la vez');
});

test('el service worker guarda todos los archivos de la app (y solo los que existen)', () => {
  const esperados = new Set([
    'index.html', 'manifest.webmanifest', 'data/palabras/niveles.json',
    ...['css', 'js', 'icons'].flatMap(archivosDe),
    ...archivosDe('fonts').filter((f) => f.endsWith('.woff2')),
  ]);
  const enLista = listaSW().filter((f) => f !== './');
  const faltan = [...esperados].filter((f) => !enLista.includes(f));
  const sobran = enLista.filter((f) => !esperados.has(f));
  assert.deepEqual(faltan, [], 'archivos de la app que no están en ARCHIVOS de sw.js');
  assert.deepEqual(sobran, [], 'entradas de ARCHIVOS que no existen');
  assert.equal(new Set(enLista).size, enLista.length, 'sin repetidos');
});

test('manifiesto válido para instalar la app', () => {
  const m = JSON.parse(leer('manifest.webmanifest'));
  assert.equal(m.name, 'Pasatiempos');
  assert.equal(m.short_name, 'Pasatiempos');
  assert.equal(m.lang, 'es');
  assert.equal(m.display, 'standalone');
  assert.equal(m.orientation, undefined, 'sin orientación fija');
  for (const tam of ['180x180', '192x192', '512x512']) {
    assert.ok(m.icons.some((i) => i.sizes === tam), `icono ${tam}`);
  }
  for (const i of m.icons) assert.ok(existsSync(join(RAIZ, i.src)), `existe ${i.src}`);
});

test('index.html enlaza manifiesto, icono de iOS y archivos que existen', () => {
  const html = leer('index.html');
  assert.match(html, /<link rel="manifest" href="manifest.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon.png">/);
  assert.match(html, /apple-mobile-web-app-capable/);
  for (const [, ruta] of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) {
    assert.ok(existsSync(join(RAIZ, ruta)), `existe ${ruta}`);
  }
  assert.doesNotMatch(html, /https?:\/\//, 'nada se carga de internet');
});

test('ningún archivo de la app carga recursos de internet', () => {
  const codigo = ['css', 'js'].flatMap(archivosDe);
  for (const f of codigo) {
    assert.doesNotMatch(leer(f), /(?:url\(|import\s*\(?|from\s+)['"]?https?:\/\//, f);
  }
});
