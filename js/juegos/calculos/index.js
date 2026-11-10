// Cálculos cruzados — interfaz común de juego (ESPECIFICACION.md §2.4 y §5.4).
import { h, icono, botonInicio } from '../../core/ui.js';
import { cronometro } from '../../core/formato.js';
import { Reloj } from '../../core/reloj.js';
import { tarjetaFinal, datoDestacado, esRecord } from '../../core/final.js';
import { DIFICULTADES, buscarJuego } from '../catalogo.js';
import { elegirPartida } from '../../pantallas/elegir-partida.js';
import * as R from './reglas.js';

const ID = 'calculos';
const CASILLA_MAXIMA = 88;   // tamaño del diseño
const NOMBRE_OPERADOR = { [R.SUMA]: 'más', [R.RESTA]: 'menos', [R.POR]: 'por', [R.ENTRE]: 'entre' };

const INSTRUCCION = () => ['Coloca los números para que ', h('strong', {}, 'todas las cuentas'), ' sean correctas.'];

function cargarEstilos() {
  if (document.getElementById('estilos-calculos')) return;
  document.head.append(h('link', { id: 'estilos-calculos', rel: 'stylesheet', href: 'js/juegos/calculos/calculos.css' }));
}

const trasPintar = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

let actual = null;

class PartidaCalculos {
  constructor(contenedor, ctx) {
    this.ctx = ctx;
    this.contenedor = contenedor;
    this.sel = -1;
    this.terminada = false;
    this.reloj = new Reloj(0, () => this.pintarReloj());
    this.alCambiarVisibilidad = () => this.visibilidad();
  }

