// Palabras — interfaz común de juego (ESPECIFICACION.md §2.4 y §5.2).
import { h, icono, botonInicio } from '../../core/ui.js';
import { numero } from '../../core/formato.js';
import { Reloj } from '../../core/reloj.js';
import { tarjetaFinal } from '../../core/final.js';
import * as R from './reglas.js';

const ID = 'palabras';
const CLAVE_NIVEL = 'palabras.nivel';
const CASILLA_MAXIMA = 88;
const CAJA_MAXIMA = 64;
const SVG = 'http://www.w3.org/2000/svg';

const MENSAJES = {
  repetida: 'Ya la tenías',
  extra: '¡Palabra extra!',
  'extra-repetida': 'Ya la tenías',
  no: 'No está en este nivel',
  corta: 'Mínimo 3 letras',
};

let niveles = null;
async function cargarNiveles() {
  if (!niveles) niveles = await (await fetch('data/palabras/niveles.json')).json();
  return niveles;
}

function cargarEstilos() {
  if (document.getElementById('estilos-palabras')) return;
  document.head.append(h('link', { id: 'estilos-palabras', rel: 'stylesheet', href: 'js/juegos/palabras/palabras.css' }));
}

let actual = null;

class PartidaPalabras {
  constructor(contenedor, ctx) {
    this.ctx = ctx;
    this.contenedor = contenedor;
    this.modo = ctx.ajustes.obtener('palabras.modo');   // 'crucigrama' | 'lista'
    this.camino = [];           // índices de las letras elegidas en la rueda
    this.arrastre = null;       // { puntero, añadidas, x, y } mientras se desliza el dedo
    this.terminada = false;
    this.reloj = new Reloj();
    this.alCambiarVisibilidad = () => this.visibilidad();
  }

