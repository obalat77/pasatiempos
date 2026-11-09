"""Construye las listas de palabras para generar los niveles de Palabras.

Fuentes (ver data/palabras/FUENTES.md):
  - Diccionario ortográfico es_ES de LibreOffice (GPL/LGPL/MPL; se usa bajo MPL 1.1):
    decide qué palabras existen y deja fuera los nombres propios.
  - Lista de frecuencias FrequencyWords 2018, español (CC BY-SA 4.0):
    decide qué palabras son comunes.

Salida (en herramientas/palabras/):
  comunes.txt  palabras frecuentes y válidas (para las palabras de los niveles), por frecuencia
  validas.txt  palabras válidas más amplias (para aceptar «palabras extra»)

Normalización: mayúsculas sin tildes (Á→A, Ü→U); la Ñ se mantiene. Solo de 3 a 7 letras.

Uso (necesita `pip install spylls`):
  python3 construir_listas.py <es_ES (sin extensión)> <es_full.txt> [salida]
"""
import re
import sys
import unicodedata
from pathlib import Path

from spylls.hunspell import Dictionary

MIN, MAX = 3, 7
CANDIDATAS = 2_000_000 # cuántas de las más frecuentes se comprueban (todas)
COMUNES = 9_000        # cuántas válidas (en orden de frecuencia) cuentan como «comunes»
SOLO_LETRAS = re.compile(r'^[a-záéíóúüñ]+$')


def normalizar(palabra: str) -> str:
    """«pingüino» → «PINGUINO»; «año» → «AÑO»."""
    salida = []
    for letra in palabra.upper():
        if letra == 'Ñ':
            salida.append('Ñ')
        else:
            base = unicodedata.normalize('NFD', letra)[0]
            salida.append(base)
    return ''.join(salida)


def main():
    diccionario, frecuencias = sys.argv[1], sys.argv[2]
    salida = Path(sys.argv[3] if len(sys.argv) > 3 else Path(__file__).parent)
    texto = (Path(__file__).parents[2] / 'data/palabras/excluidas.txt').read_text(encoding='utf-8')
    excluidas = set(' '.join(l for l in texto.splitlines() if not l.startswith('#')).split())

    d = Dictionary.from_files(diccionario)
    comunes, validas, vistas = [], set(), set()
    with open(frecuencias, encoding='utf-8') as f:
        for n, linea in enumerate(f):
            if n >= CANDIDATAS:
                break
            palabra = linea.split()[0]
            if not SOLO_LETRAS.match(palabra) or not (MIN <= len(palabra) <= MAX):
                continue
            if not d.lookup(palabra):          # minúscula: los nombres propios no pasan
                continue
            normal = normalizar(palabra)
            if normal in excluidas or not (MIN <= len(normal) <= MAX):
                continue
            validas.add(normal)
            if normal not in vistas and len(comunes) < COMUNES:
                comunes.append(normal)
            vistas.add(normal)

    (salida / 'comunes.txt').write_text('\n'.join(comunes) + '\n', encoding='utf-8')
    (salida / 'validas.txt').write_text('\n'.join(sorted(validas)) + '\n', encoding='utf-8')
    print(f'comunes: {len(comunes)}  válidas: {len(validas)}')


if __name__ == '__main__':
    main()
