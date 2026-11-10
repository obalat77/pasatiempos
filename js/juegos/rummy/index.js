// Rummy — interfaz común de juego (ESPECIFICACION.md §2.4 y §5.5).
// Tú contra Lola (izquierda), Paco (arriba) y Carmen (derecha), que piensan en un Web Worker.
import { h, icono, botonInicio } from '../../core/ui.js';
import { numero } from '../../core/formato.js';
import { Reloj } from '../../core/reloj.js';
import { crearAzar } from '../../core/azar.js';
import { buscarJuego } from '../catalogo.js';
import { elegirPartida } from '../../pantallas/elegir-partida.js';
import * as R from './reglas.js';

const ID = 'rummy';
// En el ordenador de desarrollo, ?rapido acelera los turnos de los rivales para probar partidas enteras.
const RAPIDO = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('rapido');
const PASO_MS = RAPIDO ? 30 : 600;          // cada movimiento de un rival, despacio para poder seguirlo
const PIENSA_MIN_MS = RAPIDO ? 30 : 900;    // «Paco está pensando…» se ve al menos este tiempo
const PLAZO_MAXIMO_MS = 10000;              // si el Worker no contesta en este tiempo, el rival roba
const NOMBRE_NIVEL = { principiante: 'Principiante', intermedio: 'Intermedio', experto: 'Experto' };
const MOTIVOS = {
  invalida: 'Hay una combinación no válida en la mesa.',
  'sin-fichas': 'Pon alguna ficha tuya en la mesa, o roba una ficha.',
  fichas: 'Las fichas de la mesa no pueden volver a tu atril.',
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const CARITA = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14.5c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4"/><circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1.2" fill="currentColor" stroke="none"/></svg>';

function cargarEstilos() {
  if (document.getElementById('estilos-rummy')) return;
  document.head.append(h('link', { id: 'estilos-rummy', rel: 'stylesheet', href: 'js/juegos/rummy/rummy.css' }));
}

let actual = null;

class PartidaRummy {
  constructor(contenedor, ctx) {
    this.ctx = ctx;
    this.contenedor = contenedor;
    this.reloj = new Reloj();
    this.vivo = true;
    this.sel = null;              // id de la ficha elegida
    this.nuevas = new Set();      // fichas que acaba de poner un rival (resaltadas)
    this.mensaje = null;          // { texto, aviso }
    this.alCambiarVisibilidad = () => this.visibilidad();
  }

  // ---------- Arranque ----------

  async iniciar() {
    const { ctx } = this;
    this.raiz = h('div', { class: 'rummy' }, h('p', { class: 'rummy-preparando' }, 'Repartiendo fichas…'));
    this.contenedor.append(this.raiz);
    const guardada = ctx.nueva ? null : await ctx.partidas.obtener(ID);
    if (!ctx.nueva && !guardada?.estado?.jugadores) { ctx.navegar(''); return; }
    if (guardada) {
      this.p = guardada.estado;
      this.inicio = guardada.inicio;
      this.reloj.base = guardada.segundos || 0;
    } else {
      this.p = R.crearPartida({ azar: crearAzar(), nivel: ctx.ajustes.obtener('rummy.nivel') });
      this.inicio = Date.now();
    }
    this.ordenAtril = R.ordenarPorNumero(this.p.jugadores[0].atril);
    // Se guarda antes de construir la pantalla: así no se puede tocar «Inicio» a mitad del arranque.
    if (actual !== this) return;
    await this.guardar();
    if (actual !== this) return;
    this.iniciarWorker();
    this.construir();
    this.reloj.arrancar();
    document.addEventListener('visibilitychange', this.alCambiarVisibilidad);
    this.avanzar();
  }

  iniciarWorker() {
    this.pendientes = new Map();
    this.siguienteId = 1;
    try {
      this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      this.worker.addEventListener('message', (e) => {
        this.pendientes.get(e.data.id)?.(e.data.decision);
        this.pendientes.delete(e.data.id);
      });
      // Si el Worker falla (no carga, se queda sin memoria…), los rivales que esperaban roban
      // y desde entonces piensan en la página.
      this.worker.addEventListener('error', (e) => {
        console.error('El Worker de los rivales ha fallado', e);
        this.worker?.terminate();
        this.worker = null;
        for (const resolver of this.pendientes.values()) resolver({ tipo: 'robar' });
        this.pendientes.clear();
      });
    } catch (error) {
      console.warn('Sin Web Worker: los rivales pensarán en la página', error);
      this.worker = null;
    }
  }

  async pensar(datos) {
    if (this.worker) {
      const id = this.siguienteId++;
      // Nunca esperar para siempre: si no responde a tiempo, el rival roba y la partida sigue.
      return new Promise((resolver) => {
        const plazo = setTimeout(() => {
          this.pendientes.delete(id);
          resolver({ tipo: 'robar' });
        }, PLAZO_MAXIMO_MS);
        this.pendientes.set(id, (decision) => { clearTimeout(plazo); resolver(decision); });
        this.worker.postMessage({ id, datos });
      });
    }
    const { decidir } = await import('./ia.js');
    return decidir(datos);
  }

  // ---------- Pantalla ----------

  construir() {
    this.info = h('span', { class: 'rummy-info' });
    this.infoV = h('p', { class: 'rummy-info solo-vertical' });
    this.deshacerBtn = h('button', { type: 'button', class: 'boton-deshacer', on: { click: () => this.deshacer() } },
      icono('deshacer'), 'Deshacer jugada');
    const cabecera = h('header', { class: 'rummy-cabecera' },
      botonInicio(() => this.ctx.navegar('')),
      h('h1', {}, 'Rummy'),
      h('span', { class: 'solo-horizontal' }, this.info),
      this.deshacerBtn);

    this.rivalesEl = [1, 2, 3].map((j) => {
      const el = h('div', { class: `rival ${j === 2 ? 'rival-arriba' : 'rival-lado'}`, 'aria-live': 'polite' });
      return el;
    });
    this.mesaEl = h('section', { class: 'mesa', 'aria-label': 'Mesa' });
    this.observador = new ResizeObserver(() => this.ajustarTamaños());
    this.observador.observe(this.mesaEl);

    this.estadoEl = h('p', { class: 'estado-turno', 'aria-live': 'polite' });
    this.atrilEl = h('div', { class: 'atril', role: 'group', 'aria-label': 'Tu atril', dataset: { destino: 'atril' } });
    this.zonaAtril = h('section', { class: 'zona-atril', 'aria-label': 'Tu atril' }, this.estadoEl, this.atrilEl);
    const boton = (texto, clase, accion) => h('button', { type: 'button', class: clase, on: { click: accion } }, texto);
    this.robarBtn = boton('Robar ficha', 'robar', () => this.robar());
    this.terminarBtn = boton('Terminar turno', 'terminar', () => this.terminarTurno());
    this.botones = h('div', { class: 'rummy-botones' },
      boton('Ordenar 1 2 3', 'ordenar', () => { this.ordenAtril = R.ordenarPorNumero(this.ordenAtril); this.pintar(); }),
      boton('Ordenar por color', 'ordenar', () => { this.ordenAtril = R.ordenarPorColor(this.ordenAtril); this.pintar(); }),
      this.robarBtn, this.terminarBtn);

    this.raiz.replaceChildren(
      cabecera,
      this.infoV,
      this.rivalesEl[1],
      h('div', { class: 'rummy-centro' }, this.rivalesEl[0], this.mesaEl, this.rivalesEl[2]),
      h('div', { class: 'rummy-abajo' }, this.zonaAtril, this.botones));

    // Arrastrar fichas (además de tocar ficha → tocar destino)
    this.raiz.addEventListener('pointerdown', (e) => this.alPulsar(e));
    this.raiz.addEventListener('pointermove', (e) => this.alMover(e));
    this.raiz.addEventListener('pointerup', (e) => this.alSoltar(e));
    this.raiz.addEventListener('pointercancel', (e) => {
      if (this.arrastre?.puntero === e.pointerId) this.cancelarArrastre();
    });
  }

  /** Mi turno ya preparado (empezarMiTurno) y sin animaciones en curso. */
  esMiTurno() {
    return this.miTurno && !this.p.terminada && this.p.turno === 0 && !this.animando;
  }

  ficha(id, { movible = false, elegida = false, nueva = false, puesta = false } = {}) {
    const f = R.fichaDe(id);
    const clases = ['ficha-r', R.esComodin(id) ? 'comodin' : `c-${f.c}`];
    if (elegida) clases.push('elegida');
    if (nueva) clases.push('nueva');
    if (puesta) clases.push('puesta');
    const contenido = R.esComodin(id)
      ? [Object.assign(document.createElement('template'), { innerHTML: CARITA }).content.firstElementChild]
      : [h('span', { class: 'num' }, String(f.n)), h('span', { class: 'sim', 'aria-hidden': 'true' }, R.SIMBOLO[f.c])];
    const etiqueta = R.esComodin(id) ? 'Comodín' : `Ficha ${f.n} ${R.NOMBRE_COLOR[f.c]}`;
    if (!movible) return h('div', { class: clases.join(' '), role: 'img', 'aria-label': etiqueta }, contenido);
    return h('button', { type: 'button', class: clases.join(' '), 'aria-label': etiqueta,
      'aria-pressed': String(elegida), dataset: { ficha: id } }, contenido);
  }

  pintar() {
    const { p } = this;
    const turnoMio = this.esMiTurno();
    const mesa = this.vistaMesa || (turnoMio ? this.mesaT : p.mesa);
    const antes = new Set((this.mesaAntes || []).flat());
    const puedoMoverMesa = turnoMio && p.jugadores[0].bajado;

    this.info.textContent = this.infoV.textContent =
      `${NOMBRE_NIVEL[p.nivel]} · ${p.pozo.length === 1 ? 'Queda 1 ficha' : `Quedan ${numero(p.pozo.length)} fichas`} por robar`;

    // Rivales
    [1, 2, 3].forEach((j, k) => {
      const x = p.jugadores[j];
      const n = x.atril.length;
      const activo = !p.terminada && p.turno === j;
      const el = this.rivalesEl[k];
      el.classList.toggle('activo', activo);
      el.replaceChildren(...[
        h('span', { class: 'rival-nombre' }, x.nombre),
        j === 2 ? null : h('span', { class: 'rival-fichas' }, n === 1 ? '1 ficha' : `${n} fichas`),
        h('div', { class: 'dorsos', 'aria-hidden': 'true' }, Array.from({ length: Math.min(n, 14) }, () => h('span', { class: 'dorso' }))),
        j === 2 ? h('span', { class: 'rival-fichas' }, n === 1 ? '1 ficha' : `${n} fichas`) : null,
        !x.bajado ? h('span', { class: 'rival-estado' }, 'aún no ha bajado') : null,
        activo && this.animando ? h('span', { class: 'rival-estado' }, this.textoRival || 'pensando…') : null,
      ].filter(Boolean));
    });

    // Mesa
    const combos = mesa.map((combo, k) => {
      const valida = R.esValida(combo);
      const orden = valida ? R.analizar(combo).orden : R.ordenarPorNumero(combo);
      const marcar = !valida && turnoMio;   // durante la jugada de un rival no se marca nada
      return h('div', {
        class: `combinacion destino${marcar ? ' no-valida' : ''}`,
        role: 'group',
        'aria-label': `Combinación ${k + 1}${marcar ? ', no válida' : ''}: ${orden.map(R.nombreFicha).join(', ')}`,
        dataset: { destino: `combo:${k}` },
        on: { click: (e) => { if (!e.target.closest('[data-ficha]')) this.soltarEn(`combo:${k}`); } },
      }, orden.map((id) => {
        const deEsteTurno = turnoMio && !antes.has(id);
        return this.ficha(id, {
          movible: turnoMio && (deEsteTurno || puedoMoverMesa),
          elegida: this.sel === id,
          nueva: this.nuevas.has(id),
          puesta: deEsteTurno,
        });
      }));
    });
    const nueva = turnoMio
      ? h('button', { type: 'button', class: 'zona-nueva', dataset: { destino: 'nueva' }, on: { click: () => this.soltarEn('nueva') } }, 'Nueva combinación')
      : null;
    this.mesaEl.replaceChildren(...combos, ...(nueva ? [nueva] : []));

    // Atril (dos baldas)
    const mio = turnoMio ? this.atrilT : p.jugadores[0].atril;
    const visibles = this.ordenAtril.filter((id) => mio.includes(id));
    const porBalda = Math.max(7, Math.ceil(visibles.length / 2));
    this.porBalda = porBalda;
    const balda = (ids) => h('div', { class: 'balda' }, ids.map((id) => this.ficha(id, {
      movible: true, elegida: this.sel === id, nueva: this.ultimaRobada === id })));
    this.atrilEl.replaceChildren(balda(visibles.slice(0, porBalda)), balda(visibles.slice(porBalda)));
    this.atrilEl.onclick = (e) => { if (!e.target.closest('[data-ficha]')) this.soltarEn('atril'); };

    // Estado y botones
    if (this.mensaje) {
      this.estadoEl.textContent = this.mensaje.texto;
      this.estadoEl.classList.toggle('aviso', !!this.mensaje.aviso);
    } else {
      this.estadoEl.classList.remove('aviso');
      this.estadoEl.textContent = p.terminada ? 'Partida terminada'
        : turnoMio ? (this.sel !== null ? 'Ahora toca dónde ponerla: una combinación, «Nueva combinación» o tu atril'
          : (p.jugadores[0].bajado ? 'Tu turno · toca una ficha y después dónde ponerla'
            : `Tu turno · tu primera bajada debe sumar 30 puntos (llevas ${R.puntosBajada(this.mesaAntes, this.mesaT)})`))
          : `${p.jugadores[p.turno].nombre} está pensando…`;
    }
    const cambios = turnoMio && this.hayCambios();
    this.deshacerBtn.disabled = !cambios;
    this.robarBtn.disabled = !turnoMio;
    this.robarBtn.textContent = p.pozo.length ? 'Robar ficha' : 'Pasar turno';
    this.terminarBtn.disabled = !turnoMio;
    this.ajustarTamaños();
  }

  /** Fichas tan grandes como quepan: en el atril (máx. 76 px de ancho) y en la mesa (máx. 68). */
  ajustarTamaños() {
    if (!this.atrilEl) return;
    const horizontal = matchMedia('(orientation: landscape)').matches;
    const anchoDisponible = horizontal ? this.raiz.clientWidth * 0.62 : this.raiz.clientWidth - 40;
    const maxAtril = horizontal ? 68 : 76;
    const fa = Math.floor(Math.min(maxAtril, (anchoDisponible - 28 - (this.porBalda - 1) * 6) / this.porBalda));
    this.raiz.style.setProperty('--fa-ancho', `${fa}px`);
    // Mesa: empezar grande e ir reduciendo hasta que quepa (o llegar a 34 px y desplazar)
    const mesa = this.mesaEl;
    let fm = horizontal ? 68 : 56;
    this.raiz.style.setProperty('--fm-ancho', `${fm}px`);
    while (fm > 34 && mesa.scrollHeight > mesa.clientHeight + 1) {
      fm -= 4;
      this.raiz.style.setProperty('--fm-ancho', `${fm}px`);
    }
  }

  // ---------- Tu turno ----------

  empezarMiTurno() {
    const yo = this.p.jugadores[0];
    this.mesaAntes = this.p.mesa.map((c) => [...c]);
    this.atrilAntes = [...yo.atril];
    this.mesaT = this.p.mesa.map((c) => [...c]);
    this.atrilT = [...yo.atril];
    for (const id of yo.atril) if (!this.ordenAtril.includes(id)) this.ordenAtril.push(id);
    this.sel = null;
    this.miTurno = true;
    // Al empezar tu turno manda «Tu turno…» (lo que han puesto los rivales sigue resaltado en la mesa)
    if (this.mensaje && !this.mensaje.aviso) this.mensaje = null;
    this.pintar();
  }

  hayCambios() {
    return this.atrilT && (this.atrilT.length !== this.atrilAntes.length
      || JSON.stringify(this.mesaT) !== JSON.stringify(this.mesaAntes));
  }

  /** ¿Se puede coger esta ficha? */
  movible(id) {
    if (!this.esMiTurno()) return false;
    if (this.atrilT.includes(id)) return true;
    const deLaMesaAntes = this.mesaAntes.flat().includes(id);
    return !deLaMesaAntes || this.p.jugadores[0].bajado;
  }

  elegir(id) {
    if (!this.movible(id)) return;
    this.mensaje = null;
    this.sel = this.sel === id ? null : id;
    this.pintar();
  }

  /** Lleva la ficha elegida al destino: 'combo:k', 'nueva' o 'atril'. */
  soltarEn(destino, id = this.sel) {
    if (id === null || id === undefined || !this.esMiTurno()) return;
    const deMiAtril = this.atrilAntes.includes(id);
    if (destino === 'atril' && !deMiAtril) {
      this.mensaje = { texto: MOTIVOS.fichas, aviso: true };
      this.sel = null;
      this.pintar();
      return;
    }
    ({ mesa: this.mesaT, atril: this.atrilT } = R.moverFicha({ mesa: this.mesaT, atril: this.atrilT }, id, destino));
    this.sel = null;
    this.mensaje = null;
    this.pintar();
  }

  deshacer() {
    if (!this.esMiTurno()) return;
    this.mesaT = this.mesaAntes.map((c) => [...c]);
    this.atrilT = [...this.atrilAntes];
    this.sel = null;
    this.mensaje = null;
    this.pintar();
  }

  async terminarTurno() {
    if (!this.esMiTurno()) return;
    const motivo = R.motivoTurnoNoValido({
      mesaAntes: this.mesaAntes, atrilAntes: this.atrilAntes, mesa: this.mesaT, atril: this.atrilT,
      bajado: this.p.jugadores[0].bajado,
    });
    if (motivo) {
      const texto = motivo === 'primera'
        ? `La primera bajada debe sumar 30 puntos, solo con tus fichas (llevas ${R.puntosBajada(this.mesaAntes, this.mesaT)}).`
        : MOTIVOS[motivo];
      this.mensaje = { texto, aviso: true };
      this.pintar();
      return;
    }
    this.miTurno = false;
    this.ultimaRobada = null;
    R.aplicarJugada(this.p, 0, this.mesaT, this.atrilT);
    this.ordenAtril = this.ordenAtril.filter((id) => this.p.jugadores[0].atril.includes(id));
    this.atrilT = null;
    this.nuevas.clear();
    await this.despuesDeTurno();
  }

  async robar() {
    if (!this.esMiTurno()) return;
    if (this.hayCambios()) this.deshacer();   // se devuelven al atril las fichas puestas
    this.miTurno = false;
    const ficha = R.robar(this.p, 0);
    this.atrilT = null;
    this.nuevas.clear();
    if (ficha !== undefined) {
      this.ordenAtril.push(ficha);
      this.ultimaRobada = ficha;
    }
    await this.despuesDeTurno();
  }

  // ---------- Arrastrar ----------

  alPulsar(e) {
    const el = e.target.closest('[data-ficha]');
    if (this.arrastre || !el || !this.esMiTurno()) return;   // un solo arrastre a la vez
    const id = Number(el.dataset.ficha);
    if (!this.movible(id)) return;
    this.arrastre = { id, x: e.clientX, y: e.clientY, el, movido: false, puntero: e.pointerId };
  }

  alMover(e) {
    const a = this.arrastre;
    if (!a || e.pointerId !== a.puntero) return;
    if (!a.movido && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 12) return;
    if (!a.movido) {
      a.movido = true;
      const r = a.el.getBoundingClientRect();
      a.fantasma = a.el.cloneNode(true);
      a.fantasma.classList.add('fantasma');
      Object.assign(a.fantasma.style, { width: `${r.width}px`, height: `${r.height}px` });
      a.dx = e.clientX - r.left; a.dy = e.clientY - r.top;
      document.body.append(a.fantasma);
      try { this.raiz.setPointerCapture(e.pointerId); } catch { /* sin captura también funciona */ }
    }
    a.fantasma.style.left = `${e.clientX - a.dx}px`;
    a.fantasma.style.top = `${e.clientY - a.dy}px`;
    e.preventDefault();
  }

  alSoltar(e) {
    const a = this.arrastre;
    if (!a || e.pointerId !== a.puntero) return;   // otro dedo: no afecta al arrastre en curso
    this.arrastre = null;
    if (!a.movido) { this.tocarFicha(a.id, a.el); return; }
    a.fantasma.remove();
    const debajo = document.elementFromPoint(e.clientX, e.clientY);
    const destino = debajo?.closest('[data-destino]')?.dataset.destino;
    if (destino) this.soltarEn(destino, a.id);
  }

  /** Tocar una ficha: elegirla, o (si ya hay otra elegida) usarla como destino. */
  tocarFicha(id, el) {
    if (this.sel === null || this.sel === id) { this.elegir(id); return; }
    const combo = el.closest('[data-destino^="combo:"]');
    if (combo) { this.soltarEn(combo.dataset.destino); return; }
    const enAtril = el.closest('.atril');
    if (enAtril && !this.atrilT.includes(this.sel)) { this.soltarEn('atril'); return; }
    this.elegir(id);
  }

  cancelarArrastre() {
    this.arrastre?.fantasma?.remove();
    this.arrastre = null;
  }

  // ---------- Turnos de los rivales ----------

  async avanzar() {
    while (this.vivo && !this.p.terminada && this.p.turno !== 0) {
      try {
        await this.turnoRival(this.p.turno);
      } catch (error) {
        // Si algo falla al pensar, el rival roba para que la partida siga.
        console.error(error);
        this.animando = false;
        this.vistaMesa = null;
        if (this.p.turno !== 0 && !this.p.terminada) R.robar(this.p, this.p.turno);
      }
    }
    if (!this.vivo) return;
    if (this.p.terminada) { this.terminarPartida(); return; }
    this.empezarMiTurno();
  }

  async turnoRival(j) {
    const { p } = this;
    const yo = p.jugadores[j];
    this.animando = true;
    this.textoRival = 'pensando…';
    this.mensaje = null;
    this.nuevas.clear();
    this.pintar();
    const inicio = Date.now();
    const decision = await this.pensar({
      mesa: p.mesa, atril: yo.atril, bajado: yo.bajado, nivel: p.nivel,
      otros: p.jugadores.filter((_, i) => i !== j).map((x) => x.atril.length),
      pozo: p.pozo.length,
    });
    await espera(Math.max(0, PIENSA_MIN_MS - (Date.now() - inicio)));
    if (!this.vivo) return;

    if (decision.tipo === 'jugar') {
      // Se enseña despacio: primero la mesa reorganizada sin sus fichas nuevas, luego cada ficha.
      const puestas = decision.puestas;
      const sinNuevas = decision.mesa.map((c) => c.filter((id) => !puestas.includes(id))).filter((c) => c.length);
      const reorganiza = JSON.stringify(sinNuevas.map((c) => [...c].sort()).sort()) !== JSON.stringify(p.mesa.map((c) => [...c].sort()).sort());
      this.vistaMesa = sinNuevas;
      this.textoRival = reorganiza ? 'reorganiza la mesa…' : 'coloca fichas…';
      this.pintar();
      await espera(PASO_MS);
      const visibles = new Set(sinNuevas.flat());
      for (const id of puestas) {
        if (!this.vivo) return;
        visibles.add(id);
        this.nuevas.add(id);
        this.vistaMesa = decision.mesa.map((c) => c.filter((x) => visibles.has(x))).filter((c) => c.length);
        this.textoRival = `pone ${R.nombreFicha(id)}`;
        this.pintar();
        await espera(PASO_MS);
      }
      this.vistaMesa = null;
      R.aplicarJugada(p, j, decision.mesa, decision.atril);
      this.mensaje = { texto: `${yo.nombre} ha puesto ${puestas.length === 1 ? '1 ficha' : `${puestas.length} fichas`}.` };
    } else {
      const ficha = R.robar(p, j);
      this.mensaje = { texto: ficha === undefined ? `${yo.nombre} pasa.` : `${yo.nombre} roba una ficha.` };
      this.textoRival = null;
    }
    this.animando = false;
    this.pintar();
    await this.guardar();
    await espera(PASO_MS);
  }

  async despuesDeTurno() {
    this.pintar();
    await this.guardar();
    this.avanzar();
  }

  visibilidad() {
    if (this.p?.terminada) return;
    if (document.visibilityState === 'hidden') { this.reloj.parar(); this.guardar(); }
    else this.reloj.arrancar();
  }

  // ---------- Guardar y terminar ----------

  guardar() {
    if (!this.p || this.p.terminada || this.cerrada) return Promise.resolve();
    const yo = this.p.jugadores[0];
    return this.ctx.partidas.guardar({
      juego: ID,
      dificultad: null,
      inicio: this.inicio,
      segundos: Math.round(this.reloj.segundos()),
      resumen: {
        titulo: `Rummy · ${NOMBRE_NIVEL[this.p.nivel]}`,
        detalle: `Te quedan ${yo.atril.length === 1 ? '1 ficha' : `${yo.atril.length} fichas`}`,
        progreso: Math.max(0, Math.min(1, 1 - yo.atril.length / 20)),
      },
      estado: this.p,   // el turno en curso empieza de nuevo al reanudar
    }).catch((e) => console.error('No se pudo guardar la partida', e));
  }

  async terminarPartida() {
    if (this.cerrada) return;
    this.cerrada = true;
    const { p } = this;
    const segundos = this.reloj.detenerFinal();
    await this.ctx.partidas.cerrar(ID, p.ganador === 0 ? 'ganada' : 'perdida', {
      segundos,
      detalles: { nivel: p.nivel, ganador: p.ganador, nombres: p.jugadores.map((x) => x.nombre), puntos: p.puntos },
      partida: { dificultad: null, inicio: this.inicio, segundos },
    }).catch((e) => console.error('No se pudo guardar el resultado', e));
    this.mensaje = null;
    this.pintar();
    const ganador = p.jugadores[p.ganador];
    const porAtrilVacio = ganador.atril.length === 0;
    const filas = p.jugadores.map((x, i) => [
      h('span', { class: i === p.ganador ? 'ganador' : null }, x.nombre),
      h('span', { class: 'cifras' }, x.atril.length === 1 ? '1 ficha' : `${x.atril.length} fichas`),
      h('span', { class: `cifras${i === p.ganador ? ' ganador' : ''}` }, `${p.puntos[i] > 0 ? '+' : ''}${numero(p.puntos[i])}`),
    ]);
    const tarjeta = h('section', { class: 'tarjeta-final', role: 'status' },
      h('h2', {}, p.ganador === 0 ? '¡Has ganado!' : `Ha ganado ${ganador.nombre}`),
      h('p', {}, porAtrilVacio
        ? (p.ganador === 0 ? 'Te has quedado sin fichas.' : `${ganador.nombre} se ha quedado sin fichas.`)
        : 'No quedaban fichas por robar: gana quien tiene menos puntos en el atril.'),
      h('div', { class: 'tabla-puntos', 'aria-label': 'Puntos' }, filas),
      h('div', { class: 'botones' },
        h('button', { type: 'button', class: 'boton boton-principal', on: { click: () => this.otraPartida() } }, 'Otra partida'),
        h('button', { type: 'button', class: 'boton boton-secundario', on: { click: () => this.ctx.navegar('') } }, 'Inicio')));
    this.raiz.querySelector('.rummy-abajo').replaceWith(tarjeta);
  }

  async otraPartida() {
    const eleccion = await elegirPartida(buscarJuego(ID), this.ctx);
    if (eleccion) this.ctx.jugar(ID, eleccion);
  }

  desmontar() {
    this.vivo = false;
    document.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
    this.observador?.disconnect();
    this.cancelarArrastre();
    this.worker?.terminate();
    this.reloj.parar();
    this.guardar();
    this.raiz?.remove();
  }
}

export default {
  id: ID,
  nombre: 'Rummy',
  descripcion: 'Contra 3 rivales',

  async montar(contenedor, ctx) {
    cargarEstilos();
    actual = new PartidaRummy(contenedor, ctx);
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
    return actual?.p ? { texto: `Te quedan ${actual.p.jugadores[0].atril.length} fichas` } : null;
  },
};
