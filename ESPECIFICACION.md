# Pasatiempos — Especificación

Versión 1.6 · 21 de noviembre de 2026 (rediseño visual «Cada juego, su color»)

Aplicación web instalable (PWA) para iPad con cinco juegos de mesa y lógica, pensada para **una persona mayor**. Uso personal: sin anuncios, sin servidores, sin cuentas, sin internet después de instalarla.

Referencia visual: carpeta `diseno/` del repositorio (ver `diseno/README.md`). Si este documento y los diseños no coinciden, **manda este documento**; si este documento no dice nada, mandan los diseños.

Desde la v1.6 el **estilo** (colores, bordes, barra de juego, baldosas de Inicio) es el de `diseno/estilo-a.html` y §3 de este documento. Los `.dc.html` siguen valiendo para la **disposición y los textos** de cada pantalla, no para su aspecto.

---

## 1. Principios

1. **Fácil de leer y de usar.** Letra grande, mucho contraste, poca información en pantalla, botones grandes con texto (no solo iconos).
2. **Todo en español** (España): textos, fechas (`lunes, 9 de noviembre`), números (`1.250`), mensajes de error.
3. **Sin prisas ni presión.** Sin límites de tiempo, sin anuncios, sin sonidos obligatorios, sin notificaciones. Única excepción, a petición del usuario (v1.6): el ajuste opcional «Tiempo por turno» del Rummy, que por defecto es «Sin límite».
4. **Nada sale del iPad.** Todos los datos se guardan solo en el dispositivo. No hay copia de seguridad (decisión del usuario, v1.2): si se borra la app o se cambia de iPad, se pierden partidas y estadísticas.
5. **Funciona sin conexión** desde la primera vez que se abre.
6. **Funciona en vertical y en horizontal.** Safari no permite bloquear la orientación en una web app; cada pantalla debe tener un diseño para cada orientación.

---

## 2. Plataforma técnica

### 2.1 Tecnología
- HTML, CSS y JavaScript **sin frameworks y sin paso de compilación** (módulos ES nativos).
- **Sin dependencias en tiempo de ejecución** ni llamadas a internet. Nada de CDN: la tipografía va incluida en el repositorio.
- Dependencias solo para desarrollo si son imprescindibles (preferir `node --test` para las pruebas).
- Objetivo: Safari de iPadOS 17 o superior.

### 2.2 Instalación y publicación
- Alojamiento: **GitHub Pages** (archivos estáticos, https).
- `manifest.webmanifest`: `name` y `short_name` «Pasatiempos», `lang: "es"`, `display: "standalone"`, sin `orientation`, iconos 180/192/512 px (icono: letra «P» blanca sobre `#0B7A6C`, esquinas redondeadas).
- `apple-touch-icon` de 180 px y metas `apple-mobile-web-app-*` para que se vea a pantalla completa desde la pantalla de inicio.
- **Service worker** con caché «primero caché» de todos los archivos. Nombre de caché versionado (`pasatiempos-vN`); al publicar una versión nueva, subir N. La app avisa con un aviso discreto: «Hay una versión nueva. Toca para actualizar.»
- Instrucciones de instalación en `README.md`: abrir el enlace en Safari → Compartir → «Añadir a pantalla de inicio».

### 2.3 Estructura de carpetas (propuesta)
```
/index.html
/manifest.webmanifest
/sw.js
/css/            base.css (tokens, tipografía), componentes.css
/fonts/          Atkinson Hyperlegible (woff2, 400 y 700) + licencia OFL
/icons/
/js/app.js       arranque, navegación entre pantallas
/js/core/        db.js (IndexedDB), ajustes.js, estadisticas.js, tema.js, ui.js
/js/juegos/<juego>/   index.js (interfaz común) + lógica + vista
/js/juegos/rummy/worker.js   inteligencia de los rivales (Web Worker)
/data/palabras/niveles.json
/tests/          pruebas de lógica (node --test)
/diseno/         referencia visual (no forma parte de la app)
```

GitHub Pages publica toda la raíz de `main`, así que `diseno/` y `tests/` también quedan accesibles en la web. Es inofensivo: la app no los enlaza y el service worker **no** los guarda en caché.

### 2.4 Interfaz común de un juego
Cada juego es un módulo independiente. Añadir o cambiar un juego no debe tocar los demás.
```js
export default {
  id: 'sudoku',                 // sudoku | palabras | parejas | calculos | rummy
  nombre: 'Sudoku',
  descripcion: 'Fácil · Medio · Difícil · Experto',
  montar(contenedor, ctx),      // ctx: { db, ajustes, estadisticas, navegar }
  desmontar(),
  partidaEnCurso(),             // resumen para «Continuar partida» o null
  guardar(),                    // (opcional) guardar ya, p. ej. antes de actualizar la app
};
```

