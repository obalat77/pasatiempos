// Rummy — interfaz común de juego (ESPECIFICACION.md §2.4 y §5.5).
// Tú contra Lola (izquierda), Paco (arriba) y Carmen (derecha), que piensan en un Web Worker.
import { h, icono, barraJuego } from '../../core/ui.js';
import { botonAyuda } from '../../core/ayuda.js';
import { AYUDA } from './ayuda.js';
import { numero, cronometro } from '../../core/formato.js';
import { Reloj } from '../../core/reloj.js';
import { crearAzar } from '../../core/azar.js';
import { buscarJuego } from '../catalogo.js';
import { elegirPartida } from '../../pantallas/elegir-partida.js';
import * as R from './reglas.js';

const ID = 'rummy';
// En el ordenador de desarrollo, ?rapido acelera los turnos de los rivales para probar partidas enteras.
const RAPIDO = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('rapido');
// Cada paso de la jugada de un rival dura lo que diga el ajuste «Velocidad de los rivales» (v1.7)
const PIENSA_MIN_MS = RAPIDO ? 30 : 900;    // «Paco está pensando…» se ve al menos este tiempo
const MIN_FICHAS_ATRIL = 20;                // el atril siempre tiene sitio para 20 fichas (10 por balda)
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
    this.reloj = new Reloj(0, () => this.pintarReloj());
    this.relojTurno = null;       // cuenta atrás de tu turno, si hay «Tiempo por turno»
    this.vivo = true;
    this.sel = null;              // id de la ficha elegida
    this.nuevas = new Set();      // fichas que han puesto los rivales en esta ronda (resaltadas)
    this.tocadas = new Set();
    this.ultimaAccion = {};       // lo último que ha hecho cada rival, en su tarjeta (v1.7)     // fichas de las combinaciones que han cambiado en esta ronda (enmarcadas)
    this.mensaje = null;          // { texto, aviso }
    this.alCambiarVisibilidad = () => this.visibilidad();
  }

  // ---------- Arranque ----------

  async iniciar() {
    const { ctx } = this;
    this.raiz = h('div', { class: 'rummy juego-rummy' }, h('p', { class: 'rummy-preparando' }, 'Repartiendo fichas…'));
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
    this.ordenAtril = R.agruparPorNumero(this.p.jugadores[0].atril);
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
    const { ajustes } = this.ctx;
    this.mostrarReloj = ajustes.obtener('rummy.cronometro');
    this.limiteTurno = R.segundosPorTurno(ajustes.obtener('rummy.tiempoTurno'));
    this.tiempoEl = h('span', { class: 'barra-tiempo', role: 'timer', 'aria-label': 'Tiempo de juego',
      hidden: !this.mostrarReloj });
    // v1.7: de quién es el turno (y cuánto te queda) va en la barra, debajo de «Rummy»
    this.info = h('span', { class: 'rummy-info' });
    this.deshacerBtn = h('button', { type: 'button', class: 'boton-deshacer', on: { click: () => this.deshacer() } },
      icono('deshacer'), 'Deshacer jugada');
    const cabecera = barraJuego({
      alInicio: () => this.ctx.navegar(''), titulo: 'Rummy', subtitulo: this.info,
      derecha: [this.tiempoEl, this.deshacerBtn,
        botonAyuda({ ayuda: AYUDA, clase: 'juego-rummy', alAbrir: () => { this.reloj.parar(); this.relojTurno?.parar(); }, alCerrar: () => this.visibilidad() })], clase: 'rummy-cabecera',
    });

    // Lola, Paco y Carmen juntos: en fila sobre el tapete (vertical) o en columna a su derecha (horizontal)
    this.rivalesEl = [1, 2, 3].map(() => h('div', { class: 'rival', 'aria-live': 'polite' }));
    this.mesaEl = h('section', { class: 'mesa', 'aria-label': 'Mesa' });
    // Avisos («Hay una combinación no válida…», lo que ha hecho un rival): flotan sobre la parte
    // de abajo del tapete, sin empujar nada, y se van al tocar cualquier cosa (v1.7)
    this.avisoEl = h('p', { class: 'aviso-mesa', 'aria-live': 'polite' });
    this.marcoMesa = h('div', { class: 'marco-mesa' }, this.mesaEl, this.avisoEl);
    this.observador = new ResizeObserver(() => this.ajustarTamaños());
    this.observador.observe(this.mesaEl);

    this.atrilEl = h('div', { class: 'atril', role: 'group', 'aria-label': 'Tu atril', dataset: { destino: 'atril' } });
    this.zonaAtril = h('section', { class: 'zona-atril', 'aria-label': 'Tu atril' }, this.atrilEl);
    const boton = (texto, clase, accion) => h('button', { type: 'button', class: clase, on: { click: accion } }, texto);
    // «Robar ficha · quedan 33» en una línea («Robar · quedan 33» en vertical: « ficha» se oculta)
    this.robarBtn = h('button', { type: 'button', class: 'robar', on: { click: () => this.robar() } });
    this.terminarBtn = boton('Terminar turno', 'terminar', () => this.terminarTurno());
    this.botones = h('div', { class: 'rummy-botones' },
      boton('Ordenar 1\u00A02\u00A03', 'ordenar', () => this.ordenar(R.agruparPorNumero)),
      boton('Ordenar por color', 'ordenar', () => this.ordenar(R.agruparPorColor)),
      this.robarBtn, this.terminarBtn);

    this.raiz.replaceChildren(
      cabecera,
      h('div', { class: 'rummy-centro' }, h('div', { class: 'rivales' }, ...this.rivalesEl), this.marcoMesa),
      h('div', { class: 'rummy-abajo' }, this.zonaAtril, this.botones));

    // Tocar cualquier cosa quita el aviso (sin repintar: el toque debe llegar a su sitio).
    // El de «Se acabó tu tiempo» se queda durante la ronda de los rivales.
    this.raiz.addEventListener('pointerdown', () => {
      if (this.mensaje && !this.mensaje.fijo) { this.mensaje = null; this.avisoEl.hidden = true; }
    }, { capture: true });
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


    // Rivales
    [1, 2, 3].forEach((j, k) => {
      const x = p.jugadores[j];
      const n = x.atril.length;
      const activo = !p.terminada && p.turno === j;
      const el = this.rivalesEl[k];
      el.classList.toggle('activo', activo);
      // Tres líneas de alto fijo, para que el tapete no cambie de tamaño: nombre (y «Le toca»),
      // fichas, y lo que está haciendo o «aún no ha bajado».
      const accion = this.ultimaAccion[j];
      const estado = activo && this.animando ? (this.textoRival || 'pensando…')
        : (accion || (!x.bajado ? 'aún no ha bajado' : ''));
      el.replaceChildren(
        h('span', { class: 'rival-cab' }, h('span', { class: 'rival-nombre' }, x.nombre),
          activo ? h('span', { class: 'rival-turno' }, 'Le toca') : null),
        h('span', { class: 'rival-mano' },
          h('span', { class: 'dorsos', 'aria-hidden': 'true' }, Array.from({ length: Math.min(n, 14) }, () => h('span', { class: 'dorso' }))),
          h('span', { class: 'rival-fichas' }, n === 1 ? '1 ficha' : `${n} fichas`)),
        h('span', { class: `rival-estado${estado && !activo && !accion ? ' marca' : ''}` }, estado));
    });

    // Mesa
    const combos = mesa.map((combo, k) => {
      const valida = R.esValida(combo);
      const orden = valida ? R.analizar(combo).orden : R.ordenarPorNumero(combo);
      const marcar = !valida && turnoMio;   // durante la jugada de un rival no se marca nada
      const cambiada = !marcar && combo.some((id) => this.tocadas.has(id));
      return h('div', {
        class: `combinacion destino${marcar ? ' no-valida' : ''}${cambiada ? ' cambiada' : ''}`,
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
    this.pintarCartel();

    // Atril (dos baldas)
    const mio = turnoMio ? this.atrilT : p.jugadores[0].atril;
    // Con huecos entre las combinaciones que ya tienes (al ordenar); dos baldas lo más igualadas posible
    const visibles = R.limpiarHuecos(this.ordenAtril.filter((id) => id === R.HUECO || mio.includes(id)));
    const { baldas, anchos, piezas } = R.repartirBaldas(visibles);
    const minimo = MIN_FICHAS_ATRIL / 2;
    this.medidaBaldas = anchos.map((ancho, k) => ({ ancho: Math.max(minimo, ancho), piezas: Math.max(minimo, piezas[k]) }));
    const balda = (ids) => h('div', { class: 'balda' }, ids.map((id) => (id === R.HUECO
      ? h('span', { class: 'hueco', 'aria-hidden': 'true' })
      : this.ficha(id, { movible: true, elegida: this.sel === id, nueva: this.ultimaRobada === id }))));
    this.atrilEl.replaceChildren(...baldas.map(balda));
    this.atrilEl.onclick = (e) => { if (!e.target.closest('[data-ficha]')) this.soltarEn('atril'); };

    // Aviso flotante (v1.7: sin instrucciones; solo avisos y lo que ha hecho un rival)
    this.avisoEl.hidden = !this.mensaje;
    this.avisoEl.textContent = this.mensaje?.texto || '';
    this.avisoEl.classList.toggle('error', !!this.mensaje?.aviso);

    // Botones
    const cambios = turnoMio && this.hayCambios();
    this.deshacerBtn.disabled = !cambios;
    this.robarBtn.disabled = !turnoMio;
    this.robarBtn.replaceChildren(...(p.pozo.length
      ? ['Robar', h('span', { class: 'solo-horizontal' }, '\u00A0ficha'), `\u00A0· quedan\u00A0${numero(p.pozo.length)}`]
      : ['Pasar turno']));
    this.robarBtn.setAttribute('aria-label', p.pozo.length ? `Robar ficha, quedan ${numero(p.pozo.length)}` : 'Pasar turno');
    this.terminarBtn.disabled = !turnoMio;
    this.ajustarTamaños();
  }

  /**
   * Ordena el atril con huecos entre combinaciones. Solo se agrupan las fichas que están en el
   * atril; las que has puesto en la mesa este turno quedan al final (sin verse) por si vuelven.
   */
  ordenar(agrupar) {
    const mio = this.esMiTurno() ? this.atrilT : this.p.jugadores[0].atril;
    const fichas = this.ordenAtril.filter((id) => id !== R.HUECO);
    this.ordenAtril = [...agrupar(fichas.filter((id) => mio.includes(id))), R.HUECO, ...fichas.filter((id) => !mio.includes(id))];
    this.pintar();
  }

  /**
   * Tamaños (v1.7). Atril: siempre con sitio para 20 fichas (10 por balda) y su ancho no depende
   * de nada más; con más fichas se ensancha (en horizontal, quitando sitio a los botones) y, si
   * no cabe, las fichas se hacen más pequeñas. Fichas del atril: máx. 64 px (60 en horizontal).
   * Mesa: fichas tan grandes como quepan (máx. 56 / 68).
   */
  ajustarTamaños() {
    if (!this.atrilEl) return;
    const horizontal = matchMedia('(orientation: landscape)').matches;
    const estilo = getComputedStyle(this.raiz);
    const interior = this.raiz.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
    // En horizontal, atril y botones van bajo el tapete (mismo ancho que él); los botones
    // conservan al menos 280 px (+16 de separación)
    const anchoMaximo = horizontal ? this.marcoMesa.clientWidth - 296 : interior;
    const maxAtril = horizontal ? 60 : 64;
    // Cada balda: relleno 28 px, separación 6 px entre piezas (fichas y huecos)
    const anchoBalda = (fa, { ancho, piezas }) => ancho * fa + (piezas - 1) * 6 + 28;
    const fa = Math.floor(Math.min(maxAtril,
      ...this.medidaBaldas.map(({ ancho, piezas }) => (anchoMaximo - 28 - (piezas - 1) * 6) / ancho)));
    this.raiz.style.setProperty('--fa-ancho', `${fa}px`);
    this.atrilEl.style.width = `${Math.ceil(Math.max(...this.medidaBaldas.map((m) => anchoBalda(fa, m))))}px`;
    // Mesa: empezar grande e ir reduciendo hasta que quepa (o llegar a 34 px y desplazar;
    // si aun así una combinación no cabe a lo ancho, se parte en dos líneas)
    const mesa = this.mesaEl;
    let fm = horizontal ? 68 : 56;
    this.raiz.style.setProperty('--fm-ancho', `${fm}px`);
    // Que quepa a lo alto y también a lo ancho (una escalera larga no debe cortarse)
    const desborda = () => mesa.scrollHeight > mesa.clientHeight + 1 || mesa.scrollWidth > mesa.clientWidth + 1;
    while (fm > 34 && desborda()) {
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
    this.iniciarTiempoTurno();
    // Al empezar tu turno manda «Tu turno…» (lo que han puesto los rivales sigue resaltado en la mesa)
    if (this.mensaje && !this.mensaje.aviso) this.mensaje = null;
    this.pintar();
  }

  // ---------- Tiempo: cronómetro de la partida y límite por turno (ajustes) ----------

  pintarReloj() {
    if (this.tiempoEl && this.mostrarReloj) this.tiempoEl.textContent = cronometro(this.reloj.segundos());
  }

  /** Segundos que te quedan en este turno (null si no hay límite). */
  restanteTurno() {
    if (!this.relojTurno) return null;
    return Math.max(0, Math.ceil(this.limiteTurno - this.relojTurno.segundos()));
  }

  /** De quién es el turno, en la barra debajo de «Rummy» (v1.7; antes, un cartel sobre el tapete). */
  pintarCartel() {
    if (!this.info) return;
    const { p } = this;
    const restante = this.restanteTurno();
    // Tras la jugada del último rival hay un momento en que el turno ya es tuyo pero aún no puedes tocar.
    const mio = p.turno === 0 && this.miTurno;
    this.info.textContent = p.terminada ? 'Partida terminada'
      : mio ? (restante === null ? 'Tu turno' : `Tu turno · ${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`)
        : (p.turno === 0 ? 'Ahora te toca…' : `Juega ${p.jugadores[p.turno].nombre}…`);
    this.info.classList.toggle('mio', mio && !p.terminada);
    this.info.classList.toggle('apurado', mio && restante !== null && restante <= 10);
  }

  iniciarTiempoTurno() {
    this.pararTiempoTurno();
    if (!this.limiteTurno) return;
    this.relojTurno = new Reloj(0, () => this.alPasarSegundoTurno());
    if (document.visibilityState !== 'hidden') this.relojTurno.arrancar();
  }

  pararTiempoTurno() {
    this.relojTurno?.parar();
    this.relojTurno = null;
  }

  alPasarSegundoTurno() {
    this.pintarCartel();
    if (this.restanteTurno() === 0 && this.esMiTurno()) this.tiempoAgotado();
  }

  /** Se acabó tu tiempo: lo mismo que tocar «Robar ficha» (lo puesto vuelve a tu atril). */
  tiempoAgotado() {
    this.pararTiempoTurno();
    this.cancelarArrastre();
    this.sel = null;
    this.robar(this.p.pozo.length ? 'Se acabó tu tiempo: has robado una ficha.' : 'Se acabó tu tiempo: pasas el turno.');
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
    this.quitarResaltes();
    this.sel = null;
    this.mensaje = null;
    this.pintar();
  }

  /** Lo que han hecho los rivales sigue marcado hasta que mueves algo. */
  quitarResaltes() {
    this.nuevas.clear();
    this.tocadas.clear();
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
    this.pararTiempoTurno();
    this.ultimaRobada = null;
    R.aplicarJugada(this.p, 0, this.mesaT, this.atrilT);
    this.ordenAtril = R.limpiarHuecos(this.ordenAtril.filter((id) => id === R.HUECO || this.p.jugadores[0].atril.includes(id)));
    this.atrilT = null;
    this.quitarResaltes();
    await this.despuesDeTurno();
  }

  /**
   * `avisoTiempo`: texto si se roba porque se acabó el tiempo. Ese aviso es «fijo»: se ve durante
   * toda la ronda de los rivales (no lo tapan sus mensajes) y se quita al empezar tu turno.
   */
  async robar(avisoTiempo = null) {
    if (!this.esMiTurno()) return;
    if (this.hayCambios()) this.deshacer();   // se devuelven al atril las fichas puestas
    if (avisoTiempo) this.mensaje = { texto: avisoTiempo, fijo: true };
    this.miTurno = false;
    this.pararTiempoTurno();
    const ficha = R.robar(this.p, 0);
    this.atrilT = null;
    this.quitarResaltes();
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
    if (!this.mensaje?.fijo) this.mensaje = null;
    // Lo que han hecho los rivales anteriores de esta ronda sigue marcado
    this.pintar();
    const paso = RAPIDO ? 30 : R.pasoRivales(this.ctx.ajustes.obtener('rummy.velocidad'));
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
      const { quitadas, puestas: cambiadas } = R.combinacionesCambiadas(p.mesa, decision.mesa);
      // 1) Se enmarcan las combinaciones de la mesa que va a cambiar, aún sin tocarlas
      if (quitadas.length) {
        for (const id of quitadas) this.tocadas.add(id);
        this.textoRival = reorganiza ? 'va a reorganizar la mesa' : 'va a añadir fichas';
        this.pintar();
        await espera(paso);
        if (!this.vivo) return;
      }
      // 2) La mesa ya reorganizada (sin sus fichas nuevas), con lo cambiado enmarcado
      for (const id of cambiadas) this.tocadas.add(id);
      this.vistaMesa = sinNuevas;
      this.textoRival = reorganiza ? 'reorganiza la mesa…' : 'coloca fichas…';
      this.pintar();
      await espera(paso);
      const visibles = new Set(sinNuevas.flat());
      for (const id of puestas) {
        if (!this.vivo) return;
        visibles.add(id);
        this.nuevas.add(id);
        this.vistaMesa = decision.mesa.map((c) => c.filter((x) => visibles.has(x))).filter((c) => c.length);
        this.textoRival = `pone ${R.nombreFicha(id)}`;
        this.pintar();
        await espera(paso);
      }
      this.vistaMesa = null;
      R.aplicarJugada(p, j, decision.mesa, decision.atril);
      this.ultimaAccion[j] = `ha puesto ${puestas.length === 1 ? '1 ficha' : `${puestas.length} fichas`}`;
    } else {
      const ficha = R.robar(p, j);
      this.ultimaAccion[j] = ficha === undefined ? 'ha pasado' : 'ha robado una ficha';
      this.textoRival = null;
    }
    this.animando = false;
    this.pintar();
    await this.guardar();
    await espera(paso);
  }


  async despuesDeTurno() {
    this.pintar();
    await this.guardar();
    this.avanzar();
  }

  visibilidad() {
    if (this.p?.terminada) return;
    if (document.visibilityState === 'hidden') { this.reloj.parar(); this.relojTurno?.parar(); this.guardar(); }
    else { this.reloj.arrancar(); if (this.esMiTurno()) this.relojTurno?.arrancar(); }
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
        // Para la tarjeta «Continuar» de Inicio: las primeras fichas del atril, en su orden.
        muestra: (this.ordenAtril || yo.atril).filter((id) => yo.atril.includes(id) && !R.esComodin(id)).slice(0, 8)
          .map((id) => ({ n: R.fichaDe(id).n, c: R.fichaDe(id).c, simbolo: R.SIMBOLO[R.fichaDe(id).c] })),
      },
      estado: this.p,   // el turno en curso empieza de nuevo al reanudar
    }).catch((e) => console.error('No se pudo guardar la partida', e));
  }

  async terminarPartida() {
    if (this.cerrada) return;
    this.cerrada = true;
    const { p } = this;
    this.pararTiempoTurno();
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
    this.pararTiempoTurno();
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
