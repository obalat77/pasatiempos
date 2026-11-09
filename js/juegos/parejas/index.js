// Parejas de números — interfaz común de juego (ESPECIFICACION.md §2.4 y §5.3).
import { h, icono, botonInicio } from '../../core/ui.js';
import { cronometro } from '../../core/formato.js';
import { Reloj } from '../../core/reloj.js';
import { tarjetaFinal, datoDestacado, esRecord } from '../../core/final.js';
import { buscarJuego } from '../catalogo.js';
import { elegirPartida } from '../../pantallas/elegir-partida.js';
import * as R from './reglas.js';

const ID = 'parejas';
const FILAS_MINIMAS = 8; // el tablero siempre muestra al menos 8 filas, como en el diseño

const INSTRUCCION = () => [
  'Toca dos números ', h('strong', {}, 'iguales'), ' o que ', h('strong', {}, 'sumen 10'), '.',
];

const MOTIVOS = {
  numeros: 'Esos dos no son iguales ni suman 10.',
  conexion: 'Esos dos no están seguidos: hay números en medio.',
};

function cargarEstilos() {
  if (document.getElementById('estilos-parejas')) return;
  document.head.append(h('link', { id: 'estilos-parejas', rel: 'stylesheet', href: 'js/juegos/parejas/parejas.css' }));
}

let actual = null;

class PartidaParejas {
  constructor(contenedor, ctx) {
    this.ctx = ctx;
    this.contenedor = contenedor;
    this.sel = -1;
    this.pistaMarcada = null;     // [i, j] o 'añadir'
    this.terminada = false;
    this.reloj = new Reloj(0, () => this.pintarReloj());
    this.alCambiarVisibilidad = () => this.visibilidad();
  }