### 2.5 Datos (IndexedDB)
Base `pasatiempos`, almacenes:
- `ajustes` — clave/valor (ver §5).
- `partidas_en_curso` — una por juego; se guarda **automáticamente tras cada jugada** y al pasar la app a segundo plano (`visibilitychange`).
- `resultados` — una fila por partida terminada o abandonada: `{ id, juego, dificultad, inicio, fin, duracionSeg, resultado: 'terminada'|'abandonada'|'ganada'|'perdida', detalles }`. `detalles` es específico del juego (pistas usadas, errores, puntos, nivel…).
- `progreso` — p. ej. nivel actual de Palabras.

Las estadísticas se **calculan** a partir de `resultados` (no se guardan duplicadas).

### 2.6 Copia de seguridad
**Descartada** (v1.2): la app es para un familiar y no se considera necesaria. Si se recupera en el futuro: exportar los almacenes a un JSON con `version` de esquema (hoja de compartir en iPad) e importarlo con validación y confirmación. `db.reemplazarTodo` ya permite la importación.

### 2.7 Orientación y tamaños
- Pantalla de referencia: iPad 820 × 1180 pt (vertical) y 1180 × 820 pt (horizontal). Debe verse bien en otros iPad (de 744 a 1032 pt de ancho en vertical): escalar el tablero, nunca recortar.
- Elegir el diseño con `@media (orientation: …)` o comparando ancho y alto; cambiar al girar sin perder la partida.
- Respetar `env(safe-area-inset-*)`.
- `touch-action: manipulation` y sin zoom con doble toque; sin selección de texto accidental en tableros.

---

## 3. Sistema visual

### 3.1 Tipografía
- **Atkinson Hyperlegible Next** (400, 700 y 800), incluida localmente (licencia SIL OFL). Es la versión nueva de la misma familia (Braille Institute): igual de legible, con más grosores. El 800 se usa solo en títulos («Pasatiempos», nombres de juego en Inicio, título de la barra de juego) y en los números de tablero. Alternativa: `system-ui`. Los archivos `woff2` y la licencia se descargan **una sola vez** durante el desarrollo, de la fuente oficial, y se guardan en `/fonts/`; la app nunca los pide a internet.
- Tamaño mínimo de texto: **18 px**. Texto normal 19–21 px. Títulos de pantalla 26–40 px. El mínimo vale también para notas del Sudoku, etiquetas bajo iconos y textos auxiliares («14 fichas», «aún no ha bajado», «Quedan 4»). Solo quedan fuera los dibujos de los iconos.
- Números de tablero: 40–48 px, negrita.
- Ajuste **«Tamaño del texto: Grande»** multiplica todos los tamaños por 1,2 (usar `rem` y una variable raíz). Los tableros pueden reducir el espacio entre casillas para que quepan.
- Cifras que cambian (cronómetros): `font-variant-numeric: tabular-nums`.

### 3.2 Colores (tokens CSS)
| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--fondo` | `#F2F2F7` | `#0E151D` | fondo de pantalla |
| `--superficie` | `#FFFFFF` | `#16202B` | tarjetas, botones, casillas |
| `--texto` | `#1C1C1E` | `#F0F4F8` | texto principal |
| `--texto-2` | `#545458` | `#A9B6C3` | texto secundario |
| `--acento` | `#0B7A6C` | `#43C9B3` | botones principales, selección |
| `--sobre-acento` | `#FFFFFF` | `#0E151D` | texto sobre `--acento` |
| `--acento-texto` | `#0B6E62` | `#6FE0CC` | texto en color acento, números del jugador |
| `--acento-suave` | `#DDF1EE` | `#173A3A` | fondos de iconos, botón activo |
| `--pista` | `#E5E5EA` | `#243140` | fondos de selectores, barras de progreso |
| `--borde` | `#858C94` | `#66727E` | borde de botones, teclas y casillas vacías (v1.6: contraste ≥ 3:1 con `--fondo`) |
| `--linea` | `#D1D1D6` | `#2A3644` | líneas finas de cuadrícula |
| `--linea-fuerte` | `#3A3A3C` | `#7D8D9E` | bordes de bloque/tablero |
| `--seleccion` | `#B9E3DC` | `#1F5552` | casilla seleccionada |
| `--resaltado` | `#EDEFF2` | `#1F2730` | fila/columna/bloque relacionados; fondo de los resultados en Cálculos (v1.6: gris neutro) |
| `--chip` | `rgb(255 255 255 / 0.74)` | `rgb(255 255 255 / 0.12)` | píldoras dentro de una baldosa o barra de color de juego («‹ Inicio», «Jugar», «Pausa») |
| `--mismo-numero` | `#D2ECE7` | `#1D4240` | casillas con el mismo número |
| `--error` | `#C62828` | `#EF5350` | número incorrecto |
| `--eliminado` | `#C7C7CC` | `#5B6B7C` | números ya emparejados (Parejas) |

**Color de cada juego (v1.6).** Cada juego tiene su color: en Inicio rellena su baldosa y, dentro del juego, se usa **solo** en la barra de juego y en lo que se elige o se destaca. Tableros, teclas y botones siguen en `--superficie` con `--borde`. Los números que pone el jugador van siempre en `--acento-texto`. En la pantalla de cada juego, la raíz lleva su clase (`juego-sudoku`, …) que define `--j-fondo`, `--j-texto`, `--j-fuerte` y `--j-suave`:

