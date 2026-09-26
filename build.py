#!/usr/bin/env python3
"""Bundle the site into one self-contained HTML file: dist/milizie-76-anteprima.html."""
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "dist" / "milizie-76-anteprima.html"


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


def photos_script() -> str:
    content = (ROOT / "js" / "content.js").read_text(encoding="utf-8")
    found = {}
    for key, rel in re.findall(r"(\w+):\s*'(assets/photos/[^']+)'", content):
        p = ROOT / rel
        if p.exists():
            found[key] = data_uri(p)
    if not found:
        return ""
    body = ",\n".join(f'  "{k}": "{v}"' for k, v in found.items())
    print(f"Foto incluse: {', '.join(found)}")
    return f"<script>\nwindow.__PHOTOS__ = {{\n{body}\n}};\n</script>\n"


def main() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: inline_css(m.group(1)), html)
    photos = photos_script()
    html = html.replace('<script src="js/content.js"></script>', photos + '<script src="js/content.js"></script>')
    html = re.sub(r'<script src="([^"]+)"></script>', lambda m: inline_js(m.group(1)), html)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"Creato {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
