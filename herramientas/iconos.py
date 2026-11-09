"""Genera los iconos de la app en icons/ (solo desarrollo; necesita Pillow).
Uso: python3 herramientas/iconos.py <AtkinsonHyperlegible-Bold.ttf> icons
"""
import sys
from PIL import Image, ImageDraw, ImageFont
fuente_ttf, destino = sys.argv[1], sys.argv[2]
VERDE, BLANCO = (0x0B, 0x7A, 0x6C, 255), (255, 255, 255, 255)

def icono(tam, redondeado, margen_seguro=1.0):
    esc = 4  # dibujar a 4× y reducir para bordes suaves
    T = tam * esc
    img = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if redondeado:
        d.rounded_rectangle([0, 0, T - 1, T - 1], radius=int(T * 0.225), fill=VERDE)
    else:
        d.rectangle([0, 0, T, T], fill=VERDE)
    f = ImageFont.truetype(fuente_ttf, int(T * 0.74 * margen_seguro))
    caja = d.textbbox((0, 0), 'P', font=f)
    w, h = caja[2] - caja[0], caja[3] - caja[1]
    d.text(((T - w) / 2 - caja[0], (T - h) / 2 - caja[1]), 'P', font=f, fill=BLANCO)
    return img.resize((tam, tam), Image.LANCZOS)

icono(180, False).convert('RGB').save(f'{destino}/apple-touch-icon.png')   # iOS redondea solo; sin transparencia
icono(192, True).save(f'{destino}/icono-192.png')
icono(512, True).save(f'{destino}/icono-512.png')
icono(512, False, 0.8).save(f'{destino}/icono-512-maskable.png')          # Android recorta en círculo
icono(32, True).save(f'{destino}/favicon-32.png')
print('ok')
