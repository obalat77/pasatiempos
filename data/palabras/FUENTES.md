# Palabras: fuentes y licencias

Los niveles (`niveles.json`) se generan con `herramientas/palabras/` a partir de dos listas libres:

1. **Diccionario ortográfico es_ES de LibreOffice** — © Santiago Bosio y colaboradores
   (proyecto RLA-ES). Triple licencia GPL 3+, LGPL 3+ o MPL 1.1+; aquí se usa bajo
   **MPL 1.1**. https://github.com/LibreOffice/dictionaries/tree/master/es
   Sirve para decidir qué palabras existen y dejar fuera los nombres propios.

2. **FrequencyWords (2018), español** — © Hermit Dave, a partir de subtítulos de
   OpenSubtitles.org. Contenido bajo **CC BY-SA 4.0**.
   https://github.com/hermitdave/FrequencyWords
   Sirve para decidir qué palabras son comunes.

Por derivar de la segunda, `niveles.json`, `herramientas/palabras/comunes.txt` y
`herramientas/palabras/validas.txt` se distribuyen bajo **CC BY-SA 4.0**.

## Tratamiento

- Mayúsculas sin tildes (Á→A, Ü→U); la Ñ es una letra propia. De 3 a 7 letras.
- Palabras de los niveles: entre las ~9.000 más frecuentes que están en el diccionario
  (al principio solo las más frecuentes). Palabras extra: cualquier palabra del diccionario
  que aparezca en la lista de frecuencias.
- `excluidas.txt`: palabras malsonantes, ofensivas o desagradables, y las descartadas en la
  revisión manual de todas las palabras de los niveles (nombres propios, anglicismos,
  abreviaturas, interjecciones raras). Ninguna aparece en los niveles ni como extra.

## Regenerar

```sh
pip install spylls
python3 herramientas/palabras/construir_listas.py <ruta>/es_ES <ruta>/es_full.txt herramientas/palabras
node herramientas/palabras/generar-niveles.mjs 1000
npm test   # valida los niveles
```
