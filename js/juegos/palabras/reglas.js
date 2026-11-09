// Palabras (ESPECIFICACION.md §5.2), sin pantalla.
// Lo usan la app, el generador de niveles (herramientas/palabras) y el validador (tests/).
//
// Nivel: { id, letras: ['A','M','O','R'], palabras: [...], extra: [...],
//          crucigrama: [{ palabra, fila, col, dir: 'H'|'V' }] }

export const LETRA = /^[A-ZÑ]$/;
export const PALABRA = /^[A-ZÑ]{3,}$/;

/** Cuántas veces aparece cada letra. */
export function contarLetras(texto) {
  const m = new Map();
  for (const l of texto) m.set(l, (m.get(l) || 0) + 1);
  return m;
}

/** ¿Se puede formar `palabra` con `letras` (respetando cuántas veces está cada una)? */
export function sePuedeFormar(palabra, letras) {
  const disponibles = contarLetras(Array.isArray(letras) ? letras.join('') : letras);
  for (const [l, n] of contarLetras(palabra)) if ((disponibles.get(l) || 0) < n) return false;
  return true;
}

// ---------- Crucigrama ----------

const paso = (dir) => (dir === 'H' ? [0, 1] : [1, 0]);

/** Casillas del crucigrama: Map «fila,col» → letra. Devuelve null si dos palabras se contradicen. */
export function casillas(crucigrama) {
  const mapa = new Map();
  for (const { palabra, fila, col, dir } of crucigrama) {
    const [df, dc] = paso(dir);
    for (let k = 0; k < palabra.length; k++) {
      const clave = `${fila + k * df},${col + k * dc}`;
      if (mapa.has(clave) && mapa.get(clave) !== palabra[k]) return null;
      mapa.set(clave, palabra[k]);
    }
  }
  return mapa;
}

/** Tamaño del crucigrama (filas × columnas), contando desde 0,0. */
export function tamaño(crucigrama) {
  let filas = 0, columnas = 0;
  for (const { palabra, fila, col, dir } of crucigrama) {
    const [df, dc] = paso(dir);
    filas = Math.max(filas, fila + (palabra.length - 1) * df + 1);
    columnas = Math.max(columnas, col + (palabra.length - 1) * dc + 1);
  }
  return { filas, columnas };
}

/**
 * Problemas del crucigrama (lista vacía si está bien):
 * contradicciones, «palabras accidentales» (tiras de letras que no son una palabra colocada),
 * palabras que no se cruzan con el resto y coordenadas negativas.
 */
export function problemasCrucigrama(crucigrama) {
  const problemas = [];
  const mapa = casillas(crucigrama);
  if (!mapa) return ['dos palabras ponen letras distintas en la misma casilla'];
  if (crucigrama.some((p) => p.fila < 0 || p.col < 0)) problemas.push('coordenadas negativas');

  // Cada palabra ocupa una tira completa: ni pegada a otra letra por delante ni por detrás
  // (si no, una palabra podría quedar «dentro» de otra más larga, como SER dentro de SERE).
  for (const c of crucigrama) {
    const [df, dc] = paso(c.dir);
    const antes = `${c.fila - df},${c.col - dc}`;
    const despues = `${c.fila + c.palabra.length * df},${c.col + c.palabra.length * dc}`;
    if (mapa.has(antes) || mapa.has(despues)) problemas.push(`«${c.palabra}» está pegada a otras letras en su misma línea`);
  }

  // Cada tira de 2+ letras seguidas (en horizontal o vertical) debe ser exactamente una palabra colocada.
  const colocadas = new Set(crucigrama.map((p) => `${p.dir}:${p.fila},${p.col}:${p.palabra}`));
  const { filas, columnas } = tamaño(crucigrama);
  const letra = (f, c) => mapa.get(`${f},${c}`);
  for (const dir of ['H', 'V']) {
    const lineas = dir === 'H' ? filas : columnas;
    const largo = dir === 'H' ? columnas : filas;
    for (let a = 0; a < lineas; a++) {
      let inicio = -1, texto = '';
      for (let b = 0; b <= largo; b++) {
        const f = dir === 'H' ? a : b, c = dir === 'H' ? b : a;
        const l = b < largo ? letra(f, c) : undefined;
        if (l) { if (inicio < 0) inicio = b; texto += l; continue; }
        if (texto.length >= 2) {
          const ff = dir === 'H' ? a : inicio, cc = dir === 'H' ? inicio : a;
          if (!colocadas.has(`${dir}:${ff},${cc}:${texto}`)) problemas.push(`palabra accidental «${texto}» (${dir} ${ff},${cc})`);
        }
        inicio = -1; texto = '';
      }
    }
  }

  // Todas conectadas
  if (crucigrama.length > 1) {
    const claves = (p) => {
      const [df, dc] = paso(p.dir);
      return Array.from({ length: p.palabra.length }, (_, k) => `${p.fila + k * df},${p.col + k * dc}`);
    };
    const visitadas = new Set([0]);
    const pendientes = [0];
    while (pendientes.length) {
      const i = pendientes.pop();
      const mias = new Set(claves(crucigrama[i]));
      crucigrama.forEach((otra, j) => {
        if (!visitadas.has(j) && claves(otra).some((k) => mias.has(k))) { visitadas.add(j); pendientes.push(j); }
      });
    }
    if (visitadas.size !== crucigrama.length) problemas.push('hay palabras que no se cruzan con las demás');
  }
  return problemas;
}