| Juego | `--j-fondo` (claro / oscuro) | `--j-texto` | `--j-fuerte` | `--j-suave` |
|---|---|---|---|---|
| Sudoku | `#FFE08A` / `#3A3118` | `#3B2C00` / `#FFE08A` | `#FFD45C` / `#6A5414` | `#FFEFBF` / `#3E3517` |
| Palabras | `#FFC9B5` / `#43261C` | `#4A190A` / `#FFC9B5` | `#4A190A` / `#FFC9B5` | — |
| Parejas | `#D9D0FF` / `#2A2550` | `#22154F` / `#D9D0FF` | `#BFB0FF` / `#463C8A` | — |
| Cálculos | `#BFE4FF` / `#14324A` | `#0A2F4C` / `#BFE4FF` | `#3D7FB0` / `#5FA3D6` | — |
| Rummy | `#CDEBDD` / `#183A30` | `#0F3A2E` / `#CDEBDD` | — | — |

Uso por juego:
- **Sudoku:** barra en `--j-fondo`; casilla seleccionada `--j-fuerte` (sustituye a `--seleccion`); casillas con el mismo número `--j-suave` (sustituye a `--mismo-numero`); fila, columna y bloque en `--resaltado`. Si la casilla seleccionada tiene un número equivocado, va en `--superficie` con un anillo `--j-texto` (el rojo sobre `--j-fuerte` no llega a 3:1 en oscuro); las notas de la casilla seleccionada van en `--texto`.
- **Palabras:** barra, letras de la rueda y casillas de palabras encontradas en `--j-fondo` con letra `--j-texto`; letras ya tocadas y la línea que las une, invertidas (`--j-fuerte` de fondo, `--j-fondo` de letra); palabra en curso en una píldora `--j-fondo`. Letra descubierta con Pista en `--acento-texto`.
- **Parejas:** barra y botón «Añadir números» en `--j-fondo`; número seleccionado `--j-fuerte` (sustituye a `--seleccion`).
- **Cálculos:** barra en `--j-fondo`; huecos con borde discontinuo de 3 px `--j-fuerte`; hueco seleccionado con fondo `--j-fondo` y borde continuo `--j-texto`.
- **Rummy:** barra, aviso de turno y «aún no ha bajado» en `--j-fondo` con `--j-texto`; «Terminar turno» en el verde del tapete (`#2F6F5E`) con texto `#FFFFFF`. Los avisos en rojo de la línea de estado («Hay una combinación no válida…») van en `--superficie` con contorno `--error` (sobre `--j-fondo` no llegan a 4,5:1). Tapete, atril y fichas no cambian.

Contrastes comprobados: `--j-texto` sobre `--j-fondo` ≥ 7:1 en los dos temas; `--acento-texto` sobre `--j-fuerte` del Sudoku ≥ 3:1 (números de 44 px en negrita).

Rummy (iguales en ambos temas): tapete `#2F6F5E` con borde interior `#275D4F`; ficha `#FBF6E9`, borde `#D9CDB8`, sombra `#CBBEA6`; dorso `#E9DFCB`; atril madera `#A86B3C`, balda `#8A5428`, sombra `#7A4A26`. Colores de ficha: rojo `#C62828` ●, azul `#1565C0` ▲, negro `#222222` ■, naranja `#AD5700` ◆. Comodín: carita dibujada en rojo. Zona «Nueva combinación»: borde discontinuo `#CFE5DD` y texto `#FFFFFF` sobre el tapete.

Iconos de los juegos en Inicio (v1.6): se dibujan con `--j-texto` y `--chip` sobre la baldosa del juego, así que siguen el tema; las fichas del icono del Rummy usan los colores fijos del Rummy. El `#FFF8EC` del icono antiguo del Sudoku deja de usarse.

El color `#095F54` (`a:hover`) de los diseños no se usa: en el iPad no hay estado «hover».

Todo texto debe cumplir contraste 4,5:1 (3:1 a partir de 24 px). **Excepción deliberada:** los números ya eliminados de Parejas (`--eliminado`) tienen poco contraste a propósito, para que se distingan claramente de los que siguen en juego; funcionan como elementos desactivados y su estado se anuncia por `aria-label` («5, ya emparejado»).

