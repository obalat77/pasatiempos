# Pasatiempos

Juegos de mesa y lógica para iPad, pensados para una persona mayor: letra grande, botones con texto, sin prisas, sin anuncios y sin conexión a internet una vez instalada. Todo se guarda solo en el iPad.

**Abrir la app:** https://obalat77.github.io/pasatiempos/

Juegos: Sudoku y Parejas de números (disponibles) · Palabras · Cálculos cruzados · Rummy (próximamente).

## Instalar en el iPad

1. Abre **Safari** en el iPad (tiene que ser Safari) y entra en https://obalat77.github.io/pasatiempos/
2. Espera a que se vea la pantalla de Inicio (así queda guardada para usarla sin internet).
3. Toca el botón **Compartir** (el cuadrado con una flecha hacia arriba, arriba a la derecha).
4. Baja y toca **«Añadir a pantalla de inicio»**.
5. Deja el nombre «Pasatiempos» y toca **Añadir**.

Aparecerá el icono verde con la «P». Desde ahí se abre a pantalla completa, como cualquier app, y funciona sin conexión.

**Actualizaciones:** cuando haya una versión nueva y el iPad tenga internet, la app mostrará abajo «Hay una versión nueva. Toca para actualizar». Al tocarlo se actualiza sin perder partidas ni estadísticas.

**Ojo:** las partidas y estadísticas solo se guardan en ese iPad. Si se borra el icono de la app, se pierden.

## Desarrollo

Sin frameworks ni compilación: HTML, CSS y JavaScript con módulos nativos. Qué hay que construir en [`ESPECIFICACION.md`](ESPECIFICACION.md); referencia visual en [`diseno/`](diseno/README.md).

```sh
npm run serve   # servidor local sin caché → http://localhost:8000
npm test        # pruebas de lógica (node --test)
```

- En `localhost` el modo sin conexión está desactivado para ver los cambios al momento. Para probarlo, abre http://localhost:8000/?sw
- **Al publicar cualquier cambio**, sube `VERSION` en `sw.js` y en `js/version.js` (una prueba comprueba que coinciden). Si añades o quitas archivos de la app, actualiza la lista `ARCHIVOS` de `sw.js` (otra prueba lo comprueba).
- Publicación: GitHub Pages desde la rama `main` (carpeta raíz).
- Iconos: `python3 herramientas/iconos.py <AtkinsonHyperlegible-Bold.ttf> icons` (necesita Pillow).

## Licencias

- Código: uso personal.
- Tipografía [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/), © Braille Institute of America, licencia SIL Open Font License 1.1 (`fonts/OFL.txt`).
