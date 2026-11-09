// Sudoku — interfaz común de juego (ESPECIFICACION.md §2.4 y §5.1).
// Une la lógica (reglas.js, generador.js) con la pantalla y el guardado.
import { h, icono, botonInicio } from '../../core/ui.js';
import { cronometro, tiempo } from '../../core/formato.js';
import { DIFICULTADES, buscarJuego } from '../catalogo.js';
import { elegirPartida } from '../../pantallas/elegir-partida.js';
import { generarSudoku } from './generador.js';
import { fila, columna, bloque } from './tablero.js';
import * as R from './reglas.js';

const ID = 'sudoku';

function cargarEstilos() {
  if (document.getElementById('estilos-sudoku')) return;
  document.head.append(h('link', { id: 'estilos-sudoku', rel: 'stylesheet', href: 'js/juegos/sudoku/sudoku.css' }));
}

/** Espera a que el navegador pinte (para mostrar «Preparando…» antes de un cálculo). */
const trasPintar = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

let actual = null; // instancia montada

class PartidaSudoku {
  constructor(contenedor, ctx) {
    this.ctx = ctx;
    this.contenedor = contenedor;
    this.sel = -1;
    this.modoNotas = false;
    this.pausada = false;
    this.terminada = false;
    this.segundosBase = 0;   // segundos acumulados antes del tramo actual
    this.tramoDesde = null;  // ms en que empezó a contar el tramo actual (null = parado)
    this.alCambiarVisibilidad = () => this.visibilidad();
    this.alPulsarTecla = (e) => this.tecla(e);
  }

  // ---------- Arranque ----------

