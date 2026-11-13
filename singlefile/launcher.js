(() => {
  const mirrors = {
    mirror1: 'https://jxoj.github.io/SuperUser/singlefile/index.html',
    mirror2: 'https://jsuperuser.netlify.app/singlefile/index.html'
  };
  const root = document.createElement('main');
  root.innerHTML = `
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: radial-gradient(ellipse at top, #17243b, #070b12 65%);
        color: #e8eef8; font: 15px system-ui, sans-serif; }
      .card { width: min(520px, calc(100vw - 40px)); padding: 28px; border: 1px solid #263449;
        border-radius: 18px; background: #101827ef; box-shadow: 0 20px 60px #0008; }
      h1 { margin: 0; font-size: 25px; letter-spacing: -.04em; }
      p { color: #9eabc0; line-height: 1.5; }
      .choice { display: flex; align-items: center; gap: 12px; margin: 10px 0;
        padding: 13px; border: 1px solid #263449; border-radius: 12px; cursor: pointer; }
      .choice:has(input:checked) { border-color: #69e6a1; background: #69e6a111; }
      .choice input { accent-color: #69e6a1; }
      .choice span { display: grid; gap: 3px; } small { color: #9eabc0; }
      input[type=url] { box-sizing: border-box; width: 100%; margin-top: 6px; padding: 12px;
        border-radius: 10px; border: 1px solid #31425e; background: #0c1422; color: inherit; }
      button { box-sizing: border-box; width: 100%; margin-top: 14px; padding: 12px;
        border-radius: 10px; border: 1px solid #69e6a1; background: #69e6a1; color: #07110b;
        font-weight: 700; cursor: pointer; }
      .status { min-height: 22px; margin-top: 10px; color: #69e6a1; overflow-wrap: anywhere; }
    </style>
    <section class="card">
      <h1>SuperUser launcher</h1>
      <p>Mirror 2 is recommended. If it is unavailable, the launcher tries Mirror 1.</p>
      <label class="choice"><input type="radio" name="mirror" value="mirror1">
        <span><b>Mirror 1</b><small>GitHub Pages</small></span></label>
      <label class="choice"><input type="radio" name="mirror" value="mirror2" checked>
        <span><b>Mirror 2 · Recommended</b><small>Netlify</small></span></label>
      <label class="choice"><input type="radio" name="mirror" value="custom">
        <span><b>Custom server</b><small>Enter a single-file HTML URL</small></span></label>
      <input id="custom" type="url" placeholder="https://example.com/singlefile/index.html">
      <button id="launch">Launch in new tab</button>
      <div class="status" id="status" role="status" aria-live="polite"></div>
    </section>`;
  document.body.replaceChildren(root);
  const status = root.querySelector('#status');
  const timeoutMs = 7000;

  function getTargets(choice, customUrl) {
    if (choice === 'custom') return [customUrl];
    if (choice === 'mirror1') return [mirrors.mirror1, mirrors.mirror2];
    return [mirrors.mirror2, mirrors.mirror1];
  }

  async function checkMirror(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      if (!html.includes('SuperUser Proxy')) throw new Error('The response is not a SuperUser build');
      return response.url || url;
    } finally {
      clearTimeout(timeout);
    }
  }

  root.querySelector('#launch').addEventListener('click', async () => {
    const choice = root.querySelector('input[name="mirror"]:checked')?.value || 'mirror2';
    const customUrl = root.querySelector('#custom').value.trim();
    if (choice === 'custom' && !/^https?:\/\/.+/i.test(customUrl)) {
      status.textContent = 'Enter a valid http(s) URL.';
      return;
    }

    const urls = getTargets(choice, customUrl);
    const target = window.open('about:blank', '_blank');
    if (!target) {
      status.textContent = 'Popup blocked. Allow popups and try again.';
      return;
    }
    target.document.title = 'Opening SuperUser';
    target.document.body.textContent = 'Checking SuperUser mirrors...';

    const errors = [];
    for (const url of urls) {
      status.textContent = `Checking ${url}...`;
      try {
        const workingUrl = await checkMirror(url);
        status.textContent = `Opening ${workingUrl}`;
        target.location.replace(workingUrl);
        return;
      } catch (error) {
        errors.push(`${url}: ${error.message}`);
      }
    }

    status.textContent = `No mirror responded. Use a reachable hosted server or enter a custom URL. ${errors.join('; ')}`;
    target.document.title = 'SuperUser unavailable';
    target.document.body.textContent =
      'SuperUser could not reach a hosted mirror. Return to the launcher and choose a working custom server.';
  });
})();