/**
 * Valida un nivel completo. Devuelve la lista de problemas (vacía si está bien).
 * `excluidas`: Set de palabras prohibidas (malsonantes u ofensivas).
 */
export function problemasNivel(nivel, excluidas = new Set()) {
  const p = [];
  const { letras, palabras, extra = [], crucigrama = [] } = nivel;
  if (!letras?.every((l) => LETRA.test(l))) p.push('letras no válidas');
  const todas = [...palabras, ...extra];
  for (const w of todas) {
    if (!PALABRA.test(w)) p.push(`«${w}» no es una palabra válida (mayúsculas sin tildes, 3 letras o más)`);
    else if (!sePuedeFormar(w, letras)) p.push(`«${w}» no se puede formar con ${letras.join('')}`);
    if (excluidas.has(w)) p.push(`«${w}» está en la lista de excluidas`);
  }
  if (new Set(todas).size !== todas.length) p.push('palabras repetidas');
  if (palabras.length < 2) p.push('menos de 2 palabras');
  const enCrucigrama = crucigrama.map((c) => c.palabra).sort();
  if (JSON.stringify(enCrucigrama) !== JSON.stringify([...palabras].sort())) p.push('el crucigrama no tiene exactamente las palabras del nivel');
  p.push(...problemasCrucigrama(crucigrama));
  return p;
}

// ---------- Partida ----------

export function crearPartida(nivel) {
  return {
    nivel: nivel.id,
    letras: [...nivel.letras],        // orden de la rueda (Mezclar lo cambia)
    encontradas: [],                  // palabras del nivel ya encontradas
    extras: [],                       // palabras extra encontradas en este nivel
    reveladas: [],                    // casillas descubiertas con Pista: «fila,col»
    pistas: 0,
  };
}

/**
 * Comprueba un intento. Devuelve:
 * 'nueva' | 'repetida' | 'extra' | 'extra-repetida' | 'corta' | 'no'
 */
export function comprobar(p, nivel, intento) {
  if (intento.length < 3) return 'corta';
  if (nivel.palabras.includes(intento)) {
    if (p.encontradas.includes(intento)) return 'repetida';
    p.encontradas.push(intento);
    return 'nueva';
  }
  if (nivel.extra.includes(intento)) {
    if (p.extras.includes(intento)) return 'extra-repetida';
    p.extras.push(intento);
    return 'extra';
  }
  return 'no';
}

export const completo = (p, nivel) => nivel.palabras.every((w) => p.encontradas.includes(w));

/** Casillas («fila,col») de una palabra colocada. */
export function casillasDe(colocada) {
  const [df, dc] = paso(colocada.dir);
  return Array.from({ length: colocada.palabra.length }, (_, k) => `${colocada.fila + k * df},${colocada.col + k * dc}`);
}

/** ¿Está visible la casilla? (palabra encontrada que pasa por ella, o descubierta con Pista) */
export function casillaVisible(p, nivel, clave) {
  if (p.reveladas.includes(clave)) return true;
  return nivel.crucigrama.some((c) => p.encontradas.includes(c.palabra) && casillasDe(c).includes(clave));
}

/**
 * ¿Se ve la letra k de la palabra colocada `c`?
 * En crucigrama, las letras compartidas se ven al encontrar cualquiera de las dos palabras;
 * en modo lista cada palabra va por separado: solo si se encontró o se descubrió con Pista.
 */
export function letraVisible(p, nivel, c, k, modo = 'crucigrama') {
  const clave = casillasDe(c)[k];
  if (modo === 'lista') return p.encontradas.includes(c.palabra) || p.reveladas.includes(clave);
  return casillaVisible(p, nivel, clave);
}

/**
 * Pista: descubre una letra de una palabra pendiente (la más corta; dentro de ella,
 * la primera letra aún oculta). Si con eso la palabra queda entera a la vista,
 * cuenta como encontrada. `modo`: 'crucigrama' | 'lista' (ver letraVisible).
 * Devuelve { clave, palabra, completada } o null.
 */
export function darPista(p, nivel, modo = 'crucigrama') {
  const pendientes = nivel.crucigrama
    .filter((c) => !p.encontradas.includes(c.palabra))
    .sort((a, b) => a.palabra.length - b.palabra.length);
  for (const c of pendientes) {
    const claves = casillasDe(c);
    const k = claves.findIndex((_, i) => !letraVisible(p, nivel, c, i, modo));
    if (k < 0) continue;
    p.reveladas.push(claves[k]);
    p.pistas++;
    const completada = claves.every((_, i) => letraVisible(p, nivel, c, i, modo));
    if (completada) p.encontradas.push(c.palabra);
    return { clave: claves[k], palabra: c.palabra, completada };
  }
  return null;
}

/** Reordena la rueda (siempre distinta de la anterior si hay más de una letra distinta). */
export function mezclar(p, azar = Math.random) {
  const antes = p.letras.join('');
  for (let intento = 0; intento < 10; intento++) {
    const a = [...p.letras];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    p.letras = a;
    if (a.join('') !== antes) return;
  }
}