### 3.3 Componentes
- **Botón principal:** fondo `--acento`, texto `--sobre-acento`, 64–76 px de alto, forma de píldora o radio 20 px, texto 20–24 px negrita.
- **Botón secundario:** fondo `--superficie` con borde 2 px `--borde` (o 2 px `--acento`), mismo alto. Las teclas de números y las herramientas (Deshacer, Borrar, Notas, Pista) son botones secundarios con radio 18–22 px.
- **Disposición común (v1.6):** todas las pantallas menos Inicio empiezan con la **barra** a todo el ancho, en las dos orientaciones, siempre en el mismo sitio. Márgenes exteriores iguales en todas las pantallas: 44 px arriba y 48 px a los lados y abajo en vertical; 40 px en horizontal. En los juegos, en horizontal: barra arriba, tablero a la izquierda y controles a la derecha.
- **Barra de juego (v1.6):** arriba en todas las pantallas de juego (en Estadísticas y Ajustes, la misma barra en gris `--pista`, sin color de juego); bloque de radio 30 px y fondo `--j-fondo`, texto `--j-texto`, relleno 16 px. Tres zonas: a la izquierda el botón «Inicio»; en el centro el nombre del juego (28–30 px, 800) y debajo el subtítulo (dificultad o nivel, 20 px); a la derecha el cronómetro (texto, 28 px) y el contador o la acción del juego («Pausa», «1 de 3 palabras», «Deshacer jugada») como píldora `--chip`. La barra es la misma en vertical y en horizontal.
- **Botón «Inicio»:** píldora `--chip` de 56 px con flecha «‹» + texto «Inicio», dentro de la barra de juego, a la izquierda.
- **Baldosa de juego (Inicio, v1.6):** radio 30 px, fondo `--j-fondo`, texto `--j-texto`; dibujo arriba (72 px; 64 px en horizontal y menos con texto grande, para que Inicio quepa sin desplazarse), nombre (30 px, 800), subtítulo (20 px; en horizontal el corto, p. ej. «4 dificultades») y píldora «Jugar» `--chip` abajo. Toda la baldosa es el botón.
- **Ventana (v1.6):** fondo `--superficie`, radio 32 px. Arriba, una barra con el color del juego: título a la izquierda y botón «✕ Cerrar» (icono y texto) a la derecha. También se cierra al tocar fuera o con Escape. Al elegir partida: «Seguir con la partida empezada» destacado (fondo `--j-texto`, texto `--j-fondo`) con el detalle debajo; las dificultades en una cuadrícula de 2 × 2 de botones de 88 px; la última elegida, con fondo `--j-fondo` y la nota «la última vez».
- **Selector segmentado** (Ajustes, pestañas): fondo `--pista`, opción activa con fondo `--acento`; alto 56–64 px.
- **Interruptor** 76 × 44 px.
- Áreas táctiles de **56 px como mínimo** (nunca menos de 44 px).
- Sin emojis. Iconos de trazo sencillos (SVG en línea) siempre acompañados de texto o `aria-label`.
- Accesibilidad: elementos reales (`<button>`, `<a>`), `aria-label` en tableros («Fila 3, columna 5, vacía»), `aria-pressed` en interruptores.

### 3.4 Tema
Ajuste **Tema: Claro / Oscuro / Automático** (Automático = `prefers-color-scheme`). Valor por defecto: Automático.

---

## 4. Pantallas de la plataforma

### 4.1 Inicio
- Cabecera: título «Pasatiempos» (50 px, 800) y fecha de hoy debajo. (v1.6: sin el icono «P».)
- Tarjeta **«Continuar partida»** (solo si hay una en curso; la más reciente): título «Sigue con el <juego>», detalle (p. ej. «Intermedio, te quedan 16 fichas» o «Fácil, 37 de 81 casillas»), botón «Reanudar» (píldora blanca). Fondo: el tapete del Rummy si es una partida de Rummy, con las primeras fichas del atril; en los demás juegos, `--j-fondo` de ese juego con su barra de progreso.
- **Juegos**, en este orden: Sudoku, Palabras, Parejas de números, Cálculos cruzados, Rummy, como **baldosas de juego** (§3.3) en dos columnas: Sudoku y Palabras; Parejas y Cálculos; Rummy ocupa la fila entera (icono, nombre y «Jugar» en una sola línea).
- Botones grandes **Estadísticas** y **Ajustes** (botones secundarios), abajo.
- Horizontal: columna izquierda de 420 px con cabecera, «Continuar» y Estadísticas/Ajustes; a la derecha las baldosas, con la misma disposición.
- Al elegir un juego con dificultades, preguntar la dificultad con botones grandes (Fácil / Medio / Difícil / Experto), recordando la última elegida (se resalta).
- Si ese juego tiene una partida a medias, la ventana ofrece primero «Seguir con la partida empezada»; elegir una dificultad empieza una nueva y la anterior queda registrada como **abandonada**.
- Mientras un juego no esté terminado (fases futuras), su tarjeta muestra «Próximamente» en lugar de «Jugar».

