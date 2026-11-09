// Buscador de jugadas del Rummy (núcleo común de la inteligencia de los rivales).
//
// Dadas las fichas que deben quedar en la mesa (obligatorias) y las del atril (opcionales),
// busca un reparto en combinaciones válidas que coloque el máximo de fichas del atril
// (a igualdad, el máximo de puntos). Búsqueda con vuelta atrás y poda, con límite de tiempo:
// si se agota, devuelve la mejor solución encontrada hasta entonces.
import { fichaDe, esComodin, COLORES, analizar } from './reglas.js';

const clave = (n, c) => `${n}${c}`;

/**
 * @param {{ obligatorias: number[], opcionales: number[], limiteMs?: number,
 *           minPuntos?: number, ahora?: () => number }} opciones
 *   minPuntos: puntos mínimos de las combinaciones (primera bajada: 30, solo con fichas propias).
 * @returns {{ combinaciones: number[][], usadas: number[], puntos: number, completa: boolean,
 *             primera: object|null, nodos: number }}
 *   completa = la búsqueda terminó sin agotar el tiempo. primera = primera solución con fichas propias.
 */
export function buscar({ obligatorias, opcionales, limiteMs = 1000, minPuntos = 0, ahora = () => Date.now() }) {
  const limite = ahora() + limiteMs;
  const esOblig = new Set(obligatorias);
  const libres = new Set([...obligatorias, ...opcionales]);
  const opcOrden = [...opcionales].sort((a, b) => valorOrden(a) - valorOrden(b));

  let mejor = null;
  let primera = null;
  let nodos = 0;
  let agotado = false;
  const combos = [];
  let usadas = 0, puntosUsados = 0, puntosCombos = 0;

  const puntuar = () => usadas * 1000 + puntosUsados;
  const registrar = () => {
    if (minPuntos && usadas && puntosCombos < minPuntos) return;
    if (!mejor || puntuar() > mejor.valor) {
      mejor = { valor: puntuar(), combinaciones: combos.map((c) => [...c]), puntos: puntosCombos, usadasN: usadas };
    }
    if (!primera && usadas > 0) primera = { combinaciones: combos.map((c) => [...c]), puntos: puntosCombos };
  };

  const tiempo = () => {
    if ((++nodos & 31) === 0 && ahora() > limite) agotado = true;
    return agotado;
  };

  const poner = (combo) => {
    for (const id of combo) {
      libres.delete(id);
      if (!esOblig.has(id)) { usadas++; puntosUsados += valorPuntos(id); }
    }
    puntosCombos += analizar(combo).puntos;
    combos.push(combo);
  };
  const quitar = () => {
    const combo = combos.pop();
    puntosCombos -= analizar(combo).puntos;
    for (const id of combo) {
      libres.add(id);
      if (!esOblig.has(id)) { usadas--; puntosUsados -= valorPuntos(id); }
    }
  };

  // Fase 1: colocar todas las obligatorias (fichas de la mesa).
  const fase1 = () => {
    if (tiempo()) return;
    const ancla = siguienteObligatoria(libres, esOblig);
    if (ancla === undefined) { fase2(0); return; }
    // cota: aunque se usaran todas las opcionales que quedan, ¿se mejoraría?
    if (mejor && usadas + contarOpcionales(libres, esOblig) < mejor.usadasN) return;
    for (const combo of candidatas(ancla, libres, esOblig)) {
      poner(combo);
      fase1();
      quitar();
      if (agotado) return;
    }
  };

  // Fase 2: con la mesa ya colocada, añadir combinaciones nuevas solo con fichas del atril.
  const fase2 = (desde) => {
    registrar();
    if (tiempo()) return;
    for (let i = desde; i < opcOrden.length; i++) {
      const ancla = opcOrden[i];
      if (!libres.has(ancla) || esComodin(ancla)) continue;
      const restantes = opcOrden.slice(i).filter((x) => libres.has(x)).length;
      if (mejor && usadas + restantes < mejor.usadasN) return;
      const soloAtril = new Set([...libres].filter((x) => !esOblig.has(x)));
      for (const combo of candidatas(ancla, soloAtril, esOblig)) {
        poner(combo);
        fase2(i + 1);
        quitar();
        if (agotado) return;
      }
    }
  };

  fase1();
  if (!mejor) {
    // No se encontró reparto (no debería pasar si la mesa ya era válida): no jugar.
    return { combinaciones: null, usadas: [], puntos: 0, completa: !agotado, primera: null, nodos };
  }
  const enMesa = new Set(mejor.combinaciones.flat());
  return {
    combinaciones: mejor.combinaciones.map((c) => analizar(c).orden),
    usadas: opcionales.filter((id) => enMesa.has(id)),
    puntos: mejor.puntos,
    completa: !agotado,
    primera,
    nodos,
  };
}

