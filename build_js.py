"""Build a small mirror launcher JavaScript file."""

from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "singlefile" / "launcher.js"

LAUNCHER = r"""(() => {
  const mirrors = {
    mirror1: 'https://jxoj.github.io/SuperUser/singlefile/index.html',
    mirror2: 'https://jsuperuser.netlify.app/singlefile/index.html'
  };
  const root = document.createElement('main');
  root.innerHTML = `
    <style>
      :host { all: initial; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #070b12; color: #e8eef8; font: 16px system-ui, sans-serif; }
      .card { width: min(520px, calc(100vw - 40px)); padding: 28px; border: 1px solid #263449;
        border-radius: 18px; background: #101827; box-shadow: 0 20px 60px #0008; }
      h1 { margin-top: 0; } p { color: #9eabc0; }
      button, input { box-sizing: border-box; width: 100%; margin-top: 10px; padding: 12px;
        border-radius: 10px; border: 1px solid #31425e; background: #162238; color: inherit; }
      button { cursor: pointer; } button:hover { border-color: #69e6a1; }
      input { outline: none; } .status { min-height: 22px; color: #69e6a1; }
    </style>
    <section class="card">
      <h1>SuperUser</h1>
      <p>Choose the server mirror to launch in a new about:blank tab.</p>
      <button data-mirror="mirror1">Mirror 1</button>
      <button data-mirror="mirror2">Mirror 2 (Recommended)</button>
      <input id="custom" placeholder="Custom single-file URL">
      <button data-mirror="custom">Use custom</button>
      <div class="status" id="status"></div>
    </section>`;
  document.body.replaceChildren(root);
  const status = root.querySelector('#status');
  root.querySelectorAll('[data-mirror]').forEach(button => {
    button.addEventListener('click', async () => {
      const url = button.dataset.mirror === 'custom'
        ? root.querySelector('#custom').value.trim()
        : mirrors[button.dataset.mirror];
      if (!/^https?:\/\/.+/i.test(url)) {
        status.textContent = 'Enter a valid http(s) URL.';
        return;
      }
      status.textContent = 'Fetching mirror...';
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const target = window.open('about:blank', '_blank');
        if (!target) throw new Error('Popup blocked');
        target.document.open();
        target.document.write(html);
        target.document.close();
        status.textContent = 'Launched.';
      } catch (error) {
        status.textContent = `Unable to launch: ${error.message}`;
      }
    });
  });
})();
"""


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(LAUNCHER, encoding="utf-8")
    print(f"Built {OUTPUT}")


if __name__ == "__main__":
    main()