### 4.2 Estadísticas
- Estilo (v1.6): pantalla sobria, con `--acento` y sin colores de juego salvo una muestra pequeña del color del juego elegido junto a su nombre en el selector.
- Selector de juego: **Sudoku · Palabras · Parejas · Cálculos · Rummy** (también en vertical). Solo aparecen los juegos ya disponibles; con uno solo no hay selector y el título es «Estadísticas · Sudoku».
- Cuatro cifras: Partidas jugadas, Partidas terminadas (o ganadas), Racha actual (días seguidos con alguna partida terminada), Tiempo total. Las cuatro cajas miden lo mismo en todos los juegos y sus números tienen el mismo tamaño (v1.6).
- **Mejor tiempo** por dificultad («Sin partidas» si no hay).
- **Últimas partidas** (5 como máximo): fecha relativa («Hoy», «Ayer», «7 nov»), dificultad, duración, resultado.
- Específicas: Palabras → nivel alcanzado y palabras extra; Rummy → partidas ganadas por jugador y puntos.

### 4.3 Ajustes
Estilo (v1.6): pantalla sobria, con `--acento`, sin colores de juego.

Secciones (en vertical la pantalla se desplaza). Las de cada juego solo aparecen cuando ese juego está disponible:
- **Tema:** Claro / Oscuro / Automático.
- **Tamaño del texto:** Normal / Grande.
- **Sudoku:** Marcar errores en rojo (sí), Mostrar cronómetro (sí), Resaltar números iguales (no).
- **Palabras: modo de juego:** Crucigrama / Lista (más difícil).
- **Cálculos cruzados:** Marcar errores en rojo (sí).
- **Rummy: nivel de los rivales:** Principiante / Intermedio / Experto (común a los tres; se aplica desde la próxima partida).
- **Rummy: tiempo por turno** (v1.6): Sin límite (por defecto) / 2 min / 1 min / 30 s. Nota: «Si se acaba, robas una ficha. Se aplica desde tu próximo turno.»
- **Rummy: mostrar cronómetro** (v1.6): sí por defecto.
- Pie: versión de la app.

### 4.4 Comunes a todos los juegos
- Pausa automática del cronómetro cuando la app pasa a segundo plano.
- Al terminar: pantalla de enhorabuena sencilla (sin animaciones bruscas) con tiempo, dato destacado y botones «Otra partida» e «Inicio».
- «Inicio» durante una partida guarda y sale sin preguntar.
- **Deshacer** ilimitado dentro de la partida.

---

## 5. Juegos

### 5.1 Sudoku
- Tablero 9×9; casillas de 76 px en la pantalla de referencia; bloques 3×3 con línea de 3 px.
- **Generación en el dispositivo** con **solución única** (generar solución completa aleatoria → quitar números comprobando unicidad con un resolutor).
- Dificultades: **Fácil, Medio, Difícil, Experto**. Orientativo: 40, 32, 27 y 24 números dados; idealmente clasificar también por técnica necesaria.
- Interacción: tocar casilla → tocar número (teclado 1–9). Modo **Notas** (anotaciones pequeñas 3×3 en la casilla). Botones: Deshacer, Borrar, Notas (activo/inactivo), Pista.
- **Pista:** rellena correctamente la casilla seleccionada (o una con una sola posibilidad). Contar pistas usadas.
- Resaltados: fila, columna y bloque de la seleccionada; números iguales (si el ajuste está activo).
- Errores: si «Marcar errores» está activo, un número distinto de la solución se pinta en `--error`.
- Al poner un número, borrar esa nota en la fila/columna/bloque.
- Números completos (9 colocados): botón del teclado atenuado.
- Diseños: `Sudoku-A` (vertical), `Sudoku-Light-H` (horizontal) y sus versiones oscuras.

### 5.2 Palabras
Rueda de letras con la que se forman palabras. **Dos modos** (ajuste):
- **Crucigrama:** las palabras se colocan cruzadas; las letras compartidas ayudan.
- **Lista** (estilo Zen Word): cada palabra en su propia fila de casillas, sin cruces; ordenadas por longitud, en dos columnas.

Reglas:
- **1.000 niveles fijos** (v1.4; antes 100) en `data/palabras/niveles.json`, de 4 letras (niveles 1–100) a 7 letras (651–1.000), con las palabras más frecuentes al principio. Sirven para ambos modos. Se generan con `herramientas/palabras/` y se validan en las pruebas.
- Formato de nivel:
```json
{ "id": 3, "letras": ["A","M","O","R"],
  "palabras": ["AMOR","MORA","ROMA","RAMO"],
  "extra": ["MAR","AMO","ORA"],
  "crucigrama": [ {"palabra":"AMOR","fila":0,"col":0,"dir":"H"},
                  {"palabra":"MORA","fila":0,"col":1,"dir":"V"} ] }
```
- Palabras en **mayúsculas sin tildes** (Á→A, Ü→U); la **Ñ** es una letra propia. Solo palabras españolas comunes, sin nombres propios, sin palabras malsonantes ni ofensivas, de 3 letras o más.
- Las palabras del nivel deben poder formarse con las letras (respetando cuántas veces aparece cada una). Las del crucigrama deben cruzarse sin contradicciones ni palabras accidentales en la cuadrícula.
- Crear un **script de validación** (`tests/`) que compruebe los 1.000 niveles; además, cada palabra ocupa una tira completa del crucigrama (no puede quedar dentro de otra). Fuentes: diccionario es_ES de LibreOffice (MPL 1.1) y FrequencyWords (CC BY-SA 4.0), citadas en `data/palabras/FUENTES.md`; todas las palabras de los niveles revisadas a mano (`excluidas.txt`).
- **Interacción:** deslizar el dedo por las letras **y también** tocar letras una a una. La palabra en curso aparece sobre la rueda; se comprueba al levantar el dedo o, en modo toque, al tocar la palabra en curso. Tocar fuera la borra.
- Palabras **extra** (válidas pero no del nivel): se guardan y se muestran como «Palabras extra encontradas».
- Botones: **Mezclar** (reordena la rueda) y **Pista** (descubre una letra de una palabra pendiente). Pistas ilimitadas pero contadas.
- Al completar: «¡Nivel completado!» y «Siguiente nivel». Se guarda el nivel alcanzado. «Jugar» en Inicio abre directamente el nivel en curso (sin ventana de elección); Inicio muestra «Nivel N de 1.000». Estadísticas de Palabras: último nivel completado, palabras extra, racha, tiempo total y últimos niveles.
- Diseños: `Palabras-Light`, `Palabras-H-Light` (crucigrama), `Palabras-Lista-Light`, `Palabras-Lista-H-Light` (lista) y oscuros.