  async iniciar() {
    const { ctx } = this;
    this.raiz = h('div', { class: 'calculos' }, h('p', { class: 'calculos-preparando' }, 'Preparando el tablero…'));
    this.contenedor.append(this.raiz);

    const guardada = ctx.nueva ? null : await ctx.partidas.obtener(ID);
    if (!ctx.nueva && !guardada?.estado?.solucion) { ctx.navegar(''); return; }
    if (guardada) {
      this.p = guardada.estado;
      this.inicio = guardada.inicio;
      this.reloj.base = guardada.segundos || 0;
    } else {
      await trasPintar();
      this.p = R.crearPartida(R.generarCalculos(ctx.nueva.dificultad || 'facil'));
      this.inicio = Date.now();
      await this.guardar();
    }
    if (actual !== this) return;

    this.construir();
    this.pintar();
    this.reloj.arrancar();
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad);
    if (R.resuelto(this.p)) this.terminar();
  }

  // ---------- Pantalla ----------

  construir() {
    const { p } = this;
    const dificultad = DIFICULTADES[p.dificultad];
    this.raiz.classList.toggle('grande', p.m === 4);

    this.tiempoVertical = h('span', { class: 'calculos-tiempo solo-vertical', role: 'timer', 'aria-label': 'Tiempo de juego' });
    this.tiempoHorizontal = h('span', { class: 'solo-horizontal' });
    const cabecera = h('header', { class: 'calculos-cabecera' },
      botonInicio(() => this.ctx.navegar('')),
      h('div', { class: 'calculos-titulo' },
        h('h1', {}, 'Cálculos cruzados'),
        h('span', { class: 'subtitulo' }, dificultad, this.tiempoHorizontal)),
      this.tiempoVertical);

    this.instruccion = h('p', { class: 'calculos-instruccion', 'aria-live': 'polite' }, INSTRUCCION());

    // Tablero: se construye una vez; pintar() solo actualiza los huecos.
    const { lado, casillas } = R.plano(p);
    this.lado = lado;
    this.huecosEl = new Map();
    this.tablero = h('div', { class: 'calculos-tablero', role: 'group', 'aria-label': 'Tablero de cuentas',
      style: { gridTemplateColumns: `repeat(${lado}, var(--casilla))` } });
    casillas.forEach((c, pos) => {
      const fila = Math.floor(pos / lado) + 1, col = (pos % lado) + 1;
      let el;
      if (c.tipo === 'numero' && R.esHueco(p, c.k)) {
        el = h('button', { type: 'button', class: 'cc hueco', on: { click: () => this.seleccionar(c.k) } });
        el.dataset.fila = fila; el.dataset.col = col;
        this.huecosEl.set(c.k, el);
      } else if (c.tipo === 'numero') {
        el = h('div', { class: 'cc dado', 'aria-label': `Fila ${fila}, columna ${col}, ${p.solucion[c.k]}` }, String(p.solucion[c.k]));
      } else if (c.tipo === 'operador') {
        el = h('div', { class: 'cc operador', 'aria-label': NOMBRE_OPERADOR[c.v] }, c.v);
      } else if (c.tipo === 'igual') {
        el = h('div', { class: 'cc operador', 'aria-label': 'igual' }, '=');
      } else if (c.tipo === 'resultado') {
        el = h('div', { class: 'cc resultado', 'aria-label': `resultado ${c.v}` }, String(c.v));
      } else {
        el = h('div', { class: 'cc', 'aria-hidden': 'true' });
      }
      this.tablero.append(el);
    });
    this.zona = h('div', { class: 'calculos-zona' }, this.tablero);
    this.observador = new ResizeObserver(() => this.ajustarTamaño());
    this.observador.observe(this.zona);

    this.fichas = h('div', { class: 'fichas', role: 'group', 'aria-label': 'Números para colocar' });
    this.bandejaEl = h('div', { class: 'calculos-bandeja' },
      h('span', { class: 'etiqueta' }, 'Toca una casilla vacía y después un número:'),
      this.fichas);

    const herramienta = (nombre, texto, accion) =>
      h('button', { type: 'button', class: 'herramienta', on: { click: accion } }, icono(nombre), texto);
    this.controles = h('div', { class: 'calculos-controles' },
      herramienta('deshacer', 'Deshacer', () => this.accion(() => {
        const k = R.deshacer(this.p);
        if (k >= 0) this.sel = k;
        return k >= 0;
      })),
      herramienta('borrar', 'Borrar', () => this.accion(() => this.sel >= 0 && R.borrar(this.p, this.sel))),
      herramienta('pista', 'Pista', () => this.accion(() => {
        const k = R.darPista(this.p, this.sel);
        if (k >= 0) this.sel = k;
        return k >= 0;
      })));

    this.lateral = h('div', { class: 'calculos-lateral' }, cabecera, this.instruccion, this.bandejaEl, this.controles);
    this.raiz.replaceChildren(this.zona, this.lateral);
  }

  /** Casillas tan grandes como quepan (máximo 88 px), sin recortar nunca el tablero. */
  ajustarTamaño() {
    const hueco = parseFloat(getComputedStyle(this.raiz).getPropertyValue('--hueco')) || 6;
    const { width, height } = this.zona.getBoundingClientRect();
    const lado = Math.floor(Math.min((width - (this.lado - 1) * hueco) / this.lado,
      (height - (this.lado - 1) * hueco) / this.lado, CASILLA_MAXIMA));
    if (lado > 0) this.raiz.style.setProperty('--casilla', `${lado}px`);
  }

  pintar() {
    const { p } = this;
    const marcarErrores = this.ctx.ajustes.obtener('calculos.marcarErrores');
    for (const [k, el] of this.huecosEl) {
      const v = p.valores[k];
      el.textContent = v ? String(v) : '';
      el.classList.toggle('lleno', v !== 0);
      el.classList.toggle('seleccionado', k === this.sel);
      el.classList.toggle('error', marcarErrores && R.esError(p, k));
      el.setAttribute('aria-label', `Fila ${el.dataset.fila}, columna ${el.dataset.col}, ${v ? v : 'vacía'}`
        + (k === this.sel ? ', seleccionada' : ''));
    }
    const quedan = R.bandeja(p);
    this.fichas.replaceChildren(...(quedan.length
      ? quedan.map((n) => h('button', { type: 'button', class: 'ficha', 'aria-label': `Colocar ${n}`,
          on: { click: () => this.colocar(n) } }, String(n)))
      : [h('span', { class: 'sin-fichas' }, 'Ya están todos colocados')]));
    this.pintarReloj();
  }

  pintarReloj() {
    if (!this.tiempoVertical) return;
    const t = cronometro(this.reloj.segundos());
    this.tiempoVertical.textContent = t;
    this.tiempoHorizontal.textContent = ` · ${t}`;
  }

  avisar(texto) {
    if (texto) { this.instruccion.textContent = texto; this.instruccion.classList.add('aviso'); }
    else { this.instruccion.replaceChildren(...INSTRUCCION()); this.instruccion.classList.remove('aviso'); }
  }

  // ---------- Jugadas ----------

  seleccionar(k) {
    if (this.terminada) return;
    this.sel = k;
    this.avisar(null);
    this.pintar();
  }

  colocar(n) {
    if (this.terminada) return;
    let k = this.sel;
    if (k < 0) {
      // Sin casilla elegida: si solo queda un hueco vacío, va ahí; si no, se pide elegir.
      const vacios = this.p.huecos.filter((x) => !this.p.valores[x]);
      if (vacios.length !== 1) { this.avisar('Primero toca una casilla vacía.'); return; }
      k = vacios[0];
      this.sel = k;
    }
    this.accion(() => R.colocar(this.p, k, n));
  }

  accion(fn) {
    if (this.terminada || !fn()) return;
    this.avisar(null);
    this.pintar();
    if (R.resuelto(this.p)) { this.terminar(); return; }
    if (R.bandeja(this.p).length === 0) {
      this.avisar('Están todos colocados, pero alguna cuenta no sale. Cambia algún número.');
    }
    this.guardar();
  }

  visibilidad() {
    if (this.terminada) return;
    if (document.visibilityState === 'hidden') { this.reloj.parar(); this.guardar(); }
    else this.reloj.arrancar();
  }

  // ---------- Guardar y terminar ----------

  guardar() {
    if (!this.p || this.terminada) return Promise.resolve();
    const s = this.reloj.segundos();
    const { texto, progreso } = R.resumen(this.p);
    return this.ctx.partidas.guardar({
      juego: ID,
      dificultad: this.p.dificultad,
      inicio: this.inicio,
      segundos: Math.round(s),
      resumen: { titulo: `Cálculos · ${DIFICULTADES[this.p.dificultad]}`, detalle: `${texto} · ${cronometro(s)}`, progreso },
      estado: this.p,
    }).catch((e) => console.error('No se pudo guardar la partida', e));
  }

  async terminar() {
    if (this.terminada) return;
    this.terminada = true; // desde ya, el tablero no admite más jugadas
    const segundos = this.reloj.detenerFinal();
    this.sel = -1;
    this.pintar();
    const dificultad = this.p.dificultad;
    const anteriores = (await this.ctx.partidas.resultados(ID).catch(() => []))
      .filter((r) => r.dificultad === dificultad && r.resultado === 'terminada');
    await this.ctx.partidas.cerrar(ID, 'terminada', {
      segundos,
      detalles: { pistas: this.p.pistas, errores: this.p.errores },
      partida: { dificultad, inicio: this.inicio, segundos },
    }).catch((e) => console.error('No se pudo guardar el resultado', e));
    this.avisar('¡Todas las cuentas son correctas!');
    this.bandejaEl.hidden = true;
    this.controles.replaceWith(tarjetaFinal({
      titulo: '¡Enhorabuena!',
      texto: `Nivel ${DIFICULTADES[dificultad].toLowerCase()} terminado en`,
      segundos,
      destacado: datoDestacado({ record: esRecord(segundos, anteriores), pistas: this.p.pistas }),
      alOtraPartida: () => this.otraPartida(),
      alInicio: () => this.ctx.navegar(''),
    }));
  }

  async otraPartida() {
    const eleccion = await elegirPartida(buscarJuego(ID), this.ctx);
    if (eleccion) this.ctx.jugar(ID, eleccion);
  }

  desmontar() {
    document.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
    this.observador?.disconnect();
    this.reloj.parar();
    this.guardar();
    this.raiz?.remove();
  }
}

export default {
  id: ID,
  nombre: 'Cálculos cruzados',
  descripcion: 'Cuentas en forma de crucigrama',

  async montar(contenedor, ctx) {
    cargarEstilos();
    actual = new PartidaCalculos(contenedor, ctx);
    await actual.iniciar();
  },

  desmontar() {
    actual?.desmontar();
    actual = null;
  },

  guardar() {
    return actual?.guardar();
  },

  async partidaEnCurso() {
    return actual?.p ? R.resumen(actual.p) : null;
  },
};
