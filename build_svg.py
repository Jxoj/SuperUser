import os
import html

# ==========================================
# CONFIGURATION - Change your target URL here
# ==========================================
TARGET_URL = "https://jsuperuser.netlify.app"
OUTPUT_PATH = os.path.join("singlefile", "index.svg")


def build_launcher_svg(target_url: str, output_path: str):
    safe_url = html.escape(target_url, quote=True)

    # SVG containing embedded HTML/JS that opens target_url inside an about:blank iframe
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
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
      const targetUrl = "{safe_url}";

      function launchCloaked() {{
        const win = window.open("about:blank", "_blank");
        if (!win) {{
          // Browser blocked automatic popup; wait for user click
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

        // Redirect the original jsDelivr tab away once launched
        window.location.replace("https://www.google.com");
        return true;
      }}

      // Attempt immediate launch on page load
      window.addEventListener("load", () => {{
        launchCloaked();
      }});

      // Fallback: trigger on any click if popup blocker caught the auto-launch
      document.getElementById("launcher").addEventListener("click", () => {{
        launchCloaked();
      }});
    </script>
  </foreignObject>
</svg>'''

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(svg_content)

    print(f"Success! Built launcher SVG ({os.path.getsize(output_path)} bytes) -> '{output_path}'")
    print(f"Target URL set to: {target_url}")


if __name__ == "__main__":
    build_launcher_svg(TARGET_URL, OUTPUT_PATH)