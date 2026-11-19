"""Build an SVG launcher from an HTML file or a target URL."""

from __future__ import annotations

import html
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent

# Configure the URL and HTML file used by the two generated SVGs.
TARGET_URL = "https://jsuperuser.netlify.app"
HTML_INPUT_PATH = ROOT / "singlefile" / "index.html"
OUTPUT_DIR = ROOT / "singlefile"

# Prefix set for registry and self-contained forms
PREFIXES = ["/assets/", "/static/", "/cdn/", "/pkg/", "/_next/static/"]
_prefix_index = 0


def _next_prefix() -> str:
    global _prefix_index
    prefix = PREFIXES[_prefix_index % len(PREFIXES)]
    _prefix_index += 1
    return prefix


def _normalize_target(target: str) -> str:
    parsed = urlsplit(target)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Target must be an absolute http(s) URL")
    userinfo, separator, host = parsed.netloc.rpartition("@")
    authority = f"{userinfo}{separator}{host.lower()}" if separator else host.lower()
    return f"{parsed.scheme.lower()}://{authority}{parsed.path}" + (
        f"?{parsed.query}" if parsed.query else ""
    ) + (f"#{parsed.fragment}" if parsed.fragment else "")


def _extension(target: str) -> str:
    suffix = Path(urlsplit(target).path).suffix.lower().lstrip(".")
    return suffix if suffix in {"js", "json", "html", "css", "png", "jpg", "svg", "woff2"} else ""


def _registry_filename(target: str) -> str:
    extension = _extension(target)
    basename = Path(urlsplit(target).path).name
    if extension == "js":
        return "chunk.js" if re.search(r"(?:^|[.-])(?:chunk|vendor|runtime)(?:[.-]|$)", basename, re.I) else "main.js"
    if extension == "json":
        return "data.json"
    if extension == "html":
        return "index.html"
    if extension == "css":
        return "app.css"
    if extension in {"png", "jpg", "svg"}:
        return f"image.{extension}"
    if extension == "woff2":
        return "font.woff2"
    return "resource"


def add_relative_base(document_html: str) -> str:
    if re.search(r"<base\b", document_html, flags=re.IGNORECASE):
        return document_html

    base_tag = '<base href="./">'
    head_match = re.search(r"<head\b[^>]*>", document_html, flags=re.IGNORECASE)
    if head_match:
        insert_at = head_match.end()
        return f"{document_html[:insert_at]}\n{base_tag}{document_html[insert_at:]}"

    html_match = re.search(r"<html\b[^>]*>", document_html, flags=re.IGNORECASE)
    if html_match:
        insert_at = html_match.end()
        return f"{document_html[:insert_at]}\n<head>{base_tag}</head>{document_html[insert_at:]}"

    return f"<!doctype html><html><head>{base_tag}</head><body>{document_html}</body></html>"

def getRegistryUrl(target: str) -> str:
    """Generate a registry URL for the target."""
    normalized = _normalize_target(target)
    h16 = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
    return f"{_next_prefix()}{h16}/{_registry_filename(target)}"

def getSelfContainedUrl(target: str) -> str:
    """Generate a self-contained URL for the target."""
    normalized = _normalize_target(target)
    h8 = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:8]
    payload = target.encode("utf-8").hex()
    extension = _extension(target)
    suffix = f".{extension}" if extension else ""
    return f"{_next_prefix()}{h8}/{payload}{suffix}"


def build_html_svg(document_html: str) -> str:
    safe_html = html.escape(add_relative_base(document_html), quote=True)
    safe_html = (
        safe_html.replace("\r", "&#13;")
        .replace("\n", "&#10;")
        .replace("\t", "&#9;")
    )
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <foreignObject width="100%" height="100%" x="0" y="0">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100vw; height: 100vh; margin: 0;">
      <iframe title="Embedded HTML" srcdoc="{safe_html}" style="width: 100%; height: 100%; border: 0;"></iframe>
    </div>
  </foreignObject>
</svg>'''


def build_url_svg(target_url: str) -> str:
    # Keep the URL a JavaScript string literal and escape it for the SVG XML text node.
    safe_url = html.escape(json.dumps(target_url).replace("<", "\\u003c"), quote=False)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <foreignObject width="100%" height="100%" x="0" y="0">
    <div xmlns="http://www.w3.org/1999/xhtml" id="launcher" style="
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      background: #0a0a0a;
      color: #ffffff;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
    ">
      <div style="text-align: center; padding: 24px;">
        <h2 style="margin: 0 0 10px 0; font-weight: 600;">Click anywhere to launch</h2>
        <p style="margin: 0; color: #888; font-size: 14px;">Opens in a cloaked about:blank tab</p>
      </div>
    </div>

    <script xmlns="http://www.w3.org/1999/xhtml">
      const targetUrl = {safe_url};

      function launchCloaked() {{
        const win = window.open("about:blank", "_blank");
        if (!win) {{
          return false;
        }}

        const doc = win.document;
        doc.open();
        doc.write(`
          &lt;!DOCTYPE html&gt;
          &lt;html&gt;
          &lt;head&gt;
            &lt;title&gt;Super Learning&lt;/title&gt;
            &lt;link rel="icon" href="data:," /&gt;
            &lt;link rel="shortcut icon" href="data:," /&gt;
            &lt;style&gt;
              html, body {{
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: #000;
              }}
              iframe {{
                border: none;
                width: 100vw;
                height: 100vh;
                display: block;
              }}
            &lt;/style&gt;
          &lt;/head&gt;
          &lt;body&gt;
            &lt;iframe src="${{targetUrl}}" allowfullscreen="true"&gt;&lt;/iframe&gt;
          &lt;/body&gt;
          &lt;/html&gt;
        `);
        doc.close();
        try {{ win.document.title = "Super Learning"; }} catch (_) {{}}

        window.location.replace("https://www.google.com");
        return true;
      }}

      window.addEventListener("load", () => {{
        launchCloaked();
      }});

      document.getElementById("launcher").addEventListener("click", () => {{
        launchCloaked();
      }});
    </script>
  </foreignObject>
</svg>'''


def build_svg(target_url: str, html_input_path: Path, output_dir: Path) -> None:
    if not target_url:
        raise ValueError("TARGET_URL must be set")
    if not html_input_path.is_file():
        raise FileNotFoundError(f"Missing HTML input file: {html_input_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        output_dir / "index.svg": build_url_svg(target_url),
        output_dir / "html.svg": build_html_svg(
            html_input_path.read_text(encoding="utf-8")
        ),
    }
    for output_path, svg_content in outputs.items():
        output_path.unlink(missing_ok=True)
        output_path.write_text(svg_content, encoding="utf-8")
        print(f"Built SVG ({output_path.stat().st_size} bytes) -> '{output_path}'")


def main() -> None:
    build_svg(TARGET_URL, HTML_INPUT_PATH, OUTPUT_DIR)


if __name__ == "__main__":
    main()
