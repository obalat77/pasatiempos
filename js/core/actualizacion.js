// Registro del service worker y aviso de versión nueva (ESPECIFICACION.md §2.2).
//
// Cómo funciona: al abrir la app con internet, el navegador compara sw.js con el publicado.
// Si cambió (se subió VERSION), descarga la versión nueva en segundo plano y la deja
// «esperando». Entonces se muestra el aviso; al tocarlo, se activa y la app se recarga.
import { h } from './ui.js';

const EN_DESARROLLO = ['localhost', '127.0.0.1'].includes(location.hostname);

/**
 * @param {() => Promise<void>|void} antesDeRecargar  guarda la partida antes de recargar
 */
export async function iniciarActualizaciones(antesDeRecargar) {
  if (!('serviceWorker' in navigator)) return;
  // En el ordenador de desarrollo no se usa (la caché ocultaría los cambios),
  // salvo que se pida con ?sw en la dirección para probarlo.
  if (EN_DESARROLLO && !new URLSearchParams(location.search).has('sw')) {
    // Si quedó instalado de una prueba con ?sw, se quita: si no, seguiría sirviendo
    // la copia vieja de la app y los cambios no se verían.
    const registros = await navigator.serviceWorker.getRegistrations();
    if (registros.length) {
      await Promise.all(registros.map((r) => r.unregister()));
      for (const nombre of await caches.keys()) {
        if (nombre.startsWith('pasatiempos-')) await caches.delete(nombre);
      }
      location.reload();
    }
    return;
  }

  // Si ya había una versión controlando la página, un cambio de control es una actualización.
  // La primera vez (instalación) no hay que recargar.
  const habiaVersion = !!navigator.serviceWorker.controller;

  let registro;
  try {
    registro = await navigator.serviceWorker.register('sw.js');
  } catch (error) {
    console.warn('No se pudo activar el modo sin conexión', error);
    return;
  }

  const hayVersionNueva = () => registro.waiting && navigator.serviceWorker.controller;
  const comprobar = () => { if (hayVersionNueva()) mostrarAviso(registro, antesDeRecargar); };

  comprobar();
  registro.addEventListener('updatefound', () => {
    const nuevo = registro.installing;
    nuevo?.addEventListener('statechange', () => { if (nuevo.state === 'installed') comprobar(); });
  });

  // La app puede quedarse abierta días: buscar versión nueva cada vez que se vuelve a ella.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registro.update().catch(() => {});
  });

  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando || !habiaVersion) return;
    recargando = true;
    location.reload();
  });
}

function mostrarAviso(registro, antesDeRecargar) {
  if (document.querySelector('.aviso-version')) return;
  const aviso = h('button', {
    type: 'button',
    class: 'aviso-version',
    on: {
      click: async () => {
        aviso.disabled = true;
        aviso.textContent = 'Actualizando…';
        try { await antesDeRecargar?.(); } catch (e) { console.error(e); }
        registro.waiting?.postMessage({ tipo: 'actualizar' });
      },
    },
  }, 'Hay una versión nueva. Toca para actualizar.');
  document.body.append(aviso);
  document.body.classList.add('con-aviso');
}
