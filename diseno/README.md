# Diseños de Pasatiempos

Referencia visual de todas las pantallas, exportada del lienzo de diseño.

## Cómo leer estos archivos
- Cada `.dc.html` es **una pantalla**. Usan un formato propio del lienzo (etiquetas `<x-dc>`, `<sc-for>`, `<sc-if>` y un bloque `<script type="text/x-dc">`), así que **no se abren como página normal** en el navegador. Sirven como referencia exacta: los estilos están escritos en línea (`style="…"`) con los colores, tamaños, márgenes y radios definitivos, y el texto es el texto real en español.
- Las partes repetitivas (casillas, fichas, números) se generan en el bloque `<script>` final (`renderVals()`), donde también están los colores de las casillas y los datos de ejemplo.
- Tamaños de pantalla: vertical **820 × 1180**, horizontal **1180 × 820** (puntos CSS del iPad).
- Las cifras, tiempos, nombres y fichas son **ejemplos**.
- Los diseños oscuros son los claros con la paleta oscura de `ESPECIFICACION.md` §3.2.
- `canvas.json` es el índice del lienzo (posición de cada pantalla); no hace falta para programar.

## Pantallas
| Pantalla | Vertical claro | Vertical oscuro | Horizontal claro | Horizontal oscuro |
|---|---|---|---|---|
| Inicio | `Main.dc.html` | `Home-C.dc.html` | `Home-H-Light.dc.html` | `Home-H-Dark.dc.html` |
| Sudoku | `Sudoku-A.dc.html` | `Sudoku-C.dc.html` | `Sudoku-Light-H.dc.html` | `Sudoku-Dark-H.dc.html` |
| Palabras · crucigrama | `Palabras-Light.dc.html` | `Palabras-Dark.dc.html` | `Palabras-H-Light.dc.html` | `Palabras-H-Dark.dc.html` |
| Palabras · lista | `Palabras-Lista-Light.dc.html` | `Palabras-Lista-Dark.dc.html` | `Palabras-Lista-H-Light.dc.html` | `Palabras-Lista-H-Dark.dc.html` |
| Parejas de números | `Parejas-Light.dc.html` | `Parejas-Dark.dc.html` | `Parejas-H-Light.dc.html` | `Parejas-H-Dark.dc.html` |
| Cálculos cruzados | `Calculos-Light.dc.html` | `Calculos-Dark.dc.html` | `Calculos-H-Light.dc.html` | `Calculos-H-Dark.dc.html` |
| Rummy | `Rummy-Light.dc.html` | `Rummy-Dark.dc.html` | `Rummy-H-Light.dc.html` | `Rummy-H-Dark.dc.html` |
| Estadísticas | `Stats-Light.dc.html` | `Stats-Dark.dc.html` | `Stats-H-Light.dc.html` | `Stats-H-Dark.dc.html` |
| Ajustes | `Settings-Light.dc.html` | `Settings-Dark.dc.html` | `Settings-H-Light.dc.html` | `Settings-H-Dark.dc.html` |

## Diferencias conocidas con la especificación
Cuando no coincidan, manda `ESPECIFICACION.md`:
- **Estadísticas vertical** no tiene el selector de juego. Añadirlo como en la versión horizontal (Sudoku · Palabras · Parejas · Cálculos · Rummy).
- **Ajustes vertical** no tiene las secciones «Palabras: modo de juego», «Cálculos cruzados» ni «Rummy: nivel de los rivales». Añadirlas; la pantalla se desplaza.
- **Ajustes horizontal** no tiene la sección «Cálculos cruzados: marcar errores». Añadirla.
- El color de error en tema oscuro de la especificación (`#EF5350`) sustituye al rojo de los diseños oscuros.
- **Textos de menos de 18 px** en los diseños: subirlos a 18 px como mínimo (ESPECIFICACION §3.1):
  - Sudoku: notas de casilla (17 px).
  - Palabras (ambos modos): etiquetas «Mezclar» y «Pista» bajo el icono (17 px).
  - Parejas: «Quedan 4» / «(quedan 4)» del botón «Añadir números» (16–17 px).
  - Rummy: «11 fichas» / «14 fichas» (17 px) y «aún no ha bajado» (15 px) junto a cada rival.
  - Los números del icono de Sudoku en Inicio (15 px) son parte del dibujo y no cambian.
- **Colores fuera de la tabla de tokens:** el gris de los números emparejados de Parejas pasa a ser el token `--eliminado`; el borde `#CFE5DD` de «Nueva combinación» (Rummy) y el `#FFF8EC` del icono de Sudoku quedan como colores fijos documentados en ESPECIFICACION §3.2; el `#095F54` de `a:hover` no se usa.
- **Cálculos cruzados:** la disposición de filas y columnas (cuentas en 0, 2 y 4; `=` en la 5; resultados en la 6) está descrita en ESPECIFICACION §5.4 a partir de `Calculos-Light`.
