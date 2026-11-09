// Genera data/palabras/niveles.json a partir de comunes.txt y validas.txt.
// Uso: node herramientas/palabras/generar-niveles.mjs [número de niveles] [semilla]
//
// Para cada nivel: se elige una palabra base (4 letras al principio, 7 al final) cuyas
// letras forman la rueda; se buscan las palabras comunes que se pueden formar con ellas;
// se colocan cruzadas en un crucigrama sin contradicciones ni palabras accidentales.
// Las palabras extra son las demás palabras válidas que se pueden formar.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { crearAzar } from '../../js/core/azar.js';
import { sePuedeFormar, problemasNivel, problemasCrucigrama, casillas, tamaño } from '../../js/juegos/palabras/reglas.js';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = join(AQUI, '../..');
const leer = (ruta) => readFileSync(ruta, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);

const TOTAL = Number(process.argv[2] || 1000);
const azar = crearAzar(Number(process.argv[3] || 2026));
const excluidas = new Set(readFileSync(join(RAIZ, 'data/palabras/excluidas.txt'), 'utf8')
  .split('\n').filter((l) => !l.startsWith('#')).join(' ').split(/\s+/).filter(Boolean));
const comunes = leer(join(AQUI, 'comunes.txt')).filter((w) => !excluidas.has(w));
const rango = new Map(comunes.map((w, i) => [w, i]));
const validas = leer(join(AQUI, 'validas.txt')).filter((w) => !excluidas.has(w));
const LADO_MAXIMO = 9;   // el crucigrama cabe en 9×9 casillas

/** Parámetros según el número de nivel (1…TOTAL). */
function plan(n) {
  const t = n / TOTAL;
  const letras = t <= 0.10 ? 4 : t <= 0.35 ? 5 : t <= 0.65 ? 6 : 7;
  // Vocabulario: al principio solo las palabras más frecuentes; después, más amplio.
  // Con 4 letras hay pocas combinaciones, así que se amplía desde el principio.
  const vocabulario = letras === 4 ? 5000 : Math.round(3000 + 6000 * t);
  const [min, max] = { 4: [3, 4], 5: [4, 5], 6: [5, 6], 7: [6, 7] }[letras];
  return { letras, vocabulario, min, max };
}

// ---------- Crucigrama ----------

function intentarColocar(colocadas, palabra) {
  const mapa = casillas(colocadas);
  let mejor = null;
  for (const [clave, letra] of mapa) {
    const [f, c] = clave.split(',').map(Number);
    for (let k = 0; k < palabra.length; k++) {
      if (palabra[k] !== letra) continue;
      for (const dir of ['H', 'V']) {
        const cand = { palabra, dir, fila: dir === 'H' ? f : f - k, col: dir === 'H' ? c - k : c };
        // normalizar a coordenadas ≥ 0
        const todas = [...colocadas, cand];
        const df = Math.min(0, ...todas.map((x) => x.fila)), dc = Math.min(0, ...todas.map((x) => x.col));
        const movidas = todas.map((x) => ({ ...x, fila: x.fila - df, col: x.col - dc }));
        const { filas, columnas } = tamaño(movidas);
        if (filas > LADO_MAXIMO || columnas > LADO_MAXIMO) continue;
        if (problemasCrucigrama(movidas).length) continue;
        // Puntuación: más cruces y más compacto (y algo de azar para variar)
        const cruces = [...casillas(movidas).keys()].length;
        const puntos = -cruces * 10 - Math.max(filas, columnas) * 3 - Math.abs(filas - columnas) + azar.real();
        if (!mejor || puntos > mejor.puntos) mejor = { puntos, movidas };
      }
    }
  }
  return mejor?.movidas || null;
}

function crucigrama(palabras) {
  const [primera, ...resto] = palabras;
  let colocadas = [{ palabra: primera, fila: 0, col: 0, dir: azar.real() < 0.5 ? 'H' : 'V' }];
  const sobran = [];
  for (const w of resto) {
    const nuevo = intentarColocar(colocadas, w);
    if (nuevo) colocadas = nuevo; else sobran.push(w);
  }
  return { colocadas, sobran };
}

// ---------- Niveles ----------

const usadasComoBase = new Set();
const ruedasUsadas = new Set();
const niveles = [];
const formablesDe = (letras, lista) => lista.filter((w) => w.length <= letras.length && sePuedeFormar(w, letras));

for (let n = 1; n <= TOTAL; n++) {
  const { letras: L, vocabulario, min, max } = plan(n);
  const vocab = comunes.slice(0, vocabulario);
  // Primero las bases más frecuentes (con algo de azar para variar).
  const bases = vocab.filter((w) => w.length === L && !usadasComoBase.has(w))
    .map((w) => ({ w, orden: rango.get(w) + azar.real() * 800 }))
    .sort((a, b) => a.orden - b.orden).map((x) => x.w);
  let hecho = null;
  for (const base of bases) {
    const rueda = [...base].sort().join('');
    if (ruedasUsadas.has(rueda)) continue;
    const opciones = formablesDe(base, vocab).filter((w) => w !== base)
      .sort((a, b) => rango.get(a) - rango.get(b));
    if (opciones.length + 1 < min) continue;
    // La base y las más frecuentes; se intenta colocar hasta tener «max».
    const elegidas = [base, ...opciones].slice(0, max + 3);
    const ordenadas = [base, ...elegidas.slice(1).sort((a, b) => b.length - a.length)];
    const { colocadas } = crucigrama(ordenadas);
    let finales = colocadas;
    if (finales.length > max) {
      // quedarnos con la base y las más frecuentes que formen un crucigrama válido
      const preferidas = [base, ...elegidas.slice(1).filter((w) => finales.some((c) => c.palabra === w))].slice(0, max);
      finales = crucigrama([base, ...preferidas.slice(1).sort((a, b) => b.length - a.length)]).colocadas;
    }
    if (finales.length < min) continue;
    const palabras = finales.map((c) => c.palabra);
    const letras = azar.barajar([...base]);
    const extra = formablesDe(base, validas).filter((w) => !palabras.includes(w)).sort();
    hecho = { id: n, letras, palabras, extra, crucigrama: finales };
    usadasComoBase.add(base);
    ruedasUsadas.add(rueda);
    break;
  }
  if (!hecho) throw new Error(`No se pudo generar el nivel ${n} (${L} letras)`);
  const problemas = problemasNivel(hecho, excluidas);
  if (problemas.length) throw new Error(`Nivel ${n} no válido: ${problemas.join('; ')}`);
  niveles.push(hecho);
}

const salida = join(RAIZ, 'data/palabras/niveles.json');
writeFileSync(salida, JSON.stringify(niveles) + '\n');
const vocabUsado = new Set(niveles.flatMap((nv) => nv.palabras));
console.log(`${niveles.length} niveles → ${salida}`);
console.log(`palabras distintas en niveles: ${vocabUsado.size}; tamaño: ${Math.round(JSON.stringify(niveles).length / 1024)} KB`);