const valorOrden = (id) => (esComodin(id) ? 100 : fichaDe(id).n * 4 + COLORES.indexOf(fichaDe(id).c));
const valorPuntos = (id) => (esComodin(id) ? 30 : fichaDe(id).n);

function siguienteObligatoria(libres, esOblig) {
  let comodin;
  for (const id of libres) {
    if (!esOblig.has(id)) continue;
    if (!esComodin(id)) return id;
    comodin = id;
  }
  return comodin;
}

function contarOpcionales(libres, esOblig) {
  let n = 0;
  for (const id of libres) if (!esOblig.has(id)) n++;
  return n;
}

/**
 * Combinaciones válidas que contienen `ancla`, con fichas de `disponibles`.
 * Entre dos fichas iguales (mismo número y color) se prefiere la obligatoria, y solo se
 * usa una de ellas por combinación (evita repetir soluciones equivalentes).
 * Se devuelven primero las que colocan más fichas.
 */
function candidatas(ancla, disponibles, esOblig) {
  const porClave = new Map();
  const comodines = [];
  for (const id of disponibles) {
    if (esComodin(id)) { comodines.push(id); continue; }
    const f = fichaDe(id);
    const k = clave(f.n, f.c);
    const actual = porClave.get(k);
    if (actual === undefined || (esOblig.has(id) && !esOblig.has(actual)) || id === ancla) porClave.set(k, id);
  }
  const salida = [];
  const anclas = esComodin(ancla) ? [...porClave.values()] : [ancla];
  const comodinesLibres = comodines.filter((j) => j !== ancla);
  const conComodin = esComodin(ancla);

  for (const base of anclas) {
    const f = fichaDe(base);
    const otros = conComodin ? [ancla, ...comodinesLibres] : comodines;
    // Series: mismo número, colores distintos
    const deOtrosColores = COLORES.filter((c) => c !== f.c).map((c) => porClave.get(clave(f.n, c))).filter((x) => x !== undefined);
    for (const subconjunto of subconjuntos(deOtrosColores)) {
      for (let j = 0; j <= Math.min(2, otros.length); j++) {
        const total = 1 + subconjunto.length + j;
        if (total < 3 || total > 4) continue;
        const usados = otros.slice(0, j);
        if (conComodin && !usados.includes(ancla)) continue;
        salida.push([base, ...subconjunto, ...usados]);
      }
    }
    // Escaleras: mismo color, números seguidos que incluyen al ancla
    for (let desde = Math.max(1, f.n - 12); desde <= f.n; desde++) {
      let faltan = 0;
      const tramo = [];
      let roto = false;
      for (let n = desde; n < f.n; n++) {
        const id = porClave.get(clave(n, f.c));
        if (id === undefined) faltan++; else tramo.push(id);
        if (faltan > otros.length) { roto = true; break; }
      }
      if (roto) continue;
      const izquierda = tramo.slice(), faltanIzq = faltan;
      let fin = f.n;
      const derecha = [];
      let faltanDer = 0;
      for (;;) {
        const largo = fin - desde + 1;
        const necesita = faltanIzq + faltanDer;
        if (largo >= 3 && necesita <= otros.length) {
          const usados = otros.slice(0, necesita);
          if (!conComodin || usados.includes(ancla)) salida.push([...izquierda, base, ...derecha, ...usados]);
        }
        fin++;
        if (fin > 13) break;
        const id = porClave.get(clave(fin, f.c));
        if (id === undefined) faltanDer++; else derecha.push(id);
        if (faltanIzq + faltanDer > otros.length) break;
      }
    }
  }
  // Quitar repetidas y comprobar (por seguridad) que son válidas
  const vistas = new Set();
  const validas = [];
  for (const c of salida) {
    const k = [...c].sort((a, b) => a - b).join(',');
    if (vistas.has(k) || !analizar(c)) continue;
    vistas.add(k);
    validas.push(c);
  }
  return validas.sort((a, b) => b.length - a.length);
}

function subconjuntos(lista) {
  const salida = [[]];
  for (const x of lista) {
    const n = salida.length;
    for (let i = 0; i < n; i++) salida.push([...salida[i], x]);
  }
  return salida;
}