### 5.3 Parejas de números
Juego clásico de emparejar números (tipo «Take Ten»).
- Tablero de **9 columnas**, números del 1 al 9.
- Se eliminan **parejas** de números **iguales** o que **sumen 10**.
- Dos casillas pueden emparejarse si están:
  - juntas en horizontal, vertical o diagonal; o
  - en la misma fila, columna o diagonal con **solo casillas ya eliminadas** entre ellas; o
  - una al **final de una fila** y la otra al **principio de la siguiente**, leyendo el tablero como texto seguido (saltando casillas eliminadas).
- Los números eliminados quedan visibles en gris claro (`--eliminado`). Cuando una fila queda entera eliminada, desaparece.
- **Añadir números:** copia los números restantes (en orden) al final del tablero. **4 usos** por partida.
- Pista: ilumina una pareja válida; si no hay, sugiere «Añadir números».
- Fin: tablero vacío → ganada. Sin parejas y sin «Añadir números» → «No quedan jugadas» con «Otra partida».
- Tablero inicial: aleatorio, unos 27–36 números (3–4 filas), garantizando al menos varias parejas posibles.
- Interacción: tocar un número (queda marcado con `--seleccion`) y después el segundo; si no es válido, aviso suave y queda seleccionado el segundo.
- Concreción (v1.3): el tablero inicial tiene al menos 4 parejas posibles; el tablero muestra al menos 8 filas y se desplaza por dentro si hay más. En Estadísticas, las partidas sin jugadas aparecen como «Sin jugadas».
- Diseños: `Parejas-Light`, `Parejas-H-Light` y oscuros.

### 5.4 Cálculos cruzados
Crucigrama de cuentas.
- Tablero 7×7 (Fácil y Medio) y 9×9 (Difícil y Experto). Cuentas de la forma `a op b op c = r` (7×7) que se cruzan.
- Disposición (7×7, como en `Calculos-Light`): las cuentas horizontales ocupan las filas 0, 2 y 4 (el `=` en la columna 5 y el resultado en la columna 6); las verticales, las columnas 0, 2 y 4 (el `=` en la fila 5 y el resultado en la fila 6). La fila 6 y la columna 6 solo contienen resultados, no cuentas. En 9×9 es igual con 4 cuentas por sentido (filas/columnas 0, 2, 4, 6; `=` en la 7; resultado en la 8).
- Operadores por dificultad: **Fácil** + y −; **Medio** + − ×; **Difícil** + − × ÷; **Experto** + − × ÷, tableros 9×9 con más huecos.
- Se respeta la **prioridad de operaciones** (× y ÷ antes que + y −). Todos los resultados y pasos intermedios son **enteros no negativos**; la división siempre es exacta. Números de 1 a 20 (Fácil hasta 10).
- **Generación en el dispositivo:** crear valores válidos → elegir huecos → comprobar con un resolutor que la solución sea **única**.
- La **bandeja** contiene exactamente los números que faltan (con repeticiones si las hay).
- Interacción: tocar casilla vacía → tocar número de la bandeja. Borrar devuelve el número a la bandeja. Deshacer, Pista (coloca un número correcto).
- «Marcar errores en rojo» (ajuste): número distinto de la solución en `--error`.
- Fin: todas las cuentas correctas → enhorabuena.
- Concreción (v1.3): huecos por dificultad 5 / 6 (7×7) y 8 / 11 (9×9); resultados de 0 a 30 en Fácil y de 0 a 100 en el resto; en Medio y superiores hay al menos una × o ÷, y en Difícil y Experto al menos una ÷. La solución es única contando con los números exactos de la bandeja. Si se tocan números sin haber elegido casilla y solo queda un hueco vacío, el número va ahí.
- Diseños: `Calculos-Light`, `Calculos-H-Light` y oscuros (el diseño vertical ya funciona de forma interactiva y sirve de ejemplo de tablero correcto).

