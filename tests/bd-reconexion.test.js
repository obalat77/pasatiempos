// La base de datos se reabre sola si Safari corta la conexión (p. ej. tras mucho
// tiempo en segundo plano). Se usa una imitación mínima de IndexedDB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBD } from '../js/core/db.js';

function crearFabricaFalsa() {
  const almacenes = new Map(); // nombre → { keyPath, datos: Map }
  const conexiones = [];
  let version = 0;
  const tarde = (fn) => setTimeout(fn, 0);

  function peticion(fn, perdida) {
    const p = { onsuccess: null, onerror: null };
    tarde(() => {
      if (perdida) { p.error = new Error('Connection to Indexed Database server lost'); p.onerror?.(); return; }
      p.result = fn();
      p.onsuccess?.();
    });
    return p;
  }

  function crearConexion() {
    const bd = {
      version,
      cerrada: false,
      perdida: false,
      objectStoreNames: { contains: (n) => almacenes.has(n) },
      close() { bd.cerrada = true; },
      createObjectStore(nombre, { keyPath } = {}) {
        almacenes.set(nombre, { keyPath, datos: new Map() });
        return { createIndex() {} };
      },
      transaction() {
        if (bd.cerrada) throw Object.assign(new Error('La conexión está cerrada'), { name: 'InvalidStateError' });
        const tx = { oncomplete: null, onerror: null, onabort: null };
        let pendientes = 0;
        const terminar = (ok) => tarde(() => (ok ? tx.oncomplete?.() : tx.onabort?.()));
        tx.objectStore = (nombre) => {
          const { keyPath, datos } = almacenes.get(nombre);
          const op = (fn) => {
            pendientes++;
            const p = peticion(fn, bd.perdida);
            tarde(() => tarde(() => { if (--pendientes === 0) terminar(!bd.perdida); }));
            return p;
          };
          return {
            keyPath,
            get: (k) => op(() => structuredClone(datos.get(k))),
            getAll: () => op(() => [...datos.values()].map((v) => structuredClone(v))),
            getAllKeys: () => op(() => [...datos.keys()]),
            put: (v, k) => op(() => { const clave = keyPath ? v[keyPath] : k; datos.set(clave, structuredClone(v)); return clave; }),
            delete: (k) => op(() => { datos.delete(k); }),
            clear: () => op(() => { datos.clear(); }),
          };
        };
        return tx;
      },
    };
    conexiones.push(bd);
    return bd;
  }

  return {
    conexiones,
    open(_nombre, v) {
      const p = {};
      tarde(() => {
        const nueva = v !== undefined && v > version;
        if (nueva) version = v;
        p.result = crearConexion();
        if (nueva) p.onupgradeneeded?.();
        p.onsuccess?.();
      });
      return p;
    },
  };
}

test('si la conexión se cierra, se reabre y la operación se hace', async () => {
  const fabrica = crearFabricaFalsa();
  const db = await abrirBD(fabrica);
  assert.equal(db.tipo, 'indexeddb');
  await db.poner('partidas_en_curso', { juego: 'sudoku', segundos: 1 });

  fabrica.conexiones.at(-1).close(); // Safari cierra la conexión
  await db.poner('partidas_en_curso', { juego: 'sudoku', segundos: 2 });
  assert.equal((await db.obtener('partidas_en_curso', 'sudoku')).segundos, 2);
});

test('si la conexión se pierde a mitad (UnknownError), se reabre y se reintenta', async () => {
  const fabrica = crearFabricaFalsa();
  const db = await abrirBD(fabrica);
  const antes = fabrica.conexiones.length;
  fabrica.conexiones.at(-1).perdida = true;

  await db.poner('ajustes', 'oscuro', 'tema');
  assert.equal(fabrica.conexiones.length, antes + 1, 'se ha abierto una conexión nueva');
  assert.equal(await db.obtener('ajustes', 'tema'), 'oscuro');
});

test('dos fallos a la vez abren una sola conexión nueva', async () => {
  const fabrica = crearFabricaFalsa();
  const db = await abrirBD(fabrica);
  const antes = fabrica.conexiones.length;
  fabrica.conexiones.at(-1).perdida = true;

  await Promise.all([db.poner('ajustes', 'claro', 'tema'), db.poner('ajustes', 'grande', 'texto')]);
  assert.equal(fabrica.conexiones.length, antes + 1);
  assert.deepEqual(await db.entradas('ajustes'), [['tema', 'claro'], ['texto', 'grande']]);
});
