// Service worker de Pasatiempos (ESPECIFICACION.md §2.2).
// «Primero la caché»: la app funciona sin conexión desde la primera visita.
//
// AL PUBLICAR CUALQUIER CAMBIO: subir VERSION (y la de js/version.js; una prueba
// comprueba que coinciden). Así el iPad detecta que hay versión nueva.
// AL AÑADIR O QUITAR ARCHIVOS: actualizar ARCHIVOS (una prueba lo comprueba).

const VERSION = 1;
const CACHE = `pasatiempos-v${VERSION}`;

const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/base.css',
  'css/componentes.css',
  'css/pantallas.css',
  'fonts/AtkinsonHyperlegible-Bold.woff2',
  'fonts/AtkinsonHyperlegible-Regular.woff2',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icono-192.png',
  'icons/icono-512-maskable.png',
  'icons/icono-512.png',
  'js/app.js',
  'js/version.js',
  'js/core/actualizacion.js',
  'js/core/ajustes.js',
  'js/core/azar.js',
  'js/core/db.js',
  'js/core/estadisticas.js',
  'js/core/formato.js',
  'js/core/final.js',
  'js/core/partidas.js',
  'js/core/reloj.js',
  'js/core/tema.js',
  'js/core/ui.js',
  'js/juegos/catalogo.js',
  'js/juegos/parejas/index.js',
  'js/juegos/parejas/parejas.css',
  'js/juegos/parejas/reglas.js',
  'js/juegos/sudoku/generador.js',
  'js/juegos/sudoku/index.js',
  'js/juegos/sudoku/reglas.js',
  'js/juegos/sudoku/resolutor.js',
  'js/juegos/sudoku/sudoku.css',
  'js/juegos/sudoku/tablero.js',
  'js/juegos/sudoku/tecnicas.js',
  'js/pantallas/ajustes.js',
  'js/pantallas/elegir-partida.js',
  'js/pantallas/estadisticas.js',
  'js/pantallas/inicio.js',
];

self.addEventListener('install', (evento) => {
  // `cache: 'reload'` evita copiar versiones viejas de la caché HTTP del navegador.
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(ARCHIVOS.map((url) => new Request(url, { cache: 'reload' })))),
  );
  // No se activa solo: espera a que la persona toque «actualizar» (ver mensaje 'actualizar').
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
      if (nombre.startsWith('pasatiempos-') && nombre !== CACHE) await caches.delete(nombre);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  evento.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Abrir la app (con cualquier #ruta) → siempre la página principal guardada.
    if (request.mode === 'navigate') {
      return (await cache.match('index.html')) || fetch(request);
    }
    const guardada = await cache.match(request, { ignoreSearch: true });
    if (guardada) return guardada;
    try {
      return await fetch(request);
    } catch {
      return new Response('', { status: 504, statusText: 'Sin conexión' });
    }
  })());
});