  async iniciar() {
    const { ctx } = this;
    this.raiz = h('div', { class: 'parejas' }, h('p', { class: 'parejas-preparando' }, 'Preparando el tablero…'));
    this.contenedor.append(this.raiz);

    const guardada = ctx.nueva ? null : await ctx.partidas.obtener(ID);
    if (!ctx.nueva && !guardada?.estado?.valores) { ctx.navegar(''); return; }
    if (guardada) {
      this.p = guardada.estado;
      this.inicio = guardada.inicio;
      this.reloj.base = guardada.segundos || 0;
    } else {
      this.p = R.crearPartida(R.generarTablero());
      this.inicio = Date.now();
      await this.guardar();
    }
    if (actual !== this) return;

    this.construir();
    this.pintar();
    this.reloj.arrancar();
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad);
    // Una partida guardada podría haberse quedado ya sin jugadas: cerrarla al abrir.
    const estado = R.estado(this.p);
    if (estado === 'ganada') this.terminar('ganada');
    else if (estado === 'sin-jugadas') this.terminar('perdida');
  }

  // ---------- Pantalla ----------

  construir() {
    this.quedanEl = h('span', {});
    this.tiempoVertical = h('span', { class: 'parejas-tiempo solo-vertical', role: 'timer', 'aria-label': 'Tiempo de juego' });
    this.tiempoHorizontal = h('span', { class: 'solo-horizontal' });
    const cabecera = h('header', { class: 'parejas-cabecera' },
      botonInicio(() => this.ctx.navegar('')),
      h('div', { class: 'parejas-titulo' },
        h('h1', {}, 'Parejas de números'),
        h('span', { class: 'subtitulo' }, this.quedanEl, this.tiempoHorizontal)),
      this.tiempoVertical);

    this.instruccion = h('p', { class: 'parejas-instruccion', 'aria-live': 'polite' }, INSTRUCCION());

    this.rejilla = h('div', { class: 'parejas-rejilla', role: 'group', 'aria-label': 'Tablero de números' });
    this.tablero = h('div', { class: 'parejas-tablero' }, this.rejilla);

    const herramienta = (nombre, texto, accion) =>
      h('button', { type: 'button', class: 'herramienta', on: { click: accion } }, icono(nombre), texto);
    this.quedanAñadirV = h('span', { class: 'quedan-añadir solo-vertical' });
    this.quedanAñadirH = h('span', { class: 'quedan-añadir solo-horizontal' });
    this.añadirBtn = h('button', { type: 'button', class: 'herramienta boton-añadir', on: { click: () => this.añadir() } },
      h('span', {}, 'Añadir números'), this.quedanAñadirV, this.quedanAñadirH);
    this.controles = h('div', { class: 'parejas-controles' },
      herramienta('deshacer', 'Deshacer', () => this.deshacer()),
      herramienta('pista', 'Pista', () => this.pista()),
      this.añadirBtn);

    this.lateral = h('div', { class: 'parejas-lateral' }, cabecera, this.instruccion, this.controles);
    this.raiz.replaceChildren(this.tablero, this.lateral);
  }

  pintar() {
    const { p } = this;
    const total = Math.max(FILAS_MINIMAS * R.COLUMNAS, Math.ceil(p.valores.length / R.COLUMNAS) * R.COLUMNAS);
    const marcadas = Array.isArray(this.pistaMarcada) ? this.pistaMarcada : [];
    const celdas = [];
    for (let i = 0; i < total; i++) {
      if (i >= p.valores.length) {
        celdas.push(h('div', { class: 'celda', 'aria-hidden': 'true' }));
        continue;
      }
      const v = p.valores[i];
      const quitada = p.quitadas[i];
      const clases = ['celda'];
      if (quitada) clases.push('quitada');
      if (i === this.sel) clases.push('seleccionada');
      if (marcadas.includes(i)) clases.push('pista');
      const etiqueta = `Fila ${Math.floor(i / 9) + 1}, columna ${(i % 9) + 1}, ${v}`
        + (quitada ? ', ya emparejado' : '') + (i === this.sel ? ', seleccionado' : '')
        + (marcadas.includes(i) ? ', pareja sugerida' : '');
      celdas.push(h('button', {
        type: 'button', class: clases.join(' '), 'aria-label': etiqueta,
        'aria-disabled': quitada ? 'true' : null,
        on: { click: () => this.tocar(i) },
      }, String(v)));
    }
    this.rejilla.replaceChildren(...celdas);

    const { texto } = R.resumen(p);
    this.quedanEl.textContent = texto;
    this.quedanAñadirV.textContent = `Quedan ${p.añadidosRestantes}`;
    this.quedanAñadirH.textContent = `(quedan ${p.añadidosRestantes})`;
    this.añadirBtn.disabled = p.añadidosRestantes <= 0 || this.terminada;
    this.añadirBtn.setAttribute('aria-label', `Añadir números, quedan ${p.añadidosRestantes}`);
    this.añadirBtn.classList.toggle('pista', this.pistaMarcada === 'añadir');
    this.pintarReloj();
  }

  pintarReloj() {
    if (!this.tiempoVertical) return;
    const t = cronometro(this.reloj.segundos());
    this.tiempoVertical.textContent = t;
    this.tiempoHorizontal.textContent = ` · ${t}`;
  }

  avisar(texto) {
    if (texto) {
      this.instruccion.textContent = texto;
      this.instruccion.classList.add('aviso');
    } else {
      this.instruccion.replaceChildren(...INSTRUCCION());
      this.instruccion.classList.remove('aviso');
    }
  }

  // ---------- Jugadas ----------

  tocar(i) {
    if (this.terminada || this.p.quitadas[i]) return;
    if (this.sel === -1 || this.sel === i) {
      this.sel = this.sel === i ? -1 : i;
      this.avisar(null);
      this.pintar();
      return;
    }
    const motivo = R.motivoNoPareja(this.p, this.sel, i);
    if (motivo) {
      // Aviso suave; queda seleccionado el segundo número.
      this.sel = i;
      this.avisar(MOTIVOS[motivo] || null);
      this.pintar();
      return;
    }
    R.emparejar(this.p, this.sel, i);
    this.despuesDeJugar();
  }

  añadir() {
    if (this.terminada || !R.añadirNumeros(this.p)) return;
    this.despuesDeJugar();
    this.tablero.scrollTop = this.tablero.scrollHeight; // que se vean los números nuevos
  }

  deshacer() {
    if (this.terminada || !R.deshacer(this.p)) return;
    this.despuesDeJugar();
  }

  pista() {
    if (this.terminada) return;
    const pista = R.darPista(this.p);
    this.pistaMarcada = pista;
    this.sel = -1;
    if (pista === 'añadir') this.avisar('No quedan parejas a la vista. Toca «Añadir números».');
    else this.avisar('Te marco una pareja: tócala para quitarla.');
    this.pintar();
    if (Array.isArray(pista)) {
      this.rejilla.children[pista[0]]?.scrollIntoView({ block: 'nearest' });
    }
    this.guardar();
  }

  despuesDeJugar() {
    this.sel = -1;
    this.pistaMarcada = null;
    this.avisar(null);
    this.pintar();
    const estado = R.estado(this.p);
    if (estado === 'ganada') this.terminar('ganada');
    else if (estado === 'sin-jugadas') this.terminar('perdida');
    else this.guardar();
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
    const quedan = R.quedan(this.p);
    const quitados = this.p.parejas * 2;
    return this.ctx.partidas.guardar({
      juego: ID,
      dificultad: null,
      inicio: this.inicio,
      segundos: Math.round(s),
      resumen: {
        titulo: 'Parejas de números',
        detalle: `${R.resumen(this.p).texto} · ${cronometro(s)}`,
        progreso: quitados / Math.max(1, quitados + quedan),
      },
      estado: this.p,
    }).catch((e) => console.error('No se pudo guardar la partida', e));
  }

  async terminar(resultado) {
    const segundos = this.reloj.detenerFinal();
    const anteriores = (await this.ctx.partidas.resultados(ID)).filter((r) => r.resultado === 'ganada');
    const record = resultado === 'ganada' && esRecord(segundos, anteriores);
    const quedaban = R.quedan(this.p);
    await this.ctx.partidas.cerrar(ID, resultado, {
      segundos,
      detalles: {
        pistas: this.p.pistas,
        parejas: this.p.parejas,
        añadidos: R.AÑADIDOS_POR_PARTIDA - this.p.añadidosRestantes,
        quedaban,
      },
      partida: { dificultad: null, inicio: this.inicio, segundos },
    });
    this.terminada = true;
    this.pintar();

    const opciones = { alOtraPartida: () => this.otraPartida(), alInicio: () => this.ctx.navegar('') };
    const tarjeta = resultado === 'ganada'
      ? tarjetaFinal({ ...opciones, titulo: '¡Enhorabuena!', texto: 'Has dejado el tablero vacío en', segundos,
          destacado: datoDestacado({ record, pistas: this.p.pistas }) })
      : tarjetaFinal({ ...opciones, titulo: 'No quedan jugadas',
          texto: `Ya no hay parejas ni números para añadir. Quedaban ${quedaban === 1 ? '1 número' : `${quedaban} números`}.`,
          destacado: this.p.parejas === 1 ? 'Has quitado 1 pareja' : `Has quitado ${this.p.parejas} parejas` });
    this.avisar(resultado === 'ganada' ? '¡Tablero vacío!' : 'Partida terminada.');
    this.controles.replaceWith(tarjeta);
  }

  async otraPartida() {
    const eleccion = await elegirPartida(buscarJuego(ID), this.ctx);
    if (eleccion) this.ctx.jugar(ID, eleccion);
  }

  desmontar() {
    document.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
    this.reloj.parar();
    this.guardar(); // «Inicio» durante una partida guarda y sale sin preguntar
    this.raiz?.remove();
  }
}

export default {
  id: ID,
  nombre: 'Parejas de números',
  descripcion: 'Iguales o que sumen 10',

  async montar(contenedor, ctx) {
    cargarEstilos();
    actual = new PartidaParejas(contenedor, ctx);
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
