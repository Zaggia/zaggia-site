#!/usr/bin/env python3
"""Optimize photos (assets/photos/*.jpg -> assets/img/*.webp) and bundle the site
into one self-contained HTML file: dist/milizie-76-anteprima.html."""
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "dist" / "milizie-76-anteprima.html"
SRC_DIR = ROOT / "assets" / "photos"
IMG_DIR = ROOT / "assets" / "img"
MAX_SIDE = 1100
QUALITY = 70


def optimize_photos() -> None:
    try:
        from PIL import Image
    except ImportError:
        print("Pillow non installato (pip install pillow): foto non ottimizzate")
        return
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    for src in sorted(SRC_DIR.glob("*")):
        if src.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        out = IMG_DIR / (src.stem + ".webp")
        if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            continue
        with Image.open(src) as im:
            im = im.convert("RGB")
            im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
            im.save(out, "WEBP", quality=QUALITY, method=6)
        print(f"{src.name}: {src.stat().st_size // 1024} KB -> {out.name}: {out.stat().st_size // 1024} KB")


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if path.suffix == ".woff2":
        mime = "font/woff2"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def inline_css(href: str) -> str:
    css_path = ROOT / href
    css = css_path.read_text(encoding="utf-8")
    css = re.sub(r"url\((\.\./fonts/[^)]+)\)", lambda m: f"url({data_uri((css_path.parent / m.group(1)).resolve())})", css)
    return f"<style>\n{css}\n</style>"


def inline_js(src: str) -> str:
    js = (ROOT / src).read_text(encoding="utf-8").replace("</script", "<\\/script")
    return f"<script>\n{js}\n</script>"


def inline_html_images(html: str) -> str:
    return re.sub(r'src="(assets/img/[^"]+)"', lambda m: f'src="{data_uri(ROOT / m.group(1))}"' if (ROOT / m.group(1)).exists() else m.group(0), html)


def photos_script(skip: set) -> str:
    content = (ROOT / "js" / "content.js").read_text(encoding="utf-8")
    found = {}
    for key, rel in re.findall(r"(\w+):\s*'(assets/img/[^']+)'", content):
        p = ROOT / rel
        if p.exists() and rel not in skip:
            found[key] = data_uri(p)
    body = ",\n".join(f'  "{k}": "{v}"' for k, v in found.items())
    print(f"Foto incluse: {', '.join(found) or 'nessuna'}")
    return f"<script>\nwindow.__PHOTOS_BUNDLED__ = true;\nwindow.__PHOTOS__ = {{\n{body}\n}};\n</script>\n"


def main() -> None:
    optimize_photos()
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<link rel="preload"[^>]*>\n?', "", html)
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: inline_css(m.group(1)), html)
    in_html = set(re.findall(r'src="(assets/img/[^"]+)"', html))
    html = inline_html_images(html)
    photos = photos_script(in_html)
    html = html.replace('<script src="js/content.js"></script>', photos + '<script src="js/content.js"></script>')
    html = re.sub(r'<script src="([^"]+)"></script>', lambda m: inline_js(m.group(1)), html)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"Creato {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