  async iniciar() {
    const { ctx } = this;
    const raiz = h('div', { class: 'sudoku' }, h('p', { class: 'sudoku-preparando' }, 'Preparando el tablero…'));
    this.raiz = raiz;
    this.contenedor.append(raiz);

    let guardada = ctx.nueva ? null : await ctx.partidas.obtener(ID);
    if (!ctx.nueva && !guardada) {
      // Nada que reanudar (p. ej. se recargó tras terminar): volver a Inicio.
      ctx.navegar('');
      return;
    }
    if (guardada?.estado?.solucion) {
      this.p = guardada.estado;
      this.inicio = guardada.inicio;
      this.segundosBase = guardada.segundos || 0;
    } else {
      await trasPintar();
      const dificultad = ctx.nueva?.dificultad || 'facil';
      this.p = R.crearPartida(generarSudoku(dificultad));
      this.inicio = Date.now();
      await this.guardar();
    }
    if (actual !== this) return; // se salió mientras se preparaba

    this.construir();
    this.pintar();
    this.arrancarReloj();
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad);
    document.addEventListener('keydown', this.alPulsarTecla);
  }

  // ---------- Pantalla ----------

  construir() {
    const { ctx } = this;
    const dificultad = DIFICULTADES[this.p.dificultad];
    this.mostrarReloj = ctx.ajustes.obtener('sudoku.cronometro');

    this.tiempoEl = h('span', { class: 'sudoku-tiempo', role: 'timer', 'aria-label': 'Tiempo de juego',
      hidden: !this.mostrarReloj });
    this.pausaBtn = h('button', { type: 'button', class: 'boton-pausa', on: { click: () => this.alternarPausa() } });

    const cabecera = h('header', { class: 'sudoku-cabecera' },
      h('div', { class: 'fila-botones' }, botonInicio(() => ctx.navegar('')), this.pausaBtn),
      h('div', { class: 'fila-titulo' },
        h('div', { class: 'sudoku-titulo' }, h('h1', {}, 'Sudoku'), h('span', {}, dificultad)),
        this.tiempoEl));

    this.casillas = [];
    const tablero = h('div', { class: 'sudoku-tablero', role: 'group', 'aria-label': 'Tablero de Sudoku' });
    for (let i = 0; i < 81; i++) {
      const f = fila(i), c = columna(i);
      const clases = ['casilla'];
      if (c % 3 === 2 && c < 8) clases.push('borde-bloque-d');
      if (r3(f) && f < 8) clases.push('borde-bloque-a');
      if (c === 8) clases.push('ultima-columna');
      if (f === 8) clases.push('ultima-fila');
      const b = h('button', { type: 'button', class: clases.join(' '), on: { click: () => this.seleccionar(i) } });
      this.casillas.push(b);
      tablero.append(b);
    }
    this.tableroEl = tablero;

    const herramienta = (nombre, texto, accion) =>
      h('button', { type: 'button', class: 'herramienta', on: { click: accion } }, icono(nombre), texto);
    this.notasBtn = herramienta('notas', 'Notas: no', () => this.alternarNotas());
    this.notasBtn.setAttribute('aria-pressed', 'false');

    this.teclas = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
      h('button', { type: 'button', class: 'tecla', 'aria-label': `Escribir ${n}`, on: { click: () => this.numero(n) } }, String(n)));

    this.controles = h('div', { class: 'sudoku-controles' },
      h('div', { class: 'sudoku-herramientas' },
        herramienta('deshacer', 'Deshacer', () => this.accion(() => {
          const i = R.deshacer(this.p);
          if (i >= 0) this.sel = i;
          return i >= 0;
        })),
        herramienta('borrar', 'Borrar', () => this.accion(() => this.sel >= 0 && R.borrar(this.p, this.sel))),
        this.notasBtn,
        herramienta('pista', 'Pista', () => this.accion(() => {
          const i = R.darPista(this.p, this.sel);
          if (i >= 0) this.sel = i;
          return i >= 0;
        }))),
      h('div', { class: 'sudoku-teclado' }, this.teclas));

    this.lateral = h('div', { class: 'sudoku-lateral' }, cabecera, this.controles);
    this.raiz.replaceChildren(tablero, this.lateral);
  }

  pintar() {
    const { p, sel } = this;
    const ajustes = this.ctx.ajustes;
    const marcarErrores = ajustes.obtener('sudoku.marcarErrores');
    const resaltarIguales = ajustes.obtener('sudoku.resaltarIguales');
    const valorSel = sel >= 0 ? p.valores[sel] : 0;

    for (let i = 0; i < 81; i++) {
      const b = this.casillas[i];
      const v = p.valores[i];
      const relacionada = sel >= 0 && i !== sel &&
        (fila(i) === fila(sel) || columna(i) === columna(sel) || bloque(i) === bloque(sel));
      b.classList.toggle('dada', R.esDado(p, i));
      b.classList.toggle('seleccionada', i === sel);
      b.classList.toggle('relacionada', relacionada);
      b.classList.toggle('mismo-numero', resaltarIguales && i !== sel && valorSel !== 0 && v === valorSel);
      b.classList.toggle('error', marcarErrores && R.esError(p, i));

      let etiqueta = `Fila ${fila(i) + 1}, columna ${columna(i) + 1}, `;
      if (v) {
        b.textContent = String(v);
        etiqueta += R.esDado(p, i) ? `${v}, número inicial` : String(v);
      } else if (p.notas[i]) {
        const notas = [];
        b.replaceChildren(h('span', { class: 'notas', 'aria-hidden': 'true' },
          [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
            const tiene = R.tieneNota(p, i, n);
            if (tiene) notas.push(n);
            return h('span', {}, tiene ? String(n) : '');
          })));
        etiqueta += `vacía, notas ${notas.join(' ')}`;
      } else {
        b.textContent = '';
        etiqueta += 'vacía';
      }
      if (i === sel) etiqueta += ', seleccionada';
      b.setAttribute('aria-label', etiqueta);
    }

    this.teclas.forEach((t, k) => t.classList.toggle('completa', R.numeroCompleto(p, k + 1)));
    this.notasBtn.setAttribute('aria-pressed', String(this.modoNotas));
    this.notasBtn.lastChild.textContent = this.modoNotas ? 'Notas: sí' : 'Notas: no';
    this.raiz.classList.toggle('modo-notas', this.modoNotas);
    this.raiz.classList.toggle('en-pausa', this.pausada);
    this.raiz.classList.toggle('terminada', this.terminada);
    this.pausaBtn.replaceChildren(...(this.pausada ? [icono('seguir'), 'Seguir'] : [icono('pausa', 2.4), 'Pausa']));
    this.pausaBtn.hidden = this.terminada;
    this.pintarReloj();
  }

  // ---------- Jugadas ----------

  seleccionar(i) {
    if (this.pausada || this.terminada) return;
    this.sel = i;
    this.pintar();
  }

  numero(n) {
    if (this.sel < 0) return;
    this.accion(() => (this.modoNotas ? R.alternarNota(this.p, this.sel, n) : R.ponerNumero(this.p, this.sel, n)));
  }

  alternarNotas() {
    if (this.pausada || this.terminada) return;
    this.modoNotas = !this.modoNotas;
    this.pintar();
  }

  /** Ejecuta una jugada; si cambió algo, repinta, guarda y comprueba si se ha terminado. */
  accion(fn) {
    if (this.pausada || this.terminada) return;
    if (!fn()) return;
    this.pintar();
    if (R.resuelto(this.p)) this.terminar();
    else this.guardar();
  }

  tecla(e) {
    if (this.pausada || this.terminada || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) { this.numero(Number(e.key)); e.preventDefault(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      this.accion(() => this.sel >= 0 && R.borrar(this.p, this.sel));
      e.preventDefault();
      return;
    }
    const mover = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (mover) {
      const base = this.sel < 0 ? 40 : this.sel;
      const destino = base + mover;
      const mismaFila = Math.abs(mover) === 1 ? fila(destino) === fila(base) : true;
      if (destino >= 0 && destino < 81 && mismaFila) this.seleccionar(destino);
      e.preventDefault();
    }
  }

  // ---------- Tiempo ----------

  segundos() {
    const tramo = this.tramoDesde ? (Date.now() - this.tramoDesde) / 1000 : 0;
    return this.segundosBase + tramo;
  }

  arrancarReloj() {
    if (this.tramoDesde || this.pausada || this.terminada) return;
    this.tramoDesde = Date.now();
    this.intervalo = setInterval(() => this.pintarReloj(), 1000);
  }

  pararReloj() {
    if (this.tramoDesde) this.segundosBase = this.segundos();
    this.tramoDesde = null;
    clearInterval(this.intervalo);
  }

  pintarReloj() {
    if (this.tiempoEl && this.mostrarReloj) this.tiempoEl.textContent = cronometro(this.segundos());
  }

  alternarPausa() {
    if (this.terminada) return;
    this.pausada = !this.pausada;
    if (this.pausada) { this.pararReloj(); this.mostrarAvisoPausa(); this.guardar(); }
    else { this.controles.hidden = false; this.avisoPausa?.remove(); this.arrancarReloj(); }
    this.pintar();
  }

  mostrarAvisoPausa() {
    this.avisoPausa = h('section', { class: 'sudoku-aviso' },
      h('h2', {}, 'En pausa'),
      h('p', {}, 'El tiempo está parado.'),
      h('button', { type: 'button', class: 'boton boton-principal boton-grande boton-ancho',
        on: { click: () => this.alternarPausa() } }, 'Seguir jugando'));
    this.controles.hidden = true;
    this.controles.after(this.avisoPausa);
  }

  visibilidad() {
    if (this.terminada) return;
    if (document.visibilityState === 'hidden') {
      this.pararReloj();
      this.guardar();
    } else if (!this.pausada) {
      this.arrancarReloj();
    }
  }

  // ---------- Guardar y terminar ----------

  guardar() {
    if (!this.p || this.terminada) return Promise.resolve();
    const s = this.segundos();
    const { texto, progreso } = R.resumen(this.p);
    const detalle = this.ctx.ajustes.obtener('sudoku.cronometro') ? `${texto} · ${cronometro(s)}` : texto;
    return this.ctx.partidas.guardar({
      juego: ID,
      dificultad: this.p.dificultad,
      inicio: this.inicio,
      segundos: Math.round(s),
      resumen: { titulo: `Sudoku · ${DIFICULTADES[this.p.dificultad]}`, detalle, progreso },
      estado: this.p,
    }).catch((e) => console.error('No se pudo guardar la partida', e));
  }

  async terminar() {
    this.pararReloj();
    this.sel = -1;
    const segundos = Math.round(this.segundos());
    this.segundosBase = segundos; // el reloj de arriba y el tiempo final coinciden
    const dificultad = this.p.dificultad;
    // Mejor tiempo anterior en esta dificultad (para el dato destacado)
    const anteriores = (await this.ctx.partidas.resultados(ID))
      .filter((r) => r.dificultad === dificultad && r.resultado === 'terminada');
    const record = anteriores.length > 0 && anteriores.every((r) => segundos < r.duracionSeg);

    await this.ctx.partidas.cerrar(ID, 'terminada', {
      segundos,
      detalles: { pistas: this.p.pistas, errores: this.p.errores },
      partida: { dificultad, inicio: this.inicio, segundos },
    });
    this.terminada = true;
    this.pintar();

    let destacado;
    if (record) destacado = '¡Nuevo mejor tiempo!';
    else if (this.p.pistas === 0) destacado = 'Sin usar ninguna pista';
    else destacado = this.p.pistas === 1 ? 'Con 1 pista' : `Con ${this.p.pistas} pistas`;

    const aviso = h('section', { class: 'sudoku-aviso', role: 'status' },
      h('h2', {}, '¡Enhorabuena!'),
      h('p', {}, `Sudoku ${DIFICULTADES[dificultad].toLowerCase()} terminado en`),
      h('p', { class: 'tiempo-final' }, tiempo(segundos)),
      h('p', { class: 'destacado' }, destacado),
      h('div', { class: 'botones' },
        h('button', { type: 'button', class: 'boton boton-principal', on: { click: () => this.otraPartida() } },
          'Otra partida'),
        h('button', { type: 'button', class: 'boton boton-secundario', on: { click: () => this.ctx.navegar('') } },
          'Inicio')));
    this.controles.replaceWith(aviso);
  }

  async otraPartida() {
    const eleccion = await elegirPartida(buscarJuego(ID), this.ctx);
    if (eleccion) this.ctx.jugar(ID, eleccion);
  }

  desmontar() {
    document.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
    document.removeEventListener('keydown', this.alPulsarTecla);
    this.pararReloj();
    this.guardar(); // «Inicio» durante una partida guarda y sale sin preguntar
    this.raiz?.remove();
  }
}

const r3 = (f) => f % 3 === 2;

export default {
  id: ID,
  nombre: 'Sudoku',
  descripcion: 'Fácil · Medio · Difícil · Experto',

  async montar(contenedor, ctx) {
    cargarEstilos();
    actual = new PartidaSudoku(contenedor, ctx);
    await actual.iniciar();
  },

  desmontar() {
    actual?.desmontar();
    actual = null;
  },

  /** Guarda la partida ahora (p. ej. antes de actualizar la app). */
  guardar() {
    return actual?.guardar();
  },

  async partidaEnCurso() {
    return actual?.p ? R.resumen(actual.p) : null;
  },
};
