// Utilidades de interfaz: creación de elementos e iconos SVG en línea.

/**
 * Crea un elemento. `attrs` admite: class, style (objeto o texto), dataset (objeto),
 * on (objeto { evento: función }), y cualquier atributo normal (aria-*, type…).
 * Los hijos pueden ser texto, nodos, arrays, null o false.
 */
export function h(etiqueta, attrs = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(attrs || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class') el.className = valor;
    else if (clave === 'style' && typeof valor === 'object') Object.assign(el.style, valor);
    else if (clave === 'dataset') Object.assign(el.dataset, valor);
    else if (clave === 'on') for (const [ev, fn] of Object.entries(valor)) el.addEventListener(ev, fn);
    else if (clave in el && typeof valor !== 'string') el[clave] = valor;
    else el.setAttribute(clave, valor === true ? '' : valor);
  }
  añadir(el, hijos);
  return el;
}

function añadir(el, hijos) {
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    if (Array.isArray(hijo)) añadir(el, hijo);
    else el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

// Iconos de trazo sencillo (viewBox 24×24). Siempre acompañados de texto.
const TRAZOS = {
  atras: '<path d="M15 6l-6 6 6 6"/>',
  estadisticas: '<path d="M3 20h18M6 16v-5M11 16V6M16 16v-8"/>',
  ajustes: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
};

export function icono(nombre, grosor = 2) {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = `<svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre]}</svg>`;
  return plantilla.content.firstElementChild;
}

/** Botón «‹ Inicio» de la esquina superior izquierda. */
export function botonInicio(alPulsar) {
  return h('button', { type: 'button', class: 'boton-inicio', on: { click: alPulsar } },
    icono('atras', 2.4), 'Inicio');
}

/** Selector segmentado. `opciones`: [{ valor, texto, clase? }]. */
export function segmentado(etiqueta, opciones, valorActual, alCambiar) {
  const grupo = h('div', { class: 'segmentado', role: 'group', 'aria-label': etiqueta });
  const pintar = (valor) => {
    for (const b of grupo.children) b.setAttribute('aria-pressed', String(b.dataset.valor === valor));
  };
  for (const op of opciones) {
    grupo.append(h('button', {
      type: 'button', class: op.clase || null, dataset: { valor: op.valor },
      on: { click: () => { pintar(op.valor); alCambiar(op.valor); } },
    }, op.texto));
  }
  pintar(valorActual);
  return grupo;
}

/**
 * Ventana modal sencilla (sin animaciones). `contenido` recibe la función `cerrar`
 * y devuelve los nodos del cuerpo. Se cierra con «Cancelar» o al llamar a `cerrar`.
 * Devuelve una promesa que se resuelve al cerrarse, con el valor pasado a `cerrar`.
 */
export function dialogo({ titulo, contenido, textoCancelar = 'Cancelar' }) {
  return new Promise((resolver) => {
    const d = h('dialog', { class: 'dialogo', 'aria-labelledby': 'titulo-dialogo' });
    let valor;
    const cerrar = (v) => { valor = v; d.close(); };
    d.append(
      h('h2', { id: 'titulo-dialogo', class: 'dialogo-titulo' }, titulo),
      contenido(cerrar),
      h('button', { type: 'button', class: 'boton boton-claro boton-ancho dialogo-cancelar',
        on: { click: () => cerrar(undefined) } }, textoCancelar));
    d.addEventListener('close', () => { d.remove(); resolver(valor); });
    document.body.append(d);
    d.showModal();
  });
}

/** Fila con texto e interruptor (76 × 44). */
export function filaInterruptor(texto, activo, alCambiar) {
  const boton = h('button', {
    type: 'button', class: 'interruptor', 'aria-label': texto, 'aria-pressed': String(activo),
    on: {
      click: () => {
        const nuevo = boton.getAttribute('aria-pressed') !== 'true';
        boton.setAttribute('aria-pressed', String(nuevo));
        alCambiar(nuevo);
      },
    },
  }, h('span'));
  return h('div', { class: 'fila-ajuste' }, h('span', {}, texto), boton);
}
