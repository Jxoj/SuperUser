"""Build a self-contained HTML distribution in singlefile/index.html."""

from __future__ import annotations

import base64
import filecmp
import hashlib
import json
import mimetypes
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "index.html"
OUTPUT = ROOT / "singlefile" / "index.html"
REMOTE_SCRIPT_HOSTS = {"cdn.tailwindcss.com", "unpkg.com"}
MAX_REMOTE_SCRIPT_BYTES = 20 * 1024 * 1024
EPOXY_WASM_URL = (
    "https://unpkg.com/@mercuryworkshop/epoxy-tls@2.1.19-1/full/epoxy.wasm"
)
EPOXY_WASM_SHA256 = "Tibwj/BmNc3ccLREkUVJD9mgCwH7/jGML2Kw0igAUI4="
RUNTIME_FILES = (
    "controller/controller.inject.js",
    "controller/controller.sw.js",
    "controller/epoxy.wasm",
    "scramjet/scramjet.js",
    "scramjet/scramjet.wasm",
)


def copy_generated_file(source: str | Path, destination: str | Path) -> Path:
    source_path = Path(source)
    destination_path = Path(destination)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    destination_path.unlink(missing_ok=True)
    return shutil.copy2(source_path, destination_path)


def generated_tree_matches(source: Path, destination: Path) -> bool:
    if not destination.is_dir():
        return False

    source_paths = {path.relative_to(source): path for path in source.rglob("*")}
    destination_paths = {
        path.relative_to(destination): path for path in destination.rglob("*")
    }
    if source_paths.keys() != destination_paths.keys():
        return False

    for relative_path, source_path in source_paths.items():
        destination_path = destination_paths[relative_path]
        if source_path.is_dir() != destination_path.is_dir():
            return False
        if source_path.is_file() and not filecmp.cmp(
            source_path, destination_path, shallow=False
        ):
            return False
    return True


def copy_generated_tree(source: Path, destination: Path) -> None:
    if generated_tree_matches(source, destination):
        return
    shutil.copytree(
        source,
        destination,
        dirs_exist_ok=True,
        copy_function=copy_generated_file,
    )


def inline_scripts(document: str, *, inline_remote: bool = False) -> str:
    pattern = re.compile(
        r'<script\b(?=[^>]*\bsrc=["\']([^"\']+)["\'])[^>]*>\s*</script>',
        flags=re.IGNORECASE,
    )

    def replace(match: re.Match[str]) -> str:
        src = match.group(1)
        if re.match(r"^(?:[a-z][a-z0-9+.-]*:)?//", src, re.IGNORECASE):
            host = urlparse(src).hostname
            if not inline_remote or host not in REMOTE_SCRIPT_HOSTS:
                return match.group(0)
            request = Request(src, headers={"User-Agent": "SuperUser-build/1.0"})
            with urlopen(request, timeout=30) as response:
                script_bytes = response.read(MAX_REMOTE_SCRIPT_BYTES + 1)
            if len(script_bytes) > MAX_REMOTE_SCRIPT_BYTES:
                raise ValueError(f"Remote script is too large to inline: {src}")
            script = script_bytes.decode("utf-8")
        else:
            asset = src.split("?", 1)[0].split("#", 1)[0].lstrip("/")
            path = ROOT / asset
            if not path.is_file():
                raise FileNotFoundError(f"Missing script asset: {path}")
            script = path.read_text(encoding="utf-8")
        script = re.sub(r"</script", r"<\\/script", script, flags=re.IGNORECASE)
        tag = match.group(0)
        script_type = re.search(r'\btype=["\']([^"\']+)["\']', tag, re.IGNORECASE)
        type_attribute = f' type="{script_type.group(1)}"' if script_type else ""
        return f"<script{type_attribute}>\n{script}\n</script>"

    return pattern.sub(replace, document)