### 5.5 Rummy (fichas)
Juego de fichas numeradas al estilo del Rummikub clásico (no usar ese nombre ni su logotipo). **El jugador contra 3 rivales del iPad:** Lola (izquierda), Paco (arriba), Carmen (derecha).

**Material:** 106 fichas: números del 1 al 13 en 4 colores (rojo, azul, negro, naranja), dos de cada, más 2 comodines.

**Reglas:**
- Cada jugador empieza con 14 fichas. Empieza un jugador al azar.
- Combinaciones válidas en la mesa:
  - **Serie:** 3 o 4 fichas del mismo número y colores distintos.
  - **Escalera:** 3 o más números seguidos del mismo color (el 1 no va después del 13).
- **Primera bajada:** suma mínima de **30 puntos** solo con fichas propias, sin tocar la mesa. Hasta entonces no se puede reorganizar la mesa.
- Después: se pueden añadir fichas y **reorganizar libremente** toda la mesa, siempre que al terminar el turno todas las combinaciones sean válidas y se haya puesto al menos una ficha propia.
- Si no puede o no quiere jugar: **roba una ficha** y termina el turno.
- **Comodín:** sustituye a cualquier ficha. Se puede recuperar de la mesa sustituyéndolo por la ficha que representa; el comodín recuperado debe usarse en ese mismo turno.
- **Fin:** gana quien se queda sin fichas. Si se acaba el montón y nadie puede jugar, gana quien tenga menos puntos en el atril.
- **Puntuación:** cada perdedor resta la suma de sus fichas (comodín = 30); el ganador suma el total.
- **Deshacer jugada** devuelve la mesa y el atril al estado del principio del turno.

**Interacción (pensada para una persona mayor):**
- **Tocar ficha → tocar destino** (combinación de la mesa, zona «Nueva combinación» o atril). También arrastrar.
- Al tocar una ficha, se levanta y se marca con borde `--acento`.
- Las combinaciones no válidas se marcan con borde rojo y el botón «Terminar turno» explica por qué no se puede («Hay una combinación no válida en la mesa» / «La primera bajada debe sumar 30 puntos»).
- Ordenar el atril: **«Ordenar 1 2 3»** (por número) y **«Ordenar por color»**.
- Los turnos de los rivales se muestran despacio: «Paco está pensando…», y cada movimiento con una animación breve (~600 ms por paso) para que se pueda seguir.

**Inteligencia de los rivales** (un nivel común, ajuste en Ajustes). Todos **pueden reorganizar la mesa**. Se calcula en un **Web Worker** para no bloquear la pantalla.
- Núcleo común: un buscador que, a partir de todas las fichas de la mesa más las del atril, encuentra una distribución en combinaciones válidas que coloque el máximo de fichas del atril (o el máximo de puntos), con límite de tiempo.
- **Principiante:** límite ~0,3 s; baja en cuanto puede; a veces (≈30 %) se queda con una jugada peor; no se guarda fichas.
- **Intermedio:** límite ~1 s; coloca el máximo posible en cada turno.
- **Experto:** límite ~2–3 s; además estrategia: se guarda fichas para bajar muchas de golpe cuando le conviene, usa el comodín solo cuando aporta mucho, vigila cuántas fichas les quedan a los demás y, si alguien va a cerrar, baja todo lo que pueda.
- Si el límite de tiempo se agota, usar la mejor solución encontrada hasta entonces.

**Pantalla** (ver diseños `Rummy-Light`, `Rummy-H-Light` y oscuros): tapete verde en el centro con las combinaciones; rivales alrededor mostrando dorsos y número de fichas («aún no ha bajado» si procede); atril de madera de dos pisos abajo (7 + 7 huecos); botones Ordenar 1 2 3, Ordenar por color, Robar ficha, Terminar turno; «Deshacer jugada» arriba a la derecha; fichas que quedan por robar.

**Turno y tiempo (v1.6):**
- **De quién es el turno:** el rival que juega se destaca con una tarjeta en el color del Rummy (`--j-fondo`, contorno `--j-texto`), su nombre más grande y la cápsula «Le toca». Además, arriba del tapete, un cartel: «Tu turno» (píldora blanca) o «Juega Paco…» (contorno blanco); en el instante entre la última jugada de un rival y tu turno, «Ahora te toca…».
- **Cronómetro** de la partida en la barra, a la derecha (ajuste «Rummy: mostrar cronómetro»). Se para cuando la app pasa a segundo plano.
- **Tiempo por turno** (ajuste; por defecto sin límite): solo para tu turno. El cartel muestra «Tu turno · te quedan 0:45»; con 10 s o menos, el cartel lleva un contorno rojo (sin parpadeos ni sonidos). Al acabarse, ocurre lo mismo que con «Robar ficha» (lo puesto vuelve al atril; con el pozo vacío se pasa el turno) y se avisa «Se acabó tu tiempo: has robado una ficha.» (el aviso se queda durante toda la ronda de los rivales y se quita al empezar tu turno). La cuenta se para con la app en segundo plano; al reanudar una partida guardada, el turno empieza de nuevo con todo su tiempo.
- La barra muestra «N fichas por robar» (el nivel se ve en Inicio).
- Cada ficha: número grande en su color + **símbolo del color debajo** (● ▲ ■ ◆) para distinguirlas aunque cueste ver los colores. Comodín: carita.

