// Auditoría de accesibilidad para pegar en la consola del navegador (o inyectar en pruebas).
// Revisa la pantalla visible: contraste, tamaño de letra, áreas táctiles y desbordes.
// Uso: auditar() → { fallos: [...], avisos: [...] }
//
// Reglas del proyecto: texto ≥ 18 px; contraste ≥ 4,5:1 (3:1 desde 24 px, o 18,66 px en negrita);
// áreas táctiles ≥ 56 px (nunca < 44 px); sin desplazamiento horizontal.
// Excepciones deliberadas: dibujos de iconos (aria-hidden), números ya emparejados de Parejas
// (.eliminada), teclas atenuadas por estar completas (.completa), contenido oculto en pausa.

window.auditar = function auditar() {
  const fallos = [];
  const avisos = [];

  const rgba = (texto) => {
    const m = texto.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  };
  const lum = ([r, g, b]) => {
    const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const mezclar = (arriba, abajo) => {
    const a = arriba[3];
    return [0, 1, 2].map((i) => arriba[i] * a + abajo[i] * (1 - a)).concat(1);
  };
  const fondoDe = (el) => {
    const capas = [];
    for (let n = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) { capas.push(c); if (c[3] === 1) break; }
    }
    let fondo = rgba(getComputedStyle(document.body).backgroundColor);
    for (const c of capas.reverse()) fondo = mezclar(c, fondo);
    return fondo;
  };
  const contraste = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const describir = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : ''} «${t}»`;
  };
  const exento = (el) => el.closest('[aria-hidden="true"], .eliminada, .completa, .en-pausa .sudoku-tablero, .en-pausa .tablero-juego');

  // Texto
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || exento(el)) continue;
    const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!propio) continue;
    const s = getComputedStyle(el);
    const tam = parseFloat(s.fontSize);
    const negrita = Number(s.fontWeight) >= 700;
    if (tam < 18) fallos.push(`letra ${tam}px < 18: ${describir(el)}`);
    let color = rgba(s.color);
    const fondo = fondoDe(el);
    color = mezclar([color[0], color[1], color[2], color[3] * Number(s.opacity)], fondo);
    const minimo = tam >= 24 || (negrita && tam >= 18.66) ? 3 : 4.5;
    const c = contraste(color, fondo);
    if (c < minimo) fallos.push(`contraste ${c.toFixed(2)} < ${minimo}: ${describir(el)}`);
  }

  // Áreas táctiles
  for (const el of document.querySelectorAll('button, a, [role="button"], input, select')) {
    if (!visible(el) || el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    const lado = Math.min(r.width, r.height);
    if (lado < 44) fallos.push(`área táctil ${Math.round(r.width)}×${Math.round(r.height)} < 44: ${describir(el)}`);
    else if (lado < 56 && !el.classList.contains('casilla') && !el.classList.contains('interruptor')) {
      avisos.push(`área táctil ${Math.round(r.width)}×${Math.round(r.height)} < 56: ${describir(el)}`);
    }
    if (!el.textContent.trim() && !el.getAttribute('aria-label')) fallos.push(`botón sin texto ni aria-label: ${describir(el)}`);
  }

  // Desbordes
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    fallos.push(`desplazamiento horizontal: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
  }
  return { fallos: [...new Set(fallos)], avisos: [...new Set(avisos)], alto: document.documentElement.scrollHeight, ventana: window.innerHeight };
};

// Recorre pantallas × tema × tamaño de texto y devuelve solo lo que tenga fallos o desplazamiento.
// `rutas` por defecto: Inicio, Estadísticas, Ajustes y los juegos con partida abierta.
window.matriz = async function matriz(rutas = ['#/', '#/estadisticas', '#/ajustes']) {
  const salida = {};
  const raiz = document.documentElement;
  for (const ruta of rutas) for (const tema of ['claro', 'oscuro']) for (const texto of ['normal', 'grande']) {
    raiz.dataset.tema = tema;
    if (texto === 'grande') raiz.dataset.texto = 'grande'; else delete raiz.dataset.texto;
    if (location.hash !== ruta) { location.hash = ruta; await new Promise((r) => setTimeout(r, 600)); }
    await new Promise((r) => setTimeout(r, 100));
    const a = window.auditar();
    const tablero = document.querySelector('.sudoku-tablero, .tablero-juego');
    const extra = tablero ? { tablero: `${Math.round(tablero.getBoundingClientRect().width)}×${Math.round(tablero.getBoundingClientRect().height)}` } : {};
    if (a.fallos.length || a.alto > a.ventana) {
      salida[`${ruta} ${tema} ${texto}`] = { fallos: a.fallos, scroll: a.alto > a.ventana ? `${a.alto}/${a.ventana}` : 'no', ...extra };
    }
  }
  return salida;
};