  async iniciar() {
    const { ctx } = this;
    this.raiz = h('div', { class: 'palabras' }, h('p', { class: 'palabras-preparando' }, 'Preparando el nivel…'));
    this.contenedor.append(this.raiz);
    const todos = await cargarNiveles();
    const guardada = ctx.nueva ? null : await ctx.partidas.obtener(ID);
    if (guardada?.estado?.nivel) {
      this.p = guardada.estado;
      this.inicio = guardada.inicio;
      this.reloj.base = guardada.segundos || 0;
    } else {
      const n = (await ctx.db.obtener('progreso', CLAVE_NIVEL)) || 1;
      if (n > todos.length) { this.mostrarFinDelJuego(todos.length); return; }
      this.p = R.crearPartida(todos[n - 1]);
      this.inicio = Date.now();
      await this.guardar();
    }
    this.nivel = todos[this.p.nivel - 1];
    if (actual !== this) return;
    this.construir();
    this.pintar();
    this.reloj.arrancar();
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad);
  }

  mostrarFinDelJuego(total) {
    this.raiz.replaceChildren(h('section', { class: 'tarjeta-final' },
      h('h2', {}, '¡Has completado todos los niveles!'),
      h('p', {}, `Son ${numero(total)} niveles. ¡Enhorabuena!`),
      h('div', { class: 'botones' },
        h('button', { type: 'button', class: 'boton boton-principal', on: { click: () => this.ctx.navegar('') } }, 'Inicio'))));
  }

  // ---------- Pantalla ----------

  construir() {
    const { nivel } = this;
    this.cuenta = h('span', { class: 'palabras-cuenta' });
    const subtitulo = this.modo === 'lista' ? `Nivel ${numero(nivel.id)} · modo lista` : `Nivel ${numero(nivel.id)}`;
    const cabecera = h('header', { class: 'palabras-cabecera' },
      botonInicio(() => this.ctx.navegar('')),
      h('div', { class: 'palabras-titulo' },
        h('h1', { class: 'solo-vertical' }, 'Palabras'),
        h('h1', { class: 'solo-horizontal' }, `Palabras · Nivel ${numero(nivel.id)}`),
        h('span', { class: 'subtitulo solo-vertical' }, subtitulo),
        h('span', { class: 'subtitulo solo-horizontal' }, this.cuentaH = h('span'))),
      h('span', { class: 'solo-vertical palabras-cuenta' }, this.cuenta));

    this.tablero = h('div', { role: 'group', 'aria-label': this.modo === 'lista' ? 'Palabras por encontrar' : 'Crucigrama' });
    this.zona = h('div', { class: 'palabras-zona' }, this.tablero);
    this.observador = new ResizeObserver(() => this.ajustarTamaño());
    this.observador.observe(this.zona);

    this.extraEl = h('p', { class: 'palabras-extra', 'aria-live': 'polite' });

    this.enCurso = h('button', { type: 'button', class: 'palabra-en-curso vacia', 'aria-live': 'polite',
      on: { click: () => this.comprobar() } });

    // Rueda
    this.rueda = h('div', { class: 'rueda', role: 'group', 'aria-label': 'Letras' });
    this.trazo = document.createElementNS(SVG, 'path');
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.append(this.trazo);
    this.rueda.append(svg);
    this.letrasEl = [];
    this.rueda.addEventListener('pointerdown', (e) => this.alPulsar(e));
    this.rueda.addEventListener('pointermove', (e) => this.alMover(e));
    this.rueda.addEventListener('pointerup', (e) => this.alSoltar(e));
    this.rueda.addEventListener('pointercancel', (e) => this.alSoltar(e));
    // Tocar fuera de la rueda y de la palabra en curso la borra.
    this.raiz.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.rueda, .palabra-en-curso, button')) this.limpiar();
    });

    const redondo = (clase, nombre, texto, accion) =>
      h('button', { type: 'button', class: `boton-redondo ${clase}`, on: { click: accion } }, icono(nombre), texto);
    this.mandos = h('div', { class: 'palabras-mandos' },
      h('div', { class: 'botones-rueda' },
        redondo('boton-mezclar', 'mezclar', 'Mezclar', () => this.mezclar()),
        redondo('boton-pista', 'pista', 'Pista', () => this.pista())),
      this.rueda);

    this.raiz.replaceChildren(
      h('div', { class: 'palabras-izquierda' }, cabecera, this.zona, this.extraEl),
      h('div', { class: 'palabras-derecha' }, this.enCurso, this.mandos));
    this.colocarLetras();
  }

  colocarLetras() {
    for (const el of this.letrasEl) el.remove();
    const n = this.p.letras.length;
    this.letrasEl = this.p.letras.map((l, i) => {
      const angulo = -Math.PI / 2 + (2 * Math.PI * i) / n;
      // Posición en % de la rueda: radio 122/360 desde el centro; botón de 96/360.
      const x = 50 + 33.9 * Math.cos(angulo) - 13.33;
      const y = 50 + 33.9 * Math.sin(angulo) - 13.33;
      const b = h('button', { type: 'button', class: 'letra-rueda', style: { left: `${x}%`, top: `${y}%` } }, l);
      b.dataset.indice = i;
      this.rueda.append(b);
      return b;
    });
  }

  /** Tamaño de casillas según el espacio libre (máx. 88 px en crucigrama, 64 px en lista). */
  ajustarTamaño() {
    const { width, height } = this.zona.getBoundingClientRect();
    if (!width || !height) return;
    if (this.modo === 'lista') {
      const { filas, letrasPorFila } = this.formaLista();
      // ancho: letras de las dos columnas + huecos entre letras (1/8) + separación de columnas (0,85)
      const porAncho = width / (letrasPorFila + (letrasPorFila - 2) * 0.125 + 0.85);
      const porAlto = height / (filas + (filas - 1) * 0.3);
      this.raiz.style.setProperty('--caja', `${Math.floor(Math.min(CAJA_MAXIMA, porAncho, porAlto))}px`);
    } else {
      const { filas, columnas } = R.tamaño(this.nivel.crucigrama);
      const lado = Math.min(width / (columnas + (columnas - 1) * 0.09), height / (filas + (filas - 1) * 0.09), CASILLA_MAXIMA);
      this.raiz.style.setProperty('--casilla', `${Math.floor(lado)}px`);
    }
  }

  /** Palabras de la lista ordenadas por longitud, repartidas en dos columnas. */
  formaLista() {
    const ordenadas = [...this.nivel.crucigrama].sort((a, b) => a.palabra.length - b.palabra.length || a.palabra.localeCompare(b.palabra));
    const filas = Math.ceil(ordenadas.length / 2);
    const izquierda = ordenadas.slice(0, filas), derecha = ordenadas.slice(filas);
    const largo = (l) => Math.max(0, ...l.map((c) => c.palabra.length));
    return { ordenadas, filas, letrasPorFila: largo(izquierda) + largo(derecha) };
  }

  pintar() {
    const { p, nivel } = this;
    const casilla = (letra, visible, porPista) => h('div', {
      class: `letra-casilla ${visible ? (porPista ? 'pista' : 'vista') : 'oculta'}`,
      'aria-label': visible ? `Letra ${letra}` : 'Casilla vacía',
    }, visible ? letra : '');
    const encontrada = (c) => p.encontradas.includes(c.palabra);

    if (this.modo === 'lista') {
      const { ordenadas, filas } = this.formaLista();
      this.tablero.className = 'lista-palabras';
      this.tablero.style.gridTemplateRows = `repeat(${filas}, auto)`;
      this.tablero.replaceChildren(...ordenadas.map((c) => h('div', {
        class: 'palabra-fila',
        'aria-label': encontrada(c) ? `Palabra encontrada: ${c.palabra}` : `Palabra de ${c.palabra.length} letras por encontrar`,
      }, [...c.palabra].map((l, k) => casilla(l, R.letraVisible(p, nivel, c, k, 'lista'),
        !encontrada(c) && p.reveladas.includes(R.casillasDe(c)[k]))))));
    } else {
      const { filas, columnas } = R.tamaño(nivel.crucigrama);
      const mapa = R.casillas(nivel.crucigrama);
      this.tablero.className = 'crucigrama';
      this.tablero.style.gridTemplateColumns = `repeat(${columnas}, var(--casilla))`;
      const celdas = [];
      for (let f = 0; f < filas; f++) {
        for (let c = 0; c < columnas; c++) {
          const clave = `${f},${c}`;
          const letra = mapa.get(clave);
          if (!letra) { celdas.push(h('div', { 'aria-hidden': 'true' })); continue; }
          const porPalabra = nivel.crucigrama.some((x) => encontrada(x) && R.casillasDe(x).includes(clave));
          celdas.push(casilla(letra, porPalabra || p.reveladas.includes(clave), !porPalabra));
        }
      }
      this.tablero.replaceChildren(...celdas);
    }
    this.ajustarTamaño();

    const total = nivel.palabras.length, hechas = p.encontradas.length;
    const cuenta = `${hechas} de ${total} palabras`;
    this.cuenta.textContent = cuenta;
    this.cuentaH.textContent = this.modo === 'lista' ? `${cuenta} · modo lista` : cuenta;
    this.extraEl.replaceChildren(...(p.extras.length
      ? ['Palabras extra encontradas: ', h('strong', {}, p.extras.join(', '))]
      : ['Palabras extra encontradas: ninguna todavía']));
    this.pintarRueda();
  }

  pintarRueda() {
    this.letrasEl.forEach((b, i) => {
      const elegida = this.camino.includes(i);
      b.classList.toggle('elegida', elegida);
      b.setAttribute('aria-label', `Letra ${this.p.letras[i]}${elegida ? ', elegida' : ''}`);
    });
    // Línea que une las letras elegidas (y el dedo, si se está deslizando)
    const centro = (i) => {
      const b = this.letrasEl[i];
      return [(b.offsetLeft + b.offsetWidth / 2), (b.offsetTop + b.offsetHeight / 2)];
    };
    const puntos = this.camino.map(centro);
    if (this.arrastre?.x !== undefined && puntos.length) puntos.push([this.arrastre.x, this.arrastre.y]);
    const lado = this.rueda.offsetWidth || 360;
    this.trazo.parentNode.setAttribute('viewBox', `0 0 ${lado} ${lado}`);
    this.trazo.setAttribute('d', puntos.length > 1 ? `M${puntos.map((q) => q.join(' ')).join('L')}` : '');

    if (!this.mensajeHasta || Date.now() > this.mensajeHasta) {
      const texto = this.camino.map((i) => this.p.letras[i]).join('');
      this.enCurso.textContent = texto;
      this.enCurso.classList.remove('mensaje');
      this.enCurso.classList.toggle('vacia', !texto);
      this.enCurso.setAttribute('aria-label', texto ? `Palabra ${texto}. Toca para comprobarla` : 'Palabra en curso');
    }
  }

  avisar(texto) {
    this.enCurso.textContent = texto;
    this.enCurso.classList.add('mensaje');
    this.enCurso.classList.remove('vacia');
    this.mensajeHasta = Date.now() + 1500;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => { this.mensajeHasta = 0; if (!this.terminada) this.pintarRueda(); }, 1500);
  }

  // ---------- Rueda: deslizar y tocar ----------

  letraEn(x, y) {
    // Solo cuenta si el dedo está bien dentro del círculo de la letra (evita elegir vecinas sin querer).
    for (const b of this.letrasEl) {
      const cx = b.offsetLeft + b.offsetWidth / 2, cy = b.offsetTop + b.offsetHeight / 2;
      if (Math.hypot(x - cx, y - cy) < b.offsetWidth * 0.42) return Number(b.dataset.indice);
    }
    return -1;
  }

  posicion(e) {
    const r = this.rueda.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  alPulsar(e) {
    if (this.terminada) return;
    const [x, y] = this.posicion(e);
    const i = this.letraEn(x, y);
    if (i < 0) return;
    e.preventDefault();
    try { this.rueda.setPointerCapture(e.pointerId); } catch { /* sin captura también funciona */ }
    this.mensajeHasta = 0;
    let añadidas = 0;
    if (!this.camino.includes(i)) { this.camino.push(i); añadidas = 1; }
    else if (this.camino.at(-1) === i && this.camino.length > 0) { /* volver a tocar la última: se quita al soltar */ }
    this.arrastre = { puntero: e.pointerId, añadidas, inicial: i, movido: false, x, y };
    this.pintarRueda();
  }

  alMover(e) {
    if (!this.arrastre || e.pointerId !== this.arrastre.puntero) return;
    const [x, y] = this.posicion(e);
    this.arrastre.x = x; this.arrastre.y = y;
    const i = this.letraEn(x, y);
    if (i >= 0 && i !== this.camino.at(-1)) {
      if (this.camino.length > 1 && this.camino.at(-2) === i) {
        this.camino.pop();                      // volver atrás deshace la última letra
      } else if (!this.camino.includes(i)) {
        this.camino.push(i);
        this.arrastre.movido = true;
      }
    }
    this.pintarRueda();
  }

  alSoltar(e) {
    if (!this.arrastre || e.pointerId !== this.arrastre.puntero) return;
    const { movido, añadidas, inicial } = this.arrastre;
    this.arrastre = null;
    if (movido) {
      this.comprobar();                         // se desliza y se suelta: se comprueba
    } else if (!añadidas && this.camino.at(-1) === inicial) {
      this.camino.pop();                        // tocar la última letra otra vez la quita
      this.pintarRueda();
    } else {
      this.pintarRueda();                       // modo toque: se sigue añadiendo
    }
  }

  limpiar() {
    if (!this.camino.length) return;
    this.camino = [];
    this.pintarRueda();
  }

  // ---------- Jugadas ----------

  comprobar() {
    if (this.terminada) return;
    const intento = this.camino.map((i) => this.p.letras[i]).join('');
    this.camino = [];
    if (!intento) { this.pintarRueda(); return; }
    const resultado = R.comprobar(this.p, this.nivel, intento);
    if (resultado === 'nueva') this.mensajeHasta = 0;
    else this.avisar(MENSAJES[resultado]);
    this.pintar();
    if (resultado === 'nueva' || resultado === 'extra') this.despuesDeJugar();
  }

  mezclar() {
    if (this.terminada) return;
    this.camino = [];
    R.mezclar(this.p);
    this.colocarLetras();
    this.pintarRueda();
    this.guardar();
  }

  pista() {
    if (this.terminada) return;
    const r = R.darPista(this.p, this.nivel, this.modo);
    if (!r) return;
    this.pintar();
    this.despuesDeJugar();
  }

  despuesDeJugar() {
    if (R.completo(this.p, this.nivel)) this.terminar();
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
    const total = this.nivel?.palabras.length || 1;
    return this.ctx.partidas.guardar({
      juego: ID,
      dificultad: null,
      inicio: this.inicio,
      segundos: Math.round(this.reloj.segundos()),
      resumen: {
        titulo: `Palabras · Nivel ${numero(this.p.nivel)}`,
        detalle: `${this.p.encontradas.length} de ${total} palabras`,
        progreso: this.p.encontradas.length / total,
      },
      estado: this.p,
    }).catch((e) => console.error('No se pudo guardar la partida', e));
  }

  async terminar() {
    this.terminada = true;
    const segundos = this.reloj.detenerFinal();
    const { p } = this;
    await this.ctx.partidas.cerrar(ID, 'terminada', {
      segundos,
      detalles: { nivel: p.nivel, extras: p.extras.length, pistas: p.pistas },
      partida: { dificultad: null, inicio: this.inicio, segundos },
    });
    await this.ctx.db.poner('progreso', p.nivel + 1, CLAVE_NIVEL);
    this.camino = [];
    this.pintar();
    this.enCurso.hidden = true;
    this.mandos.hidden = true;
    const extras = p.extras.length;
    const destacado = extras
      ? (extras === 1 ? '1 palabra extra' : `${extras} palabras extra`)
      : (p.pistas ? (p.pistas === 1 ? 'Con 1 pista' : `Con ${p.pistas} pistas`) : 'Sin usar ninguna pista');
    const ultimo = p.nivel >= (niveles?.length || 0);
    this.raiz.querySelector('.palabras-derecha').append(tarjetaFinal({
      titulo: '¡Nivel completado!',
      texto: `Nivel ${numero(p.nivel)} terminado en`,
      segundos,
      destacado,
      textoOtra: ultimo ? 'Ver final' : 'Siguiente nivel',
      alOtraPartida: () => this.ctx.jugar(ID, { dificultad: null }),
      alInicio: () => this.ctx.navegar(''),
    }));
  }

  desmontar() {
    document.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
    clearTimeout(this.temporizador);
    this.observador?.disconnect();
    this.reloj.parar();
    this.guardar();
    this.raiz?.remove();
  }
}

export default {
  id: ID,
  nombre: 'Palabras',
  descripcion: 'Forma palabras con las letras',

  async montar(contenedor, ctx) {
    cargarEstilos();
    actual = new PartidaPalabras(contenedor, ctx);
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
    return actual?.p ? { texto: `Nivel ${actual.p.nivel}` } : null;
  },
};