**Concreción (v1.5):**
- Una sola partida por vez (sin rondas). Orden de turno: Tú, Lola, Paco, Carmen.
- Con una ficha elegida, tocar una ficha de una combinación la lleva a esa combinación; tocar el atril la devuelve (solo si era tuya y la pusiste en este turno). «Robar ficha» devuelve antes al atril lo que hubieras puesto; con el pozo vacío se llama «Pasar turno».
- La ficha que acabas de robar se resalta en el atril; las que acaba de poner un rival, con un contorno blanco (`#FFFFFF`, color fijo del Rummy) en la mesa. Mientras se anima la jugada de un rival no se marca ninguna combinación como no válida.
- Al reanudar una partida guardada a mitad de tu turno, ese turno empieza de nuevo (como «Deshacer jugada»).
- Experto: se guarda fichas cuando solo podría poner 1 o 2 (con 12 o menos en el atril), usa sus comodines solo si colocan al menos 3 fichas más (o para cerrar), y deja de guardarse en cuanto alguien tiene 3 fichas o menos o se acaba el pozo.
- Estadísticas del Rummy: partidas jugadas y ganadas, racha, tiempo total, tabla «Por jugador» (ganadas y puntos acumulados de cada uno) y últimas partidas con su nivel y ganador.

---

## 6. Fases de trabajo

Cada fase termina con la app publicada en GitHub Pages y probada en el iPad.

| Fase | Contenido | Se da por terminada cuando… |
|---|---|---|
| 1 | Plataforma (Inicio, Estadísticas, Ajustes, tema, tamaño de texto, IndexedDB, offline, instalación) + **Sudoku** | Se instala en el iPad, funciona sin conexión, se puede jugar un Sudoku completo de cada dificultad en vertical y horizontal, se guarda la partida al cerrar y las estadísticas se ven bien. |
| 2 | **Palabras** (ambos modos) + 1.000 niveles validados | Los 1.000 niveles pasan el validador y se pueden jugar en ambos modos, deslizando y tocando. |
| 3 | **Parejas de números** | Reglas de conexión cubiertas por pruebas; partida completa jugable. |
| 4 | **Cálculos cruzados** | El generador produce tableros con solución única en las 4 dificultades (pruebas); partida jugable. |
| 5 | **Rummy** | Reglas cubiertas por pruebas; partidas completas contra 3 rivales en los 3 niveles; el iPad no se bloquea mientras piensan. |
| 6 | **Rediseño visual** «Cada juego, su color» (v1.6, §3) | Letra nueva en `/fonts/`; tokens nuevos en `css/base.css`; Inicio, los cinco juegos (Palabras en sus dos modos), Estadísticas, Ajustes y las ventanas (elegir dificultad, pausa, enhorabuena) con el estilo nuevo, en vertical y horizontal, tema claro y oscuro, texto normal y grande; sin cambios en reglas ni datos guardados. |

---

## 7. Pruebas
- Lógica separada de la vista para poder probarla con `node --test`: generadores y resolutores (Sudoku, Cálculos), validación de niveles (Palabras), reglas de conexión (Parejas), validación de combinaciones, primera bajada y búsqueda (Rummy).
- Revisión visual en Safari con tamaños 820×1180 y 1180×820, ambos temas y ambos tamaños de texto, comparando con `diseno/`.

---

## 8. Decisiones abiertas
Para confirmar con el usuario cuando llegue cada fase:
1. ~~Fuente de la lista de palabras en español (licencia).~~ **Decidido:** ver §5.2 y `data/palabras/FUENTES.md`.
2. ~~Palabras: comprobar la palabra al soltar el dedo o con un botón «Comprobar» en modo toque.~~ **Decidido:** al soltar el dedo (y, en modo toque, al tocar la palabra en curso), sin botón «Comprobar».
3. ~~Rummy: ¿jugar a una sola partida o a varias rondas con puntuación acumulada?~~ **Decidido:** una sola partida (por ahora).
4. ~~¿Sonidos opcionales (desactivados por defecto)?~~ **Decidido:** sin sonidos.
5. Rediseño (fase 6), pantallas sin maqueta resueltas aplicando §3 (pendientes de visto bueno): Palabras en modo crucigrama igual que el modo lista; la ventana de elegir partida lleva el título en una barra con el color del juego; las tarjetas de pausa y enhorabuena, una franja superior con el color del juego; Estadísticas y Ajustes, sobrias, con una muestra del color de cada juego en el selector de Estadísticas.