def build_inline_asset_runtime(document: str) -> str:
    asset_directories = (ROOT / "assets", ROOT / "extensions" / "scripts")
    text_assets: dict[str, str] = {}
    image_assets: dict[str, str] = {}

    for directory in asset_directories:
        if not directory.is_dir():
            continue
        for path in directory.rglob("*"):
            if not path.is_file():
                continue
            relative = path.relative_to(ROOT).as_posix()
            if path.suffix.lower() in {".json", ".js"}:
                text_assets[relative] = path.read_text(encoding="utf-8")
            elif path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
                mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
                encoded = base64.b64encode(path.read_bytes()).decode("ascii")
                image_assets[relative] = f"data:{mime_type};base64,{encoded}"

    serialized_text = json.dumps(text_assets, ensure_ascii=True)
    serialized_images = json.dumps(image_assets, ensure_ascii=True)
    for token in ("<", ">", "&"):
        escaped = f"\\u{ord(token):04x}"
        serialized_text = serialized_text.replace(token, escaped)
        serialized_images = serialized_images.replace(token, escaped)

    runtime = f'''const __suInlineTextAssets = Object.freeze({serialized_text});
    const __suInlineImageAssets = Object.freeze({serialized_images});
    const appAsset = path => __suInlineImageAssets[path.replace(/^\\/+/, '')] || appPath(path);
    const fetchAppAsset = (path, options) => {{
      const key = path.replace(/^\\/+/, '');
      if (!Object.prototype.hasOwnProperty.call(__suInlineTextAssets, key)) {{
        return fetch(appPath(path), options);
      }}
      const contentType = key.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8';
      return Promise.resolve(new Response(__suInlineTextAssets[key], {{
        headers: {{ 'Content-Type': contentType }}
      }}));
    }}'''
    anchor = re.compile(
        r"const appAsset = path => appPath\(path\);\s*"
        r"const fetchAppAsset = \(path, options\) => fetch\(appPath\(path\), options\);"
    )
    document, replacements = anchor.subn(lambda _: runtime, document, count=1)
    if replacements != 1:
        raise ValueError("Could not locate the app asset helpers for single-file inlining")

    for relative, data_url in image_assets.items():
        document = document.replace(f'="/{relative}"', f'="{data_url}"')
    return document


def ensure_epoxy_wasm() -> Path:
    destination = ROOT / "controller" / "epoxy.wasm"
    if destination.is_file():
        existing_hash = base64.b64encode(
            hashlib.sha256(destination.read_bytes()).digest()
        ).decode("ascii")
        if existing_hash == EPOXY_WASM_SHA256:
            return destination

    request = Request(
        EPOXY_WASM_URL,
        headers={"User-Agent": "SuperUser-build/1.0"},
    )
    with urlopen(request, timeout=30) as response:
        wasm = response.read(2 * 1024 * 1024 + 1)
    if len(wasm) > 2 * 1024 * 1024:
        raise ValueError("Epoxy WASM download exceeded the allowed size")
    actual_hash = base64.b64encode(hashlib.sha256(wasm).digest()).decode("ascii")
    if actual_hash != EPOXY_WASM_SHA256:
        raise ValueError("Epoxy WASM integrity check failed")

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.unlink(missing_ok=True)
    destination.write_bytes(wasm)
    return destination


def copy_runtime_assets() -> None:
    output_dir = OUTPUT.parent
    ensure_epoxy_wasm()
    for relative in RUNTIME_FILES:
        source = ROOT / relative
        destination = output_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        copy_generated_file(source, destination)
    assets_source = ROOT / "assets"
    if assets_source.is_dir():
        copy_generated_tree(assets_source, output_dir / "assets")
    extension_catalog = ROOT / "extensions" / "scripts" / "index.json"
    if extension_catalog.is_file():
        copy_generated_tree(
            extension_catalog.parent, output_dir / "extensions" / "scripts"
        )
    copy_generated_file(ROOT / "sw.js", output_dir / "sw.js")
    copy_generated_file(ROOT / "_headers", output_dir / "_headers")
    internals_source = ROOT / "internals"
    if internals_source.is_dir():
        copy_generated_tree(internals_source, output_dir / "internals")
    learning_source = ROOT / "Mockups" / "learning.html"
    if not learning_source.is_file():
        raise FileNotFoundError(f"Missing learning mockup: {learning_source}")
    learning_destination = output_dir / "Mockups" / "learning.html"
    learning_destination.parent.mkdir(parents=True, exist_ok=True)
    learning_html = inline_scripts(
        learning_source.read_text(encoding="utf-8"),
        inline_remote=True,
    )
    learning_destination.unlink(missing_ok=True)
    learning_destination.write_text(learning_html, encoding="utf-8")


def main() -> None:
    html = SOURCE.read_text(encoding="utf-8")
    html = inline_scripts(html)
    html = build_inline_asset_runtime(html)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    copy_runtime_assets()
    OUTPUT.write_text(
        "<!-- Generated by build_singlefile.py; edit index.html instead. -->\n"
        + html,
        encoding="utf-8",
    )
    print(f"Built {OUTPUT}")


if __name__ == "__main__":
    main()
