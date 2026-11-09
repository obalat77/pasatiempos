// Base de datos del dispositivo (ESPECIFICACION.md §2.5).
// Usa IndexedDB; si no está disponible (o falla al abrir), guarda en memoria
// con la misma interfaz, para que la app siga funcionando y para las pruebas.

export const NOMBRE_BD = 'pasatiempos';
export const VERSION_BD = 1;

/** Almacenes y su forma de clave. */
export const ALMACENES = {
  ajustes: {},                                         // clave → valor
  partidas_en_curso: { keyPath: 'juego' },             // una por juego
  resultados: { keyPath: 'id', autoIncrement: true },  // una fila por partida
  progreso: {},                                        // clave → valor
};

const NOMBRES = Object.keys(ALMACENES);

function comprobarAlmacen(almacen) {
  if (!NOMBRES.includes(almacen)) throw new Error(`Almacén desconocido: ${almacen}`);
}

/**
 * Interfaz común (todas las funciones devuelven promesas):
 *   obtener(almacen, clave)        → valor o undefined
 *   todos(almacen)                 → [valores]
 *   entradas(almacen)              → [[clave, valor]]
 *   poner(almacen, valor, clave?)  → clave
 *   borrar(almacen, clave)
 *   vaciar(almacen)
 *   reemplazarTodo({ almacen: [[clave, valor]] })   (copia de seguridad, todo o nada)
 *   tipo                           → 'indexeddb' | 'memoria'
 */
export async function abrirBD(fabrica = globalThis.indexedDB) {
  if (!fabrica) return crearBDMemoria();
  try {
    return envolverIDB(await abrirIDB(fabrica));
  } catch (error) {
    console.warn('IndexedDB no disponible; los datos solo se guardarán mientras la app esté abierta.', error);
    return crearBDMemoria();
  }
}

// ---------- IndexedDB ----------

function promesa(peticion) {
  return new Promise((resolver, rechazar) => {
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

function finTransaccion(tx) {
  return new Promise((resolver, rechazar) => {
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error || new Error('Transacción cancelada'));
  });
}

async function abrirIDB(fabrica) {
  // Se abre en la versión que tenga. Si es antigua o le falta algún almacén
  // (p. ej. la creó otra herramienta sin ellos), se reabre con una versión mayor
  // para que `onupgradeneeded` cree lo que falte.
  let bd = await abrirIDBVersion(fabrica);
  if (bd.version < VERSION_BD || NOMBRES.some((n) => !bd.objectStoreNames.contains(n))) {
    const version = Math.max(VERSION_BD, bd.version + 1);
    bd.close();
    bd = await abrirIDBVersion(fabrica, version);
  }
  return bd;
}

function abrirIDBVersion(fabrica, version) {
  return new Promise((resolver, rechazar) => {
    const peticion = version === undefined ? fabrica.open(NOMBRE_BD) : fabrica.open(NOMBRE_BD, version);
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      for (const [nombre, opciones] of Object.entries(ALMACENES)) {
        if (!bd.objectStoreNames.contains(nombre)) {
          const almacen = bd.createObjectStore(nombre, opciones);
          if (nombre === 'resultados') almacen.createIndex('juego', 'juego');
        }
      }
    };
    peticion.onsuccess = () => {
      const bd = peticion.result;
      // Si otra pestaña con una versión nueva necesita actualizar, cerramos.
      bd.onversionchange = () => bd.close();
      resolver(bd);
    };
    peticion.onerror = () => rechazar(peticion.error);
    peticion.onblocked = () => rechazar(new Error('Base de datos bloqueada por otra pestaña'));
  });
}

function envolverIDB(bd) {
  const almacen = (nombre, modo = 'readonly') => {
    comprobarAlmacen(nombre);
    return bd.transaction(nombre, modo).objectStore(nombre);
  };
  return {
    tipo: 'indexeddb',
    obtener: (nombre, clave) => promesa(almacen(nombre).get(clave)),
    todos: (nombre) => promesa(almacen(nombre).getAll()),
    async entradas(nombre) {
      const a = almacen(nombre);
      const [claves, valores] = await Promise.all([promesa(a.getAllKeys()), promesa(a.getAll())]);
      return claves.map((c, i) => [c, valores[i]]);
    },
    poner(nombre, valor, clave) {
      const a = almacen(nombre, 'readwrite');
      return promesa(a.keyPath ? a.put(valor) : a.put(valor, clave));
    },
    borrar: (nombre, clave) => promesa(almacen(nombre, 'readwrite').delete(clave)),
    vaciar: (nombre) => promesa(almacen(nombre, 'readwrite').clear()),
    async reemplazarTodo(datos) {
      const tx = bd.transaction(NOMBRES, 'readwrite');
      const fin = finTransaccion(tx);
      for (const nombre of NOMBRES) {
        const a = tx.objectStore(nombre);
        a.clear();
        for (const [clave, valor] of datos[nombre] || []) {
          if (a.keyPath) a.put(valor); else a.put(valor, clave);
        }
      }
      return fin;
    },
  };
}

// ---------- Memoria ----------

export function crearBDMemoria() {
  const datos = Object.fromEntries(NOMBRES.map((n) => [n, new Map()]));
  const siguienteId = Object.fromEntries(NOMBRES.map((n) => [n, 1]));
  const copia = (v) => (v === undefined ? v : structuredClone(v));

  function claveDe(nombre, valor, clave) {
    const { keyPath, autoIncrement } = ALMACENES[nombre];
    if (!keyPath) {
      if (clave === undefined) throw new Error(`Falta la clave para ${nombre}`);
      return clave;
    }
    if (valor[keyPath] === undefined && autoIncrement) valor[keyPath] = siguienteId[nombre]++;
    else if (typeof valor[keyPath] === 'number' && autoIncrement) {
      siguienteId[nombre] = Math.max(siguienteId[nombre], valor[keyPath] + 1);
    }
    if (valor[keyPath] === undefined) throw new Error(`Falta ${keyPath} en ${nombre}`);
    return valor[keyPath];
  }

  const ordenar = (mapa) => [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    tipo: 'memoria',
    async obtener(nombre, clave) { comprobarAlmacen(nombre); return copia(datos[nombre].get(clave)); },
    async todos(nombre) { comprobarAlmacen(nombre); return ordenar(datos[nombre]).map(([, v]) => copia(v)); },
    async entradas(nombre) { comprobarAlmacen(nombre); return ordenar(datos[nombre]).map(([c, v]) => [c, copia(v)]); },
    async poner(nombre, valor, clave) {
      comprobarAlmacen(nombre);
      const v = copia(valor);
      const k = claveDe(nombre, v, clave);
      datos[nombre].set(k, v);
      return k;
    },
    async borrar(nombre, clave) { comprobarAlmacen(nombre); datos[nombre].delete(clave); },
    async vaciar(nombre) { comprobarAlmacen(nombre); datos[nombre].clear(); },
    async reemplazarTodo(nuevos) {
      // Preparar todo antes de tocar nada, para que sea «todo o nada».
      const preparado = {};
      for (const nombre of NOMBRES) {
        preparado[nombre] = new Map();
        for (const [clave, valor] of nuevos[nombre] || []) {
          const v = copia(valor);
          preparado[nombre].set(claveDe(nombre, v, clave), v);
        }
      }
      for (const nombre of NOMBRES) datos[nombre] = preparado[nombre];
    },
  };
}
