"""
Rimette dentro pecs23.html le immagini della sala (l'oggetto FOTO_SALA).

    python incorpora.py lavoro/ ../../pecs23.html

In `lavoro/` servono: foto.png (foto ingrandita 4x), pulita.png (senza vetrine),
medio-4x.png (corridoio lontano, 16x: qui si riduce a 8x), fondo.png (parete di
fondo, 16x) e ids.png (mappa delle vetrine, esce da idmap.py).
"""
import base64
import io
import re
import sys

from PIL import Image


def data_uri(img, fmt, **kw):
    buf = io.BytesIO()
    if fmt == 'WEBP':
        img.convert('RGB').save(buf, 'WEBP', **kw)
    else:
        img.save(buf, 'PNG', optimize=True)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(buf.getvalue()).decode()


def main(cartella, pagina):
    medio = Image.open(f'{cartella}/medio-4x.png')
    medio = medio.resize((medio.width // 2, medio.height // 2), Image.LANCZOS)
    dati = {
        'foto': data_uri(Image.open(f'{cartella}/foto.png'), 'WEBP', quality=90, method=6),
        'pulita': data_uri(Image.open(f'{cartella}/pulita.png'), 'WEBP', quality=88, method=6),
        'medio': data_uri(medio, 'WEBP', quality=86, method=6),
        'fondo': data_uri(Image.open(f'{cartella}/fondo.png'), 'WEBP', quality=88, method=6),
        'ids': data_uri(Image.open(f'{cartella}/ids.png'), 'PNG'),
    }
    corpo = ''.join(f"  {k}: '{v}',\r\n" for k, v in dati.items())
    html = open(pagina, newline='').read()
    html, n = re.subn(r'(const FOTO_SALA = \{\r?\n).*?(\};)', lambda m: m.group(1) + corpo + m.group(2), html, count=1, flags=re.S)
    assert n == 1, 'FOTO_SALA non trovato'
    open(pagina, 'w', newline='').write(html)
    for k, v in dati.items():
        print(f'{k}: {len(v) // 1024} KB')


if __name__ == '__main__':
    main(*sys.argv[1:3])
