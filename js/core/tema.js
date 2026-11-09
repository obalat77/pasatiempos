// Aplica el tema (claro / oscuro / automático) y el tamaño del texto.

const raiz = document.documentElement;
const consultaOscuro = window.matchMedia('(prefers-color-scheme: dark)');

function actualizarColorBarra() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(raiz).getPropertyValue('--fondo').trim();
}

export function aplicarTema(tema) {
  if (tema === 'claro' || tema === 'oscuro') raiz.dataset.tema = tema;
  else delete raiz.dataset.tema;
  actualizarColorBarra();
}

export function aplicarTexto(tamano) {
  if (tamano === 'grande') raiz.dataset.texto = 'grande';
  else delete raiz.dataset.texto;
}

/** Aplica los ajustes actuales y los mantiene al día. */
export function iniciarTema(ajustes) {
  aplicarTema(ajustes.obtener('tema'));
  aplicarTexto(ajustes.obtener('texto'));
  ajustes.alCambiar((clave, valor) => {
    if (clave === 'tema') aplicarTema(valor);
    if (clave === 'texto') aplicarTexto(valor);
  });
  consultaOscuro.addEventListener('change', actualizarColorBarra);
}
