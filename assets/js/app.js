/* ═══════════════════════════════════════════════════════
     0. LIVE SYSTEM & ERROR LOGGING ENGINE
  ═══════════════════════════════════════════════════════ */
  function addLog(msg, type = 'info') {
    const row = document.createElement('div');
    row.className = 'log-row';

    const ts = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });
    const tagClass = type === 'err' ? 'err' : type === 'ok' ? 'ok' : type === 'warn' ? 'warn' : 'info';
    const tagText = type === 'err' ? 'ERR' : type === 'ok' ? 'OK' : type === 'warn' ? 'WARN' : 'INFO';

    row.innerHTML = `
      <span class="log-ts">[${ts}]</span>
      <span class="log-tag ${tagClass}">[${tagText}]</span>
      <span class="log-msg">${escapeHtml(msg)}</span>
    `;

    row.dataset.searchable = msg;
    const pageLogList = document.getElementById('pageLogList');
    pageLogList?.appendChild(row);
    if (pageLogList) pageLogList.scrollTop = pageLogList.scrollHeight;
  }

  document.getElementById('pageClearLogsBtn').addEventListener('click', () => {
    document.getElementById('pageLogList').innerHTML = '';
    addLog('Logs cleared', 'info');
  });

  // Global browser error listeners
  window.addEventListener('error', (e) => {
    addLog(`${e.message} at ${e.filename || 'unknown'}:${e.lineno || 0}`, 'err');
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason ? (e.reason.message || e.reason) : 'Unknown Promise Rejection';
    addLog(`Unhandled Promise: ${reason}`, 'err');
  });

  /* ═══════════════════════════════════════════════════════
     1. CINEMATIC TYPEWRITER + BUMP + RIPPLE INTRO
  ═══════════════════════════════════════════════════════ */
  const introOverlay = document.getElementById('introOverlay');
  const introPrompt  = document.getElementById('introPrompt');
  const introWord    = document.getElementById('introWord');
  const introCursor  = document.getElementById('introCursor');
  const rippleCanvas = document.getElementById('rippleCanvas');
  const rippleCtx    = rippleCanvas.getContext('2d');

  let introSkipped = false;
  const WORD_CHARS = [
    { c: 'S', green: true },
    { c: 'u', green: false },
    { c: 'p', green: false },
    { c: 'e', green: false },
    { c: 'r', green: false },
    { c: 'U', green: true },
    { c: 's', green: false },
    { c: 'e', green: false },
    { c: 'r', green: false }
  ];

  function resizeCanvas() {
    rippleCanvas.width = window.innerWidth;
    rippleCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  let ripples = [];
  function triggerRipple(x, y) {
    ripples.push({
      x,
      y,
      radius: 4,
      maxRadius: Math.hypot(window.innerWidth, window.innerHeight) * 1.1,
      speed: 26,
      alpha: 1.0,
      lineWidth: 16
    });

    function draw() {
      rippleCtx.clearRect(0, 0, rippleCanvas.width, rippleCanvas.height);
      let running = false;

      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i];
        if (r.alpha > 0.01) {
          running = true;
          rippleCtx.save();
          rippleCtx.beginPath();
          rippleCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          rippleCtx.strokeStyle = `rgba(34, 197, 94, ${r.alpha})`;
          rippleCtx.lineWidth = r.lineWidth;
          rippleCtx.shadowColor = '#22c55e';
          rippleCtx.shadowBlur = 24;
          rippleCtx.stroke();
          rippleCtx.restore();

          r.radius += r.speed;
          r.speed *= 1.02;
          r.alpha *= 0.94;
        }
      }

      if (running) {
        requestAnimationFrame(draw);
      } else {
        ripples = [];
        rippleCtx.clearRect(0, 0, rippleCanvas.width, rippleCanvas.height);
      }
    }
    draw();
  }

  function finishIntro() {
    if (introSkipped) return;
    introSkipped = true;
    introOverlay.classList.add('hidden');
    // Auto-launch in about:blank the first time the intro plays
    if (!sessionStorage.getItem('su_blanked')) {
      sessionStorage.setItem('su_blanked', '1');
      setTimeout(() => launchInAboutBlank(), 150);
    }
    setTimeout(() => {
      document.getElementById('cmdTextarea')?.focus();
    }, 400);
  }

  introOverlay.addEventListener('click', finishIntro);
  window.addEventListener('keydown', (e) => {
    if (!introSkipped && !introOverlay.classList.contains('hidden')) {
      finishIntro();
    }
  });

  async function playIntro() {
    introSkipped = false;
    introOverlay.classList.remove('hidden');
    introWord.innerHTML = '';
    introPrompt.className = 'intro-prompt';
    introCursor.style.display = 'inline-block';

    const els = WORD_CHARS.map(item => {
      const span = document.createElement('span');
      span.className = 'intro-char' + (item.green ? ' green' : '');
      span.textContent = item.c;
      introWord.appendChild(span);
      return span;
    });

    await sleep(350);
    if (introSkipped) return;

    // Typewriter
    for (let el of els) {
      if (introSkipped) return;
      el.classList.add('typed');
      await sleep(80);
    }

    await sleep(200);
    if (introSkipped) return;
    introCursor.style.display = 'none';

    // Bump
    introPrompt.classList.add('bump-windup');
    await sleep(220);
    if (introSkipped) return;

    introPrompt.classList.add('bump-strike');
    introWord.classList.add('recoil');

    const rect = introPrompt.getBoundingClientRect();
    triggerRipple(rect.right, rect.top + rect.height / 2);

    await sleep(150);
    introWord.classList.remove('recoil');

    await sleep(350);
    finishIntro();
  }

  /* ═══════════════════════════════════════════════════════
     2. SCRAMJET CONTROLLER & WISP PROXY ENGINE
  ═══════════════════════════════════════════════════════ */
  const { Controller } = $scramjetController || {};
  const { defaultConfig } = $scramjet || {};
  const EpoxyTransport = (self.EpoxyTransport && self.EpoxyTransport.default) || self.EpoxyTransport;

  const browserFrames   = document.getElementById('browserFrames');
  const frameArea       = document.getElementById('frameArea');
  const browserErrorScreen = document.getElementById('browserErrorScreen');
  const homeScreen      = document.getElementById('homeScreen');
  const topUrlBar       = document.getElementById('topUrlBar');
  const topUrlInput     = document.getElementById('topUrlInput');
  const frameLoader     = document.getElementById('frameLoader');
  const frameLoaderMsg   = document.getElementById('frameLoaderMsg');
  const learningScreen   = document.getElementById('learningScreen');
  const SCRAMJET_PREFIX  = 'eduapi/';
  const SETTINGS_KEY     = 'superuser-settings';
  const OFFICIAL_WISP_URL = 'wss://symbolic-jocelyne-jxo-prod-c0e42749.apps.mistral.run/';
  const TABS_KEY         = 'superuser-tabs';
  const EXTENSIONS_KEY   = 'superuser-extensions';
  const GAMEPAD_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4m-2-2v4"/><line x1="15" y1="11" x2="15.01" y2="11"/><line x1="18" y1="13" x2="18.01" y2="13"/></svg>';
  const SHORTCUTS_KEY    = 'superuser-shortcuts';
  const DEFAULT_SHORTCUTS = [
    { title: 'Google', url: 'https://www.google.com', domain: 'google.com' },
    { title: 'YouTube', url: 'https://www.youtube.com', domain: 'youtube.com' },
    { title: 'Discord', url: 'https://discord.com/app', domain: 'discord.com' },
    { title: 'ChatGPT', url: 'https://chatgpt.com', domain: 'chatgpt.com' },
    { title: 'Games', url: 'su://games', svg: GAMEPAD_SVG },
    { title: 'Soundboard', url: 'https://www.soundboard.com/' },
    { title: 'Extensions', url: 'su://extensions', icon: '🧩' }
  ];
  const defaultSettings  = {
    wisp: OFFICIAL_WISP_URL,
    wispVersion: 'auto',
    searchProvider: 'startpage',
    adBlock: true
  };
  let settings = { ...defaultSettings };
  try { settings = { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (_) {}
  if ('background' in settings) {
    delete settings.background;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  if (settings.wispVersion === 1 || settings.wispVersion === 2 ||
      settings.wispVersion === '1' || settings.wispVersion === '2') {
    settings.wispVersion = 'auto';
  }
  if (!localStorage.getItem('superuser-wisp-official-default-v1')) {
    if (settings.wisp === 'local' || settings.wisp === 'homework-relay') {
      settings.wisp = OFFICIAL_WISP_URL;
    }
    localStorage.setItem('superuser-wisp-official-default-v1', 'true');
  }
  if (!localStorage.getItem('superuser-default-search-startpage-v1')) {
    if (!localStorage.getItem(SETTINGS_KEY) || settings.searchProvider === 'duckduckgo') {
      settings.searchProvider = 'startpage';
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    localStorage.setItem('superuser-default-search-startpage-v1', 'true');
  }
  let extensionCatalog = [];
  let enabledExtensions = {};
  let visibleShortcuts = DEFAULT_SHORTCUTS;
  try { enabledExtensions = JSON.parse(localStorage.getItem(EXTENSIONS_KEY) || '{}'); } catch (_) {}
  // YouTube ad-blocker enabled by default
  if (!('youtube.com' in enabledExtensions)) enabledExtensions['youtube.com'] = true;
  try {
    const savedShortcuts = JSON.parse(localStorage.getItem(SHORTCUTS_KEY) || 'null');
    if (Array.isArray(savedShortcuts)) {
      visibleShortcuts = savedShortcuts.filter(shortcut =>
        shortcut && typeof shortcut.title === 'string' && typeof shortcut.url === 'string');
    }
  } catch (_) {}
  if (!localStorage.getItem('superuser-games-shortcut-v1')) {
    const gamesShortcut = DEFAULT_SHORTCUTS.find(shortcut => shortcut.title === 'Games');
    if (gamesShortcut && !visibleShortcuts.some(shortcut => shortcut.title === gamesShortcut.title)) {
      visibleShortcuts = [...visibleShortcuts, gamesShortcut];
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(visibleShortcuts));
    }
    localStorage.setItem('superuser-games-shortcut-v1', 'true');
  }
  if (!localStorage.getItem('superuser-shortcuts-v2')) {
    for (const title of ['Soundboard', 'Extensions']) {
      const shortcut = DEFAULT_SHORTCUTS.find(item => item.title === title);
      if (shortcut && !visibleShortcuts.some(item => item.title === title)) {
        visibleShortcuts = [...visibleShortcuts, shortcut];
      }
    }
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(visibleShortcuts));
    localStorage.setItem('superuser-shortcuts-v2', 'true');
  }
  if (!localStorage.getItem('superuser-soundboard-destination-v1')) {
    const soundboard = DEFAULT_SHORTCUTS.find(item => item.title === 'Soundboard');
    let updated = false;
    visibleShortcuts = visibleShortcuts.map(shortcut => {
      if (shortcut.title !== 'Soundboard' || shortcut.url !== 'https://www.myinstants.com/') return shortcut;
      updated = true;
      return soundboard;
    });
    if (updated) localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(visibleShortcuts));
    localStorage.setItem('superuser-soundboard-destination-v1', 'true');
  }

  const AD_HOSTS = /(^|\.)((doubleclick|googlesyndication|googleadservices|adnxs|adsrvr|advertising|imasdk|adform|criteo|taboola|outbrain|scorecardresearch)\.)/i;
  const searchUrls = {
    duckduckgo: query => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    google: query => `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`,
    bing: query => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    startpage: query => `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}`,
    youtube: query => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
  };
  const searchProviders = [
    { id: 'startpage', name: 'Startpage', icon: 'S' },
    { id: 'duckduckgo', name: 'DuckDuckGo', icon: 'D' },
    { id: 'google', name: 'Google', icon: 'G' },
    { id: 'bing', name: 'Bing', icon: 'b' },
    { id: 'youtube', name: 'YouTube', icon: '▶' }
  ];

  function renderSearchProviderMenu() {
    const select = document.getElementById('topSearchProvider');
    const button = document.getElementById('searchProviderButton');
    const menu = document.getElementById('searchProviderMenu');
    if (!select || !button || !menu) return;
    if (!searchProviders.some(provider => provider.id === select.value)) {
      select.value = 'startpage';
    }
    const selected = searchProviders.find(provider => provider.id === select.value);
    button.textContent = selected.icon;
    button.title = selected.name;
    button.setAttribute('aria-label', `Search provider: ${selected.name}`);
    menu.innerHTML = searchProviders.map(provider => `
      <button class="search-provider-option" type="button" role="option"
        aria-checked="${provider.id === select.value}" data-search-provider="${provider.id}">
        <span class="search-provider-icon" aria-hidden="true">${provider.icon}</span>
        <span>${provider.name}</span>
      </button>`).join('');
    menu.querySelectorAll('[data-search-provider]').forEach(option => {
      option.addEventListener('click', () => {
        select.value = option.dataset.searchProvider;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        renderSearchProviderMenu();
      });
    });
  }

  let scramjet = null;
  let activeTransport = null;
  let sjFrame  = null;
  let isProxyReady = false;
  let allowApplicationUnload = false;
  let serverPolymorphismSupported = false;
  let polymorphismHandshakePromise = null;

  async function verifyServerPolymorphismSupport(wispEndpoint) {
    if (!polymorphismHandshakePromise) {
      polymorphismHandshakePromise = import(appPath('client/polymorphic-handshake.js'))
        .then(module => module.verifyServerPolymorphismSupport)
        .catch(() => () => Promise.resolve(false));
    }
    const verify = await polymorphismHandshakePromise;
    return verify(wispEndpoint);
  }

  /* Polymorphic Scramjet URL codec.  Each encoding uses a fresh nonce and
     one of four reversible representations, while preserving Scramjet URL
     routing and allowing the codec to work in frames and workers. */
  function polymorphicScramjetEncode(value) {
    if (!value || typeof value !== 'string') return value || '';
    try {
      const bytes = new TextEncoder().encode(value);
      const nonceBytes = new Uint8Array(8);
      if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(nonceBytes);
      } else {
        for (let i = 0; i < nonceBytes.length; i++) {
          nonceBytes[i] = Math.floor(Math.random() * 256);
        }
      }
      let nonceHex = '';
      for (const byte of nonceBytes) nonceHex += byte.toString(16).padStart(2, '0');
      const variant = nonceBytes[0] & 3;
      const transformed = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        const nonceByte = nonceBytes[i % nonceBytes.length];
        transformed[i] = bytes[i] ^ nonceByte ^ ((i * 29 + variant * 17) & 255);
      }
      let payload;
      if (variant === 0) {
        payload = btoa(String.fromCharCode(...transformed))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } else if (variant === 1) {
        payload = Array.from(transformed, byte => byte.toString(16).padStart(2, '0')).join('');
      } else if (variant === 2) {
        const raw = btoa(String.fromCharCode(...transformed))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        payload = raw.split('').reverse().join('');
      } else {
        payload = Array.from(transformed, byte => byte.toString(16).padStart(2, '0'))
          .join('').split('').reverse().join('');
      }
      return `sx${variant}.${nonceHex}.${payload}`;
    } catch (_) {
      return value;
    }
  }

  function polymorphicScramjetDecode(value) {
    if (!value || typeof value !== 'string') return value || '';
    if (!/^sx[0-3]\.[0-9a-f]{16}\./.test(value)) return value;
    try {
      const match = /^sx([0-3])\.([0-9a-f]{16})\.(.*)$/.exec(value);
      if (!match) return value;
      const variant = Number(match[1]);
      const nonceHex = match[2];
      let payload = match[3];
      const nonceBytes = new Uint8Array(8);
      for (let i = 0; i < nonceBytes.length; i++) {
        nonceBytes[i] = parseInt(nonceHex.slice(i * 2, i * 2 + 2), 16);
      }
      let transformed;
      if (variant === 0) {
        const raw = atob(payload.replace(/-/g, '+').replace(/_/g, '/') +
          '='.repeat((4 - payload.length % 4) % 4));
        transformed = Uint8Array.from(raw, character => character.charCodeAt(0));
      } else if (variant === 1) {
        if (!/^(?:[0-9a-f]{2})+$/.test(payload)) return value;
        transformed = new Uint8Array(payload.length / 2);
        for (let i = 0; i < transformed.length; i++) {
          transformed[i] = parseInt(payload.slice(i * 2, i * 2 + 2), 16);
        }
      } else if (variant === 2) {
        payload = payload.split('').reverse().join('');
        const raw = atob(payload.replace(/-/g, '+').replace(/_/g, '/') +
          '='.repeat((4 - payload.length % 4) % 4));
        transformed = Uint8Array.from(raw, character => character.charCodeAt(0));
      } else {
        payload = payload.split('').reverse().join('');
        if (!/^(?:[0-9a-f]{2})+$/.test(payload)) return value;
        transformed = new Uint8Array(payload.length / 2);
        for (let i = 0; i < transformed.length; i++) {
          transformed[i] = parseInt(payload.slice(i * 2, i * 2 + 2), 16);
        }
      }
      const decoded = new Uint8Array(transformed.length);
      for (let i = 0; i < transformed.length; i++) {
        const nonceByte = nonceBytes[i % nonceBytes.length];
        decoded[i] = transformed[i] ^ nonceByte ^ ((i * 29 + variant * 17) & 255);
      }
      return new TextDecoder().decode(decoded);
    } catch (_) {
      return value;
    }
  }

  const WISP_STORAGE_KEY = 'superuser_wisp_working';

  /* ═══════════════════════════════════════════════════════
     WISP TRANSPORT — optimized, Chrome-mimic, 429-resilient
  ═══════════════════════════════════════════════════════ */

  // Opium IC header order (Chrome navigation fingerprint)
  const CHROME_HEADER_ORDER = [
    'sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform',
    'upgrade-insecure-requests','user-agent','accept','origin',
    'sec-fetch-site','sec-fetch-mode','sec-fetch-user','sec-fetch-dest',
    'referer','accept-encoding','accept-language','priority',
    'content-type','content-length','cookie'
  ];
  // Opium BC — strip expensive client-hint headers to reduce fingerprint surface
  const STRIP_HEADERS = new Set([
    'sec-ch-ua-arch','sec-ch-ua-bitness','sec-ch-ua-full-version',
    'sec-ch-ua-full-version-list','sec-ch-ua-model',
    'sec-ch-ua-platform-version','sec-ch-ua-wow64','sec-ch-ua-form-factors'
  ]);

  // Normalize + reorder headers the same way Opium's QC() does
  function mimicChromeHeaders(headers = {}, method = 'GET', referrer = '', mode = 'navigate') {
    const h = {};
    for (const [k, v] of Object.entries(headers)) {
      if (!STRIP_HEADERS.has(k.toLowerCase())) h[k.toLowerCase()] = v;
    }
    h['user-agent'] ||= navigator.userAgent;
    h['accept-encoding'] ||= 'gzip, deflate, br';
    h['accept-language'] ||= 'en-US,en;q=0.9';
    h['priority'] ||= 'u=0, i';
    if (referrer) h['referer'] = referrer;
    if (mode === 'navigate') {
      h['sec-fetch-site'] ||= 'none';
      h['sec-fetch-dest'] ||= 'document';
      h['sec-fetch-user'] ||= '?1';
      if (method === 'GET') delete h['origin'];
    } else {
      h['sec-fetch-site'] ||= 'same-origin';
      h['sec-fetch-dest'] ||= 'empty';
    }
    // Re-emit in IC order, then any extras not in the list
    const ordered = {};
    for (const k of CHROME_HEADER_ORDER) { if (k in h) ordered[k] = h[k]; }
    for (const k of Object.keys(h)) { if (!(k in ordered)) ordered[k] = h[k]; }
    return ordered;
  }

  function getWispUrl() {
    const savedUrl = localStorage.getItem(WISP_STORAGE_KEY);
    if (savedUrl) return savedUrl;
    return settings.wisp && !['auto', 'local'].includes(settings.wisp)
      ? settings.wisp
      : OFFICIAL_WISP_URL;
  }

  function renderWispServer(url = getWispUrl()) {
    for (const id of ['wispCurrentPage', 'wispCurrentModal']) {
      const element = document.getElementById(id);
      if (element) element.textContent = url;
    }
  }

  function getWispVersions() {
    const preferred = settings.wispVersion === 'v1' ? 1 : 2;
    return [preferred, preferred === 2 ? 1 : 2];
  }

  // Probe transport — returns status code, throws on error/429
  async function probeTransport(transport) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const probeHeaders = mimicChromeHeaders({
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'sec-fetch-mode': 'navigate'
      }, 'GET', '', 'navigate');
      const response = await transport.request(
        new URL('https://example.com/'),
        'GET',
        null,
        Object.entries(probeHeaders),
        controller.signal
      );
      if (response.body && typeof response.body.cancel === 'function') {
        await response.body.cancel();
      }
      return response.status;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Attempt one Wisp protocol and verify it with a proxied request.
  async function attemptConnectWisp(wispUrl, version, timeoutMs = 3500) {
    if (!EpoxyTransport) return null;
    const timer = { id: null };
    const timeoutPromise = new Promise((_, reject) => {
      timer.id = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    try {
      const transport = new EpoxyTransport({
        wisp: wispUrl,
        wisp_v2: version === 2,
        wisp_ws_protocols: version === 2 ? ['wisp-v2'] : [],
        // Minimal WS — arraybuffer reduces GC pressure vs Blob
        ws_binaryType: 'arraybuffer'
      });
      await Promise.race([transport.init(), timeoutPromise]);
      const status = await Promise.race([probeTransport(transport), timeoutPromise]);
      clearTimeout(timer.id);
      // 429 = rate-limited but server is alive — treat as reachable with penalty flag
      if (status === 429) return { transport, url: wispUrl, version, rateLimited: true };
      if (status >= 200 && status < 400) return { transport, url: wispUrl, version, rateLimited: false };
      clearTimeout(timer.id);
      return null;
    } catch (_) {
      clearTimeout(timer.id);
      return null;
    }
  }

  async function detectWispCapabilities(wispUrl, timeoutMs = 3500) {
    const results = await Promise.all(
      getWispVersions().map(version => attemptConnectWisp(wispUrl, version, timeoutMs))
    );
    const supported = results.filter(Boolean);
    if (supported.length === 0) return null;
    const selected = supported.find(result => !result.rateLimited) || supported[0];
    return {
      ...selected,
      versions: supported.map(result => result.version).sort((a, b) => b - a),
      rateLimited: supported.every(result => result.rateLimited)
    };
  }

  function formatWispVersions(versions) {
    return versions.map(version => `v${version}`).join(' + ');
  }

  async function discoverAndConnectWisp() {
    // 1. Try last-good saved server (like Opium's WID cache)
    const savedUrl = localStorage.getItem(WISP_STORAGE_KEY) ||
      (settings.wisp && !['local','auto'].includes(settings.wisp) ? settings.wisp : null);

    if (savedUrl?.startsWith('ws')) {
      addLog(`Testing saved Wisp: ${savedUrl}`, 'info');
      const result = await detectWispCapabilities(savedUrl, 4000);
      if (result && !result.rateLimited) {
        addLog(`Verified saved Wisp (${formatWispVersions(result.versions)}): ${savedUrl}`, 'ok');
        renderWispServer(savedUrl);
        return result;
      }
      if (result?.rateLimited) {
        addLog(`Saved Wisp rate-limited (429), retrying pool...`, 'warn');
      } else {
        addLog(`Saved Wisp failed, running discovery...`, 'warn');
      }
      localStorage.removeItem(WISP_STORAGE_KEY);
    }

    // 2. Show "Finding Wisp Server" screen
    const screen    = document.getElementById('wispFindingScreen');
    const counterEl = document.getElementById('wispFindingCounter');
    const serverEl  = document.getElementById('wispFindingServer');
    const barEl     = document.getElementById('wispFindingBar');
    const retryBtn  = document.getElementById('wispRetryBtn');

    const ui = (counter, server, barPct) => {
      if (counterEl) counterEl.textContent = counter;
      if (serverEl)  serverEl.textContent  = server;
      if (barEl)     barEl.style.width     = `${barPct}%`;
    };

    if (screen) {
      screen.classList.remove('hidden');
      retryBtn?.classList.add('hidden');
      ui('Loading server catalog...', 'Reading assets/backend/wisps.json...', 3);
    }

    try {
      // 3. Read wisps.json catalog
      let catalog = [];
      try {
        const res = await fetch(appPath('assets/backend/wisps.json'), { cache: 'no-store' });
        catalog = await res.json();
      } catch (err) {
        addLog(`Failed to fetch wisps.json: ${err.message}`, 'warn');
      }

      // 4. Build ordered server list (last-good index first, like Opium's WID)
      const allServers = [];
      const savedIdx = parseInt(localStorage.getItem('su_wid') || '-1', 10);

      if (Array.isArray(catalog) && catalog.length > 0) {
        for (const entry of catalog) {
          const cleanPath = (entry.path || '').replace(/^\/+/, '');
          try {
            const r = await fetch(appPath('assets/backend/' + cleanPath), { cache: 'no-store' });
            const urls = await r.json();
            if (Array.isArray(urls)) {
              for (const u of urls) {
                if (typeof u === 'string' && u.startsWith('ws')) {
                  allServers.push({ group: entry.name || 'Wisp', url: u });
                }
              }
            }
          } catch (e) {
            addLog(`Could not load ${entry.name}: ${e.message}`, 'warn');
          }
        }
      }

      if (allServers.length === 0) {
        allServers.push(
          { group: 'Official', url: 'wss://superuser-wisp.wasmer.app/' },
          { group: 'Official', url: 'wss://symbolic-jocelyne-jxo-prod-c0e42749.apps.mistral.run/' },
          { group: 'Opium',    url: 'wss://cdn.northstreetumc.org/' }
        );
      }

      // Bubble last-good index to front (Opium WID strategy)
      if (savedIdx >= 0 && savedIdx < allServers.length) {
        allServers.unshift(allServers.splice(savedIdx, 1)[0]);
      }

      const total = allServers.length;
      addLog(`Probing ${total} Wisp servers...`, 'info');

      let rateLimitedResult = null; // best fallback if everything is 429

      for (let i = 0; i < total; i++) {
        const item = allServers[i];
        ui(`Checking ${i + 1}/${total}`, `${item.group}: ${item.url}`, Math.round(((i + 1) / total) * 95));
        addLog(`[${i + 1}/${total}] ${item.url}`, 'info');

        const result = await detectWispCapabilities(item.url, 3500);
        const capabilities = result
          ? `supports ${formatWispVersions(result.versions)}`
          : 'no verified proxy response for Wisp v1 or v2';
        ui(
          `Checked ${i + 1}/${total}`,
          `${item.group}: ${item.url} — ${capabilities}`,
          Math.round(((i + 1) / total) * 95)
        );
        if (!result) continue;

        if (result.rateLimited) {
          addLog(`${item.url} (${formatWispVersions(result.versions)}) → 429 rate-limited, continuing...`, 'warn');
          rateLimitedResult = rateLimitedResult || { result, item, idx: i };
          continue; // try next server
        }

        // ✅ Clean connection
        const realIdx = allServers.indexOf(item);
        localStorage.setItem(WISP_STORAGE_KEY, item.url);
        localStorage.setItem('su_wid', String(realIdx));
        settings.wisp = item.url;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
        renderWispServer(item.url);

        ui(
          `Connected! (${i + 1}/${total})`,
          `Selected ${item.group}: ${item.url} — supports ${formatWispVersions(result.versions)}; using v${result.version}`,
          100
        );
        addLog(`Connected to ${item.url} using Wisp v${result.version} (supports ${formatWispVersions(result.versions)})`, 'ok');
        await sleep(300);
        screen?.classList.add('hidden');
        return result;
      }

      // All servers returned 429 — keep retrying with backoff, don't give up
      if (rateLimitedResult) {
        const { result, item } = rateLimitedResult;
        let attempt = 0;
        while (true) {
          attempt++;
          const delay = Math.min(1000 * attempt, 8000);
          ui(
            `All servers rate-limited (429) — retrying in ${Math.round(delay / 1000)}s...`,
            `Waiting to retry ${item.url}`,
            95
          );
          addLog(`429 backoff attempt ${attempt} — waiting ${delay}ms`, 'warn');
          await sleep(delay);

          // Re-probe all servers on each backoff pass
          for (let i = 0; i < allServers.length; i++) {
            const s = allServers[i];
            ui(`Retry ${attempt} — checking ${i + 1}/${total}`, `${s.group}: ${s.url}`, 95);
            const r = await detectWispCapabilities(s.url, 3500);
            ui(
              `Retry ${attempt} — checked ${i + 1}/${total}`,
              `${s.group}: ${s.url} — ${r ? `supports ${formatWispVersions(r.versions)}` : 'no verified proxy response for Wisp v1 or v2'}`,
              95
            );
            if (r && !r.rateLimited) {
              localStorage.setItem(WISP_STORAGE_KEY, s.url);
              localStorage.setItem('su_wid', String(i));
              settings.wisp = s.url;
              try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
              renderWispServer(s.url);
              ui(
                'Connected!',
                `Selected ${s.group}: ${s.url} — supports ${formatWispVersions(r.versions)}; using v${r.version}`,
                100
              );
              addLog(`Connected after ${attempt} retry attempt(s): ${s.url} using Wisp v${r.version} (supports ${formatWispVersions(r.versions)})`, 'ok');
              await sleep(300);
              screen?.classList.add('hidden');
              return r;
            }
          }
        }
      }

      ui('All servers unreachable', 'No working Wisp server found.', 100);
      renderWispServer('No Wisp server connected');
      if (retryBtn) {
        retryBtn.classList.remove('hidden');
        retryBtn.onclick = () => discoverAndConnectWisp();
      }
      return null;

    } catch (e) {
      if (serverEl) serverEl.textContent = `Discovery error: ${e.message}`;
      renderWispServer('Wisp discovery failed');
      if (retryBtn) {
        retryBtn.classList.remove('hidden');
        retryBtn.onclick = () => discoverAndConnectWisp();
      }
      return null;
    }
  }

  async function initScramjetProxy() {
    isProxyReady = false;
    try {
      addLog('Registering service worker (/sw.js)...', 'info');

      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers are not supported in this browser.');
      }

      const swUrl = new URL(`${appPath('sw.js')}?v=12-polymorphic`, location.href).href;
      const reg = await navigator.serviceWorker.register(swUrl, {
        scope: APP_BASE,
        updateViaCache: 'none'
      });
      addLog(`Service worker registered (scope: ${reg.scope})`, 'ok');

      await navigator.serviceWorker.ready;

      if (navigator.serviceWorker.controller?.scriptURL !== swUrl) {
        await new Promise(resolve => {
          const onControllerChange = () => {
            if (navigator.serviceWorker.controller?.scriptURL === swUrl) {
              clearTimeout(timeout);
              navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
              resolve();
            }
          };
          const timeout = setTimeout(() => {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            resolve();
          }, 3000);
          navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
          onControllerChange();
        });
      }

      if (navigator.serviceWorker.controller?.scriptURL !== swUrl) {
        addLog('Reloading to activate the updated service worker...', 'warn');
        allowApplicationUnload = true;
        location.reload();
        return false;
      }

      const sw = navigator.serviceWorker.controller;
      addLog('Service worker controller active and verified', 'ok');

      // Auto-discover and connect working Wisp transport
      const wispResult = await discoverAndConnectWisp();
      if (!wispResult || !wispResult.transport) {
        throw new Error('Could not connect to any Wisp server.');
      }

      const transport = wispResult.transport;
      activeTransport = transport;
      const wispUrl = wispResult.url;
      serverPolymorphismSupported =
        await verifyServerPolymorphismSupport(wispUrl);
      addLog(
        serverPolymorphismSupported
          ? 'Server polymorphism capability confirmed'
          : 'Server polymorphism unavailable; using client-only mode',
        serverPolymorphismSupported ? 'ok' : 'info'
      );

      if (scramjet) {
        scramjet.setTransport(transport);
      } else {
        addLog('Initializing Scramjet controller & WASM...', 'info');
        scramjet = new Controller({
          serviceworker: sw,
          transport,
          config: {
            ...$scramjetController.config,
            prefix: appPath(SCRAMJET_PREFIX),
            scramjetPath: appPath('scramjet/scramjet.js'),
            injectPath: appPath('controller/controller.inject.js'),
            wasmPath: appPath('scramjet/scramjet.wasm'),
            codec: {
              encode: polymorphicScramjetEncode,
              decode: polymorphicScramjetDecode
            }
          },
          scramjetConfig: {
            ...defaultConfig,
            flags: {
              ...defaultConfig.flags,
              allowFailedIntercepts: true,
              encapsulateWorkers: false,
              destructureRewrites: true,
              allowInvalidJs: true
            },
            siteFlags: {
              'youtube.com': { allowFailedIntercepts: true, encapsulateWorkers: false },
              'www.youtube.com': { allowFailedIntercepts: true, encapsulateWorkers: false },
              'm.youtube.com': { allowFailedIntercepts: true, encapsulateWorkers: false },
              'googlevideo.com': { allowFailedIntercepts: true, encapsulateWorkers: false }
            }
          }
        });
        await scramjet.wait();
        addLog('Scramjet controller ready and synchronized', 'ok');
      }

      isProxyReady = true;
      applyEnglishPreferences();
      renderWispServer(wispUrl);
      settings.wisp = wispUrl;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      updateSystemStatus();

      // Drain queued navigations requested before proxy finished initializing
      if (pendingProxyNavigations.length > 0) {
        const queued = [...pendingProxyNavigations];
        pendingProxyNavigations = [];
        for (const item of queued) {
          const t = tabs.find(tab => tab.id === item.tabId);
          if (t) {
            t.url = item.url;
            if (t.id === activeTabId) {
              loadUrlInFrame(item.url, item.shouldNavigate);
            }
          }
        }
      }

      showToast('Proxy ready — type sudo for commands');
      addLog('SuperUser Proxy is online and ready for traffic', 'ok');
      return true;
    } catch (err) {
      console.error(err);
      addLog(`Wisp/proxy connection failed: ${err.message}`, 'err');
      showToast('Proxy Error: ' + err.message, true);
      return false;
    }
  }

  // Test Proxy Diagnostics
  document.getElementById('pageTestProxyBtn').addEventListener('click', async () => {
    addLog('--- RUNNING PROXY DIAGNOSTICS ---', 'info');
    addLog(`SW Support: ${'serviceWorker' in navigator}`, 'info');
    addLog(`SW Controller: ${navigator.serviceWorker.controller ? 'Active' : 'NULL (Reload Required)'}`, navigator.serviceWorker.controller ? 'ok' : 'err');
    addLog(`Wisp Endpoint: ${getWispUrl()}`, 'info');
    addLog(`Scramjet Controller: ${scramjet ? 'Initialized' : 'Not Ready'}`, scramjet ? 'ok' : 'warn');
    addLog(`Iframe Binding: ${sjFrame ? 'Bound' : 'Unbound'}`, sjFrame ? 'ok' : 'warn');

    try {
      const resp = await fetch(appPath('health'));
      const data = await resp.json();
      addLog(`Backend /health: ${JSON.stringify(data)}`, 'ok');
    } catch (e) {
      addLog(`Backend /health error: ${e.message}`, 'err');
    }
    if (activeTransport) {
      try {
        const status = await probeTransport(activeTransport);
        addLog(`Selected Wisp tunnel passed proxied HTTPS test (HTTP ${status})`, 'ok');
      } catch (error) {
        addLog(`Selected Wisp tunnel test failed: ${error.message}`, 'err');
      }
    } else {
      addLog('Selected Wisp tunnel is not initialized', 'err');
    }
  });

  /* ═══════════════════════════════════════════════════════
     3. TAB MANAGEMENT SYSTEM
  ═══════════════════════════════════════════════════════ */
  let tabs = [];
  let activeTabId = null;
  let tabCounter = 0;

  const tabList = document.getElementById('tabList');

  function createTab(url = 'home') {
    const id = ++tabCounter;
    const isHome = url === 'home';
    const tab = {
      id,
      url,
      title: isHome ? 'New Tab' : getHost(url),
      favicon: '',
      frame: null,
      sjFrame: null,
      active: false
    };
    tabs.push(tab);
    switchTab(id);
    renderTabs();
    saveTabs();
    addLog(`Created tab #${id} (${tab.title})`, 'info');
  }

  function switchTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    activeTabId = id;
    tabs.forEach(t => t.active = t.id === id);
    renderTabs();
    saveTabs();

    if (tab.url === 'home') {
      showHomeScreen();
    } else {
      loadUrlInFrame(tab.url, false);
    }
  }

  function saveTabs() {
    localStorage.setItem(TABS_KEY, JSON.stringify({
      activeTabId,
      tabs: tabs.map(tab => ({
        id: tab.id, url: tab.url, title: tab.title, favicon: tab.favicon
      }))
    }));
  }

  function migrateInternalGameUrl(url) {
    try {
      const gamesPath = new URL(appPath('internals/games/'), location.href).pathname;
      const proxyPath = new URL(appPath('~/sj/'), location.href).pathname;
      let candidate = url;
      for (let attempt = 0; attempt < 5; attempt++) {
        const currentUrl = new URL(candidate, location.href);
        if (currentUrl.origin === location.origin && currentUrl.pathname.startsWith(gamesPath)) {
          const path = currentUrl.pathname.slice(gamesPath.length);
          const provider = path.split('/')[0];
          if (!provider || provider === 'index.html') return `su://games${currentUrl.search}`;
          if (!/^[a-z0-9_-]+$/i.test(provider)) return url;
          return `su://games/${provider}${currentUrl.search}`;
        }
        if (currentUrl.origin !== location.origin || !currentUrl.pathname.startsWith(proxyPath)) return candidate;
        const segments = currentUrl.pathname.slice(proxyPath.length).split('/').reverse();
        const target = segments.map(segment => {
          try { return decodeURIComponent(segment); } catch (_) { return ''; }
        }).find(segment => /^https?:\/\//i.test(segment));
        if (!target) return candidate;
        candidate = target;
      }
      return candidate;
    } catch (_) {
      return url;
    }
  }

  function restoreTabs() {
    try {
      const saved = JSON.parse(localStorage.getItem(TABS_KEY) || 'null');
      if (!saved?.tabs?.length) return false;
      const restored = saved.tabs.map(savedTab => ({
        ...savedTab,
        url: migrateInternalGameUrl(savedTab.url)
      }));
      const uniqueTabs = restored.filter((savedTab, index, list) =>
        list.findIndex(candidate => candidate.url === savedTab.url && candidate.title === savedTab.title) === index);
      uniqueTabs.forEach(savedTab => {
        const tab = {
          ...savedTab, frame: null, sjFrame: null, active: false
        };
        tabs.push(tab);
        tabCounter = Math.max(tabCounter, tab.id);
      });
      const target = tabs.find(tab => tab.id === saved.activeTabId) || tabs[0];
      switchTab(target.id);
      return true;
    } catch (error) {
      addLog(`Could not restore tabs: ${error.message}`, 'warn');
      return false;
    }
  }

  function renderTabs() {
    tabList.innerHTML = '';
    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'tab-item' + (tab.active ? ' active' : '');

      if (tab.favicon) {
        const favicon = document.createElement('img');
        favicon.className = 'tab-favicon';
        favicon.src = tab.favicon;
        favicon.alt = '';
        favicon.addEventListener('error', () => {
          favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(getHost(tab.url))}&sz=32`;
        }, { once: true });
        el.appendChild(favicon);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'tab-favicon-fallback';
        fallback.textContent = '◉';
        el.appendChild(fallback);
      }

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.type = 'button';
      closeBtn.textContent = '✕';
      closeBtn.title = `Close ${tab.title || 'tab'}`;
      closeBtn.setAttribute('aria-label', `Close ${tab.title || 'tab'}`);
      closeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        closeTab(tab.id);
      });

      el.appendChild(title);
      el.appendChild(closeBtn);

      el.addEventListener('click', () => switchTab(tab.id));
      tabList.appendChild(el);
    });
    filterTabs();
  }

  function filterTabs() {
    const query = document.getElementById('searchTabsInput').value.trim().toLowerCase();
    document.querySelectorAll('#tabList .tab-item').forEach(item => {
      item.hidden = Boolean(query && !item.textContent.toLowerCase().includes(query));
    });
  }

  function closeTab(id) {
    const index = tabs.findIndex(tab => tab.id === id);
    if (index === -1) return;

    const [closedTab] = tabs.splice(index, 1);
    closedTab.metadataObserver?.disconnect();
    if (closedTab.metadataTimer) clearInterval(closedTab.metadataTimer);
    if (closedTab.retry404Timer) clearTimeout(closedTab.retry404Timer);
    closedTab.frame?.remove();

    if (tabs.length === 0) {
      createTab('home');
      return;
    }

    if (activeTabId === id) {
      const nextTab = tabs[Math.min(index, tabs.length - 1)];
      switchTab(nextTab.id);
    } else {
      renderTabs();
      saveTabs();
    }
  }

  function getHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url.slice(0, 16);
    }
  }

  function getActiveTab() {
    return tabs.find(tab => tab.id === activeTabId) || null;
  }

  /* ═══════════════════════════════════════════════════════
     4. VIEW SWITCHING & URL NAVIGATION
  ═══════════════════════════════════════════════════════ */
  /* ══ TITLE CLOAK LOCK ══ */
  let isCloakedOrHidden = false;

  function setWindowTitle(title) {
    if (isCloakedOrHidden) {
      document.title = 'Super Learning';
      return;
    }
    document.title = title || 'SuperUser Proxy';
  }

  function showHomeScreen() {
    PAGE_IDS?.forEach(id => document.getElementById(`${id}Page`)?.classList.remove('active'));
    homeScreen.classList.remove('hidden');
    frameArea.classList.remove('active');
    topUrlBar.classList.remove('active'); // Top URL bar hidden on newtab
    document.querySelector('.viewport').classList.remove('browsing');
    browserErrorScreen.hidden = true;
    setWindowTitle('SuperUser Proxy');
    document.getElementById('appFavicon').href = appPath('assets/shortcuts/icons/google.png');
    document.getElementById('cmdTextarea')?.focus();
  }

  function showBrowserView() {
    PAGE_IDS?.forEach(id => document.getElementById(`${id}Page`)?.classList.remove('active'));
    homeScreen.classList.add('hidden');
    frameArea.classList.add('active');
    topUrlBar.classList.add('active'); // Top URL bar shown when browsing
    document.querySelector('.viewport').classList.add('browsing');
    browserErrorScreen.hidden = true;
  }

  function normalizeUrl(raw) {
    let u = raw.trim();
    if (!u) return '';
    if (/^su:\/\/(?:games(?:\/[a-z0-9_-]+)?|extensions|bookmarks|2fa)\/?(?:\?[^#]*)?$/i.test(u)) return u.replace(/\/(?=\?)/, '').replace(/\/$/, '');
    if (u.includes(' ') || !u.includes('.')) {
      const provider = document.getElementById('topSearchProvider')?.value ||
        settings.searchProvider || 'startpage';
      return (searchUrls[provider] || searchUrls.startpage)(u);
    }
    const url = u.startsWith('http://') || u.startsWith('https://') ? u : 'https://' + u;
    try {
      if (settings.adBlock && AD_HOSTS.test(new URL(url).hostname)) return '';
    } catch (_) {}
    return url;
  }

  // Google language switch: route through /en internally for English UI
  function getEffectiveLoadUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'google.com' || parsed.hostname === 'www.google.com') {
        if (parsed.pathname === '/' || parsed.pathname === '') {
          return `${parsed.protocol}//${parsed.hostname}/en${parsed.search}${parsed.hash}`;
        }
      }
    } catch (_) {}
    return url;
  }

  // Google display: keep clean google.com in the URL bar
  function getDisplayUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'google.com' || parsed.hostname === 'www.google.com') {
        if (parsed.pathname === '/en' || parsed.pathname === '/en/') {
          return `${parsed.protocol}//${parsed.hostname}${parsed.search}${parsed.hash}`.replace(/\/$/, '');
        }
      }
    } catch (_) {}
    return url;
  }

  function navigate(rawUrl) {
    const url = normalizeUrl(rawUrl);
    if (!url) {
      showToast('Blocked ad/tracker URL', true);
      return;
    }

    let currentTab = getActiveTab();
    if (!currentTab) {
      createTab('home');
      currentTab = getActiveTab();
    }
    if (currentTab) {
      currentTab.url = url;
      currentTab.title = url.startsWith('su://games') ? 'Games' :
        url.startsWith('su://extensions') ? 'Extensions' :
        url.startsWith('su://bookmarks') ? 'Bookmarks' :
        url.startsWith('su://2fa') ? '2FA' : getHost(url);
      currentTab.favicon = url.startsWith('su://')
        ? ''
        : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(getHost(url))}&sz=32`;
      renderTabs();
      saveTabs();
      document.title = `${currentTab.title} - SuperUser`;
      document.getElementById('appFavicon').href =
        currentTab.favicon || appPath('assets/shortcuts/icons/google.png');
    }

    loadUrlInFrame(url);
  }

  function showBrowserError(status, url) {
    if (status === 404) {
      addLog(`HTTP 404 on ${url}. Retrying...`, 'warn');
      const tab = getActiveTab();
      if (tab) {
        if (tab.id === activeTabId) {
          browserErrorScreen.hidden = true;
          frameLoader.classList.remove('hidden');
          frameLoaderMsg.textContent = 'Page returned 404. Retrying...';
        }
        if (!tab.retry404Timer) {
          tab.retry404Count = (tab.retry404Count || 0) + 1;
          tab.retry404Timer = setTimeout(() => {
            tab.retry404Timer = null;
            addLog(`Retrying ${url} (404 recovery attempt ${tab.retry404Count})...`, 'info');
            try {
              tab.navigationPending = true;
              if (tab.sjFrame) tab.sjFrame.go(getEffectiveLoadUrl(url));
              else if (tab.frame) tab.frame.src = url;
            } catch (_) {}
          }, 2500);
        }
      }
      return;
    }
    const isOffline = status === 'offline';
    document.getElementById('browserErrorCode').textContent =
      typeof status === 'number' ? String(status) : 'OFFLINE';
    document.getElementById('browserErrorLabel').textContent =
      isOffline ? 'Proxy unavailable' : 'Page could not be loaded';
    document.getElementById('browserErrorTitle').textContent =
      isOffline ? 'The proxy is not connected.' : 'The site could not complete your request.';
    document.getElementById('browserErrorMessage').textContent =
      isOffline ? 'Reconnect to a Wisp server in Settings, then retry this page.'
      : `The website returned HTTP ${status}. You can retry the request or open a new tab.`;
    document.getElementById('browserErrorUrl').textContent = url;
    frameLoader.classList.add('hidden');
    browserErrorScreen.hidden = false;
  }

  let pendingProxyNavigations = [];

  function applyEnglishPreferences() {
    if (!scramjet || !scramjet.cookieJar) return;
    try {
      scramjet.cookieJar.setCookies('PREF=hl=en; domain=.youtube.com; path=/', new URL('https://www.youtube.com/'));
      scramjet.cookieJar.setCookies('PREF=hl=en; domain=.google.com; path=/', new URL('https://www.google.com/'));
    } catch (_) {}
  }

  function loadUrlInFrame(url, shouldNavigate = true) {
    const tab = getActiveTab();
    if (!tab) return;
    const internalUrl = getInternalGameUrl(url);
    if (!internalUrl && (!isProxyReady || !scramjet)) {
      tab.url = url;
      showBrowserView();
      browserErrorScreen.hidden = true;
      topUrlInput.value = url;
      frameLoader.classList.remove('hidden');
      frameLoaderMsg.textContent = 'Proxy Initializing...';
      pendingProxyNavigations = pendingProxyNavigations.filter(p => p.tabId !== tab.id);
      pendingProxyNavigations.push({ tabId: tab.id, url, shouldNavigate });
      return;
    }

    if (!tab.frame) {
      tab.frame = document.createElement('iframe');
      tab.frame.className = 'browser-tab-frame';
      tab.frame.title = 'SuperUser Browser';
      tab.frame.allow = 'fullscreen; camera; microphone; geolocation; clipboard-read; clipboard-write';
      browserFrames.appendChild(tab.frame);
      tab.frame.addEventListener('load', () => {
        tab.navigationPending = false;
        updateTabMetadata(tab);
      });
      tab.metadataTimer = setInterval(() => {
        if (tab.id === activeTabId && !document.hidden) updateTabMetadata(tab);
      }, 3000);
    }
    if (!internalUrl && !tab.sjFrame) {
      tab.sjFrame = scramjet.createFrame(tab.frame);
    }

    document.querySelectorAll('.browser-tab-frame').forEach(frame => frame.classList.remove('active'));
    tab.frame.classList.add('active');
    sjFrame = internalUrl ? null : tab.sjFrame;
    if (tab.retry404Timer) {
      clearTimeout(tab.retry404Timer);
      tab.retry404Timer = null;
    }
    tab.retry404Count = 0;
    showBrowserView();
    browserErrorScreen.hidden = true;
    topUrlInput.value = getDisplayUrl(tab.url);
    if (shouldNavigate || !tab.frame.dataset.loaded) {
      frameLoader.classList.remove('hidden');
      frameLoaderMsg.textContent = `Connecting to ${getHost(url)}...`;
    } else {
      frameLoader.classList.add('hidden');
    }

    if (!shouldNavigate && tab.frame.dataset.loaded) {
      updateTabMetadata(tab);
      return;
    }
    addLog(`Navigating to: ${url}`, 'info');

    try {
      tab.navigationPending = true;
      if (internalUrl) {
        tab.frame.dataset.loaded = 'true';
        tab.frame.src = internalUrl;
      } else {
        tab.frame.dataset.loaded = 'true';
        tab.sjFrame.go(getEffectiveLoadUrl(url));
      }
    } catch (e) {
      addLog(`Navigation error: ${e.message}`, 'err');
      showBrowserError('offline', url);
      showToast('Nav Error: ' + e.message, true);
    }
  }

  function getInternalGameUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const match = /^su:\/\/games(?:\/([a-z0-9_-]+))?\/?(?:\?[^#]*)?(?:#.*)?$/i.exec(url);
    if (match) {
      const route = new URL(url);
      if (match[1]) route.searchParams.set('provider', match[1]);
      const hubUrl = new URL(appPath('internals/games/index.html'), location.href);
      hubUrl.search = route.search;
      hubUrl.hash = route.hash;
      return hubUrl.href;
    }
    if (/^su:\/\/extensions\/?(?:\?[^#]*)?(?:#.*)?$/i.test(url)) {
      return new URL(appPath('internals/extensions/index.html'), location.href).href;
    }
    if (/^su:\/\/bookmarks\/?(?:\?[^#]*)?(?:#.*)?$/i.test(url)) {
      return new URL(appPath('internals/bookmarks/index.html'), location.href).href;
    }
    if (/^su:\/\/2fa\/?(?:\?[^#]*)?(?:#.*)?$/i.test(url)) {
      return new URL(appPath('internals/2fa/index.html'), location.href).href;
    }
    return '';
  }

  function isInternalGameDocument(url) {
    try {
      const currentUrl = new URL(url, location.href);
      const internalsPath = new URL(appPath('internals/'), location.href).pathname;
      return currentUrl.origin === location.origin && currentUrl.pathname.startsWith(internalsPath);
    } catch (_) {
      return false;
    }
  }

  function getFrameResponseStatus(tab) {
    try {
      const entries = tab.frame.contentWindow.performance.getEntriesByType('navigation');
      const status = entries[entries.length - 1]?.responseStatus;
      return Number.isInteger(status) ? status : 0;
    } catch (_) {
      return 0;
    }
  }

  window.addEventListener('message', event => {
    const tab = getActiveTab();
    if (event.origin !== location.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'superuser:navigate' && typeof data.url === 'string') {
      navigate(data.url.trim());
      return;
    }

    if (data.type === 'superuser:create-tab' && typeof data.url === 'string') {
      const target = data.url.trim();
      createTab(target === 'home' ? 'home' : target);
      return;
    }

    if (data.type === 'superuser:install-userscript-url' && typeof data.url === 'string') {
      installUserscriptFromUrl(data.url.trim());
      return;
    }

    if (data.type === 'superuser:get-proxy-src' && typeof data.url === 'string') {
      try {
        const gameFrame = tab?.frame?.contentDocument?.getElementById('providerFrame');
        if (gameFrame && scramjet) {
          const gameSjFrame = scramjet.createFrame(gameFrame);
          gameSjFrame.go(data.url.trim());
        } else {
          navigate(data.url.trim());
        }
      } catch (_) {
        navigate(data.url.trim());
      }
      return;
    }

    if (data.type === 'superuser:ext-toggle' && typeof data.id === 'string') {
      enabledExtensions[data.id] = !!data.enabled;
      localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(enabledExtensions));
      return;
    }

    if (data.type === 'superuser:ext-install' || data.type === 'superuser:ext-delete') {
      loadExtensionCatalog();
      return;
    }

    if (data.type === 'superuser:bookmark-add' || data.type === 'superuser:bookmark-delete') {
      renderBookmarksBar();
      return;
    }
  });

  let isRotatingWisp = false;

  async function rotateWispAndRetry(tab) {
    if ((tab.wispRetryCount || 0) >= 3 || isRotatingWisp) {
      showBrowserError(500, tab.url);
      return;
    }
    isRotatingWisp = true;
    tab.wispRetryCount = (tab.wispRetryCount || 0) + 1;
    frameLoader.classList.remove('hidden');
    frameLoaderMsg.textContent = `Server error 500. Retrying on alternate Wisp server (attempt ${tab.wispRetryCount}/3)...`;
    addLog(`HTTP 500 on ${tab.url}. Auto-rotating to alternate Wisp server...`, 'warn');
    localStorage.removeItem(WISP_STORAGE_KEY);
    try {
      const nextWisp = await discoverAndConnectWisp();
      if (nextWisp && nextWisp.transport) {
        activeTransport = nextWisp.transport;
        scramjet.setTransport(activeTransport);
        addLog(`Switched Wisp transport to ${nextWisp.url}, retrying page...`, 'ok');
        setTimeout(() => {
          isRotatingWisp = false;
          loadUrlInFrame(tab.url, true);
        }, 400);
        return;
      }
    } catch (_) {}
    isRotatingWisp = false;
    showBrowserError(500, tab.url);
  }

  function updateTabMetadata(tab) {
    const responseStatus = tab.navigationPending ? 0 : getFrameResponseStatus(tab);
    if (responseStatus >= 400 && responseStatus < 600) {
      if (responseStatus === 404) {
        addLog(`HTTP 404 on ${tab.url}. Retrying...`, 'warn');
        if (tab.id === activeTabId) {
          browserErrorScreen.hidden = true;
          frameLoader.classList.remove('hidden');
          frameLoaderMsg.textContent = 'Page returned 404. Retrying...';
        }
        if (!tab.retry404Timer) {
          tab.retry404Count = (tab.retry404Count || 0) + 1;
          tab.retry404Timer = setTimeout(() => {
            tab.retry404Timer = null;
            addLog(`Retrying ${tab.url} (404 recovery attempt ${tab.retry404Count})...`, 'info');
            try {
              tab.navigationPending = true;
              if (tab.sjFrame) {
                tab.sjFrame.go(getEffectiveLoadUrl(tab.url));
              } else if (tab.frame) {
                tab.frame.src = tab.url;
              }
            } catch (_) {}
          }, 2500);
        }
        return;
      }
      if ((responseStatus === 500 || responseStatus === 502 || responseStatus === 503) && (tab.wispRetryCount || 0) < 3) {
        rotateWispAndRetry(tab);
        return;
      }
      showBrowserError(responseStatus, tab.url);
      return;
    }
    if (tab.retry404Timer) {
      clearTimeout(tab.retry404Timer);
      tab.retry404Timer = null;
    }
    tab.retry404Count = 0;
    if (tab.id === activeTabId) browserErrorScreen.hidden = true;
    frameLoader.classList.add('hidden');
    let loc = '';
    try { loc = tab.sjFrame?.location?.href || ''; } catch (_) {}
    try { loc = loc || tab.frame?.contentWindow?.location?.href || ''; } catch (_) {}
    if (!loc || loc === 'about:blank') {
      loc = tab.url || tab.frame?.contentDocument?.location?.href || tab.frame?.src || '';
    }
    if (!loc || loc === 'about:blank') return;
    if (isInternalGameDocument(loc) && !tab.url.startsWith('su://games')) return;

    let doc = null;
    try { doc = tab.frame.contentDocument; } catch (_) {}

    let title = '';
    let icon = '';
    try {
      title = doc?.title?.trim() ||
        tab.frame.contentWindow?.document?.title?.trim() ||
        tab.sjFrame?.document?.title?.trim() || '';
      icon = doc?.querySelector('link[rel~="icon"], link[rel="shortcut icon"]')?.href || '';
      if (icon) {
        const iconUrl = new URL(icon, doc.baseURI);
        icon = ['http:', 'https:'].includes(iconUrl.protocol) ? iconUrl.href : '';
      }
    } catch (_) {}

    const previousUrl = tab.url;
    let publicUrl = loc;
    try {
      const currentUrl = new URL(loc, location.href);
      const proxyPrefix = new URL(appPath(SCRAMJET_PREFIX), location.href).pathname;
      if (currentUrl.origin === location.origin && currentUrl.pathname.startsWith(proxyPrefix)) {
        const segments = currentUrl.pathname.slice(proxyPrefix.length).split('/').reverse();
        const decodedTarget = segments.map(segment => {
          try { return decodeURIComponent(segment); } catch (_) { return ''; }
        }).find(segment => /^https?:\/\//i.test(segment));
        if (decodedTarget) {
          publicUrl = decodedTarget;
        }
      }
    } catch (_) {}
    if (tab.url.startsWith('su://')) {
      publicUrl = tab.url;
    }
    if (/^https?:\/\//i.test(publicUrl)) tab.url = publicUrl;
    let host = getHost(publicUrl);
    try { host = new URL(publicUrl).hostname; } catch (_) {}
    let suTitle = 'SuperUser';
    if (tab.url.startsWith('su://games')) suTitle = 'Games';
    else if (tab.url.startsWith('su://extensions')) suTitle = 'Extensions';
    else if (tab.url.startsWith('su://bookmarks')) suTitle = 'Bookmarks';
    else if (tab.url.startsWith('su://2fa')) suTitle = '2FA';
    const nextTitle = title || (tab.url.startsWith('su://') ? suTitle : host);
    const nextFavicon = icon || (tab.url.startsWith('su://')
      ? ''
      : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`);
    const metadataChanged = tab.url !== previousUrl || tab.title !== nextTitle || tab.favicon !== nextFavicon;
    tab.title = nextTitle;
    tab.favicon = nextFavicon;
    if (doc && tab.metadataDoc !== doc) {
      tab.metadataObserver?.disconnect();
      tab.metadataDoc = doc;
      const metadataRoot = doc.head || doc.documentElement;
      if (metadataRoot) {
        let updateQueued = false;
        tab.metadataObserver = new MutationObserver(() => {
          if (updateQueued) return;
          updateQueued = true;
          setTimeout(() => {
            updateQueued = false;
            updateTabMetadata(tab);
          }, 100);
        });
        tab.metadataObserver.observe(metadataRoot, {
          childList: true, subtree: true, characterData: true,
          attributes: true, attributeFilter: ['href', 'rel']
        });
      }
      try {
        const frameWindow = tab.frame.contentWindow;
        frameWindow.addEventListener('popstate', () => updateTabMetadata(tab));
        frameWindow.addEventListener('hashchange', () => updateTabMetadata(tab));
        frameWindow.open = function(u) {
          if (u) createTab(u);
          else createTab('home');
          return null;
        };
      } catch (_) {}
      try {
        doc.addEventListener('click', function(e) {
          const a = e.target?.closest?.('a[href]');
          if (!a) return;
          const h = a.href;
          if (/\.user\.js(?:\?.*)?$/i.test(h) || /greasyfork\.org\/.*\/scripts\/\d+\/code\//i.test(h)) {
            e.preventDefault();
            e.stopPropagation();
            installUserscriptFromUrl(h);
            return;
          }
          if (a.target === '_blank' || a.target === '_new') {
            e.preventDefault();
            e.stopPropagation();
            createTab(h);
          }
        }, true);
        doc.addEventListener('contextmenu', function(e) {
          handleContextMenu(e, tab);
        });
      } catch (_) {}
      installAdBlocker(tab);
      injectEnglishLanguage(tab);
      offerSiteExtension(tab, host);
    }
    if (tab.id === activeTabId) {
      if (tab.url !== previousUrl) topUrlInput.value = getDisplayUrl(tab.url);
      setWindowTitle(tab.title ? `${tab.title} - SuperUser` : 'SuperUser Proxy');
      const appFavicon = document.getElementById('appFavicon');
      if (appFavicon) appFavicon.href = tab.favicon || appPath('assets/shortcuts/icons/google.png');
    }
    if (metadataChanged) {
      renderTabs();
      saveTabs();
      offerSiteExtension(tab, host);
    }
    if (!title && tab.metadataAttempts < 4) {
      tab.metadataAttempts = (tab.metadataAttempts || 0) + 1;
      setTimeout(() => updateTabMetadata(tab), 700);
    }
  }

  /* ═══════════════════════════════════════════════════════
     5. TOP URL BAR CONTROLS
  ═══════════════════════════════════════════════════════ */
  document.getElementById('topBackBtn').addEventListener('click', () => {
    try { sjFrame?.back(); } catch (_) { history.back(); }
  });

  document.getElementById('topForwardBtn').addEventListener('click', () => {
    try { sjFrame?.forward(); } catch (_) { history.forward(); }
  });

  document.getElementById('topReloadBtn').addEventListener('click', () => {
    try { getActiveTab()?.sjFrame?.reload(); } catch (_) {}
  });

  document.getElementById('retryErrorPageBtn').addEventListener('click', () => {
    const tab = getActiveTab();
    if (tab && tab.url !== 'home') navigate(tab.url);
  });

  document.getElementById('homeErrorPageBtn').addEventListener('click', () => createTab('home'));

  document.getElementById('topFullscreenBtn').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const tab = getActiveTab();
      if (tab?.url?.startsWith('su://games')) {
        const gameFrame = tab.frame?.contentDocument?.getElementById('providerFrame');
        if (gameFrame) {
          await (gameFrame.requestFullscreen?.() || frameArea.requestFullscreen());
          return;
        }
      }
      await frameArea.requestFullscreen();
    } catch (error) {
      showToast('Fullscreen is unavailable', true);
      addLog(`Fullscreen error: ${error.message}`, 'warn');
    }
  });

  document.getElementById('topBookmarkBtn')?.addEventListener('click', () => {
    const tab = getActiveTab();
    if (!tab || tab.url === 'home') return;
    bookmarkCurrentTab(tab);
  });

  document.getElementById('topHomeBtn').addEventListener('click', () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      currentTab.url = 'home';
      currentTab.title = 'New Tab';
      currentTab.favicon = '';
      renderTabs();
      saveTabs();
      showHomeScreen();
    }
  });

  document.getElementById('topGoBtn').addEventListener('click', () => {
    const value = topUrlInput.value.trim();
    if (/^sudo(?:\s|$)/i.test(value)) executeCommand(value);
    else navigate(value);
  });

  topUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('topCommandAutocomplete').classList.remove('visible');
      const value = topUrlInput.value.trim();
      if (/^sudo(?:\s|$)/i.test(value)) executeCommand(value);
      else navigate(value);
    }
  });

  topUrlInput.addEventListener('input', () => {
    const menu = document.getElementById('topCommandAutocomplete');
    const value = topUrlInput.value.trim().toLowerCase();
    if (!value || (!'sudo'.startsWith(value) && !value.startsWith('sudo'))) {
      menu.classList.remove('visible');
      return;
    }
    const commandValue = value === 'sudo' ? '' : value.slice(4).trimStart();
    const matches = COMMANDS.filter(item => {
      const command = item.cmd.toLowerCase();
      const name = command.replace(/^sudo\s*/, '').replace(/ <.*>$/, '');
      return value === 'sudo' || command.startsWith(value) ||
        name.startsWith(commandValue) || name.includes(commandValue);
    });
    menu.innerHTML = matches.map(item => `
      <button type="button" class="autocomplete-item" data-top-command="${escapeHtml(item.cmd.replace(/ <.*>$/, ''))}">
        <span class="ac-cmd">${escapeHtml(item.cmd)}</span><span class="ac-desc">${escapeHtml(item.desc)}</span>
      </button>`).join('');
    menu.querySelectorAll('[data-top-command]').forEach(item => item.addEventListener('click', () => {
      topUrlInput.value = item.dataset.topCommand + (item.dataset.topCommand.includes('<') ? ' ' : '');
      topUrlInput.focus();
    }));
    menu.classList.toggle('visible', matches.length > 0);
  });

  /* ═══════════════════════════════════════════════════════
     6. COMMAND ENGINE, AUTOCOMPLETE & TEXTBOX EXPANSION
  ═══════════════════════════════════════════════════════ */
  const cmdTextarea     = document.getElementById('cmdTextarea');
  const terminalBox     = document.getElementById('terminalBox');
  const cmdAutocomplete = document.getElementById('cmdAutocomplete');
  const cmdRunBtn       = document.getElementById('cmdRunBtn');
  let autocompleteIndex = -1;

  const COMMANDS = [
    { cmd: 'sudo',                   desc: 'Show all available commands' },
    { cmd: 'sudo search <query>',    desc: 'Search with the selected provider' },
    { cmd: 'sudo yt <query>',        desc: 'Search YouTube' },
    { cmd: 'sudo newtab',            desc: 'Create a new tab' },
    { cmd: 'sudo clear',             desc: 'Close all tabs and return home' },
    { cmd: 'sudo logs',              desc: 'Open system and proxy diagnostics' },
    { cmd: 'sudo test',              desc: 'Run proxy connection diagnostics' },
    { cmd: 'sudo settings',          desc: 'Open settings modal' },
    { cmd: 'sudo help',              desc: 'Open commands reference modal' },
    { cmd: 'sudo ext',               desc: 'Open extensions manager (su://extensions)' },
    { cmd: 'sudo ext install <url>', desc: 'Install a userscript from a URL or GreasyFork' },
    { cmd: 'sudo ext uninstall <id>',desc: 'Uninstall or disable an extension' },
    { cmd: 'sudo bookmarks',         desc: 'Open bookmarks manager (su://bookmarks)' },
    { cmd: 'sudo 2fa',               desc: 'Open 2FA authenticator (su://2fa)' },
    { cmd: 'sudo games',             desc: 'Open games library (su://games)' },
    { cmd: 'sudo blank',             desc: 'Launch proxy in about:blank (tab cloaking)' },
    { cmd: 'sudo intro',             desc: 'Replay typewriter bump & ripple intro' },
    { cmd: 'sudo reload',            desc: 'Reload current page' },
    { cmd: 'sudo back',              desc: 'Go back' },
    { cmd: 'sudo forward',           desc: 'Go forward' },
    { cmd: 'sudo home',              desc: 'Return to home screen' },
    { cmd: 'sudo wisp <url>',        desc: 'Switch Wisp server' }
  ];

  const PAGE_IDS = ['settings', 'help', 'logs'];
  let activeSettingsPage = 'proxy';

  function activateSettingsPage(page) {
    activeSettingsPage = page;
    document.querySelectorAll('[data-settings-page]').forEach(button => {
      button.classList.toggle('active', button.dataset.settingsPage === page);
    });
    document.querySelectorAll('[data-settings-panel]').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.settingsPanel === page);
    });
  }

  function showAppPage(page) {
    PAGE_IDS.forEach(id => document.getElementById(`${id}Page`)?.classList.toggle('active', id === page));
    if (page) {
      homeScreen.classList.add('hidden');
      frameArea.classList.remove('active');
      topUrlBar.classList.remove('active');
      document.querySelector('.viewport').classList.remove('browsing');
      document.querySelector(`[data-page-search="${page}"]`)?.focus();
    }
  }

  function renderHelpPage() {
    const list = document.getElementById('helpCommandList');
    if (!list) return;
    list.innerHTML = COMMANDS.map(item =>
      `<div class="page-command-row" data-searchable="${escapeHtml(item.cmd + ' ' + item.desc)}"><code>${escapeHtml(item.cmd)}</code><span>${escapeHtml(item.desc)}</span></div>`
    ).join('') + `
      <div class="page-command-row" data-searchable="enter submit"><code>Enter</code><span>Submit a command, URL, or search.</span></div>
      <div class="page-command-row" data-searchable="arrow tab autocomplete"><code>Arrow keys / Tab</code><span>Choose an autocomplete command.</span></div>`;
  }

  renderHelpPage();

  document.querySelectorAll('[data-page-search]').forEach(input => {
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      const page = input.dataset.pageSearch;
      if (page === 'settings') {
        const panels = [...document.querySelectorAll('[data-settings-panel]')];
        panels.forEach(panel => {
          const cards = [...panel.querySelectorAll('[data-searchable]')];
          cards.forEach(card => {
            card.hidden = Boolean(query && !card.dataset.searchable.toLowerCase().includes(query));
          });
          const hasMatch = cards.some(card => !card.hidden);
          panel.classList.toggle('active', query ? hasMatch : panel.dataset.settingsPanel === activeSettingsPage);
        });
        document.querySelectorAll('[data-settings-page]').forEach(button => {
          button.classList.toggle('active', !query && button.dataset.settingsPage === activeSettingsPage);
        });
        return;
      }
      document.querySelectorAll(`#${page}Page [data-searchable]`).forEach(item => {
        item.hidden = Boolean(query && !item.dataset.searchable.toLowerCase().includes(query));
      });
    });
  });

  // Keep the input single-submit while allowing wrapped text to grow the box.
  function resizeCmdBox() {
    cmdTextarea.style.height = 'auto';
    const newH = Math.max(26, cmdTextarea.scrollHeight);
    cmdTextarea.style.height = newH + 'px';
    terminalBox.classList.toggle('multiline', newH > 32);
  }

  cmdTextarea.addEventListener('input', () => {
    resizeCmdBox();
    updateAutocomplete();
  });

  // Autocomplete suggestions
  function updateAutocomplete() {
    const val = cmdTextarea.value.trim().toLowerCase();
    if (!val || (!'sudo'.startsWith(val) && !val.startsWith('sudo'))) {
      cmdAutocomplete.classList.remove('visible');
      autocompleteIndex = -1;
      return;
    }

    const matches = COMMANDS
      .filter(c => {
        const command = c.cmd.toLowerCase();
        const name = command.replace(/^sudo\s*/, '').replace(/ <.*>$/, '');
        const commandValue = val === 'sudo' ? '' : val.slice(4).trimStart();
        return val === 'sudo' || command.startsWith(val) ||
          name.startsWith(commandValue) || name.includes(commandValue);
      })
      .filter((command, index, list) => list.findIndex(item => item.cmd === command.cmd) === index);

    if (!matches.length) {
      cmdAutocomplete.classList.remove('visible');
      autocompleteIndex = -1;
      return;
    }

    autocompleteIndex = Math.min(autocompleteIndex, matches.length - 1);
    cmdAutocomplete.innerHTML = matches.map((c, index) => `
      <button type="button" class="autocomplete-item${index === autocompleteIndex ? ' focused' : ''}" data-index="${index}" data-cmd="${c.cmd.replace(/ <.*>$/, '')}" role="option">
        <span class="ac-cmd">${c.cmd}</span>
        <span class="ac-desc">${c.desc}</span>
      </button>
    `).join('');

    cmdAutocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const cmd = item.dataset.cmd;
        cmdTextarea.value = cmd + (cmd.includes('<') ? ' ' : '');
        cmdTextarea.focus();
        resizeCmdBox();
        cmdAutocomplete.classList.remove('visible');
        autocompleteIndex = -1;
      });
    });

    cmdAutocomplete.classList.add('visible');
  }

  // Enter always submits. Wrapped text grows naturally; it never creates a newline.
  cmdTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const focused = cmdAutocomplete.classList.contains('visible') && autocompleteIndex >= 0
        ? cmdAutocomplete.querySelector(`[data-index="${autocompleteIndex}"]`)
        : null;
      if (focused) {
        focused.click();
      } else {
        executeCommand(cmdTextarea.value);
      }
    }
    else if (e.key === 'Escape') {
      cmdAutocomplete.classList.remove('visible');
      autocompleteIndex = -1;
      closeAllModals();
    }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = cmdAutocomplete.querySelectorAll('.autocomplete-item');
      if (!cmdAutocomplete.classList.contains('visible') || !items.length) return;
      e.preventDefault();
      autocompleteIndex = e.key === 'ArrowDown'
        ? (autocompleteIndex + 1) % items.length
        : (autocompleteIndex - 1 + items.length) % items.length;
      items.forEach((item, index) => item.classList.toggle('focused', index === autocompleteIndex));
    }
    else if (e.key === 'Tab' && cmdAutocomplete.classList.contains('visible')) {
      const focused = cmdAutocomplete.querySelector(`[data-index="${autocompleteIndex < 0 ? 0 : autocompleteIndex}"]`);
      if (focused) {
        e.preventDefault();
        focused.click();
      }
    }
  });

  cmdRunBtn.addEventListener('click', () => {
    executeCommand(cmdTextarea.value);
  });

  function executeCommand(raw) {
    const text = raw.trim().replace(/\s+/g, ' ');
    if (!text) return;

    // Reset textarea to default height
    cmdTextarea.value = '';
    cmdTextarea.style.height = '26px';
    terminalBox.classList.remove('multiline');
    cmdAutocomplete.classList.remove('visible');

    addLog(`> ${text}`, 'info');

    const normalized = text.toLowerCase();

    // 1. If user typed just "sudo", show the command menu.
    if (normalized === 'sudo' || normalized === 'sudo help' || normalized === 'sudo commands') {
      showAppPage('help');
      addLog('Displaying all available commands', 'ok');
      return;
    }

    // 2. Process sudo commands
    if (text.toLowerCase().startsWith('sudo ')) {
      const args = text.slice(5).trim();

      const command = args.toLowerCase();
      if (!args || command === 'help' || command === 'commands') { showAppPage('help'); return; }
      if (command === 'logs')          { showAppPage('logs'); return; }
      if (command === 'test')          { document.getElementById('pageTestProxyBtn').click(); return; }
      if (command === 'settings')      { showAppPage('settings'); return; }
      if (command === 'newtab')        { createTab('home'); return; }
      if (command === 'clear')         { tabs = []; createTab('home'); showToast('All tabs cleared'); return; }
      if (command === 'home')          { showHomeScreen(); return; }
      if (command === 'intro')         { playIntro(); return; }
      if (command === 'blank' || command === 'cloak') { launchInAboutBlank(); return; }
      if (command === 'back')          { try { sjFrame?.back(); } catch (_) { showToast('Back is unavailable', true); } return; }
      if (command === 'forward')       { try { sjFrame?.forward(); } catch (_) { showToast('Forward is unavailable', true); } return; }
      if (command === 'reload')        { try { sjFrame?.reload(); } catch (_) { showToast('Reload is unavailable', true); } return; }

      if (command === 'yt' || command.startsWith('yt ')) {
        const query = args.slice(2).trim();
        if (!query) {
          cmdTextarea.value = 'sudo yt ';
          cmdTextarea.focus();
          return;
        }
        navigate(searchUrls.youtube(query));
        return;
      }

      if (command === 'ext' || command === 'extensions') {
        navigate('su://extensions');
        return;
      }
      if (command.startsWith('ext install ')) {
        const extUrl = args.slice(12).trim();
        if (!extUrl) { showToast('Usage: sudo ext install <url>', true); return; }
        installUserscriptFromUrl(extUrl);
        return;
      }
      if (command.startsWith('ext uninstall ')) {
        const extId = args.slice(14).trim();
        uninstallExtension(extId);
        return;
      }
      if (command === 'bookmarks') {
        navigate('su://bookmarks');
        return;
      }
      if (command === '2fa') {
        navigate('su://2fa');
        return;
      }
      if (command === 'games') {
        navigate('su://games');
        return;
      }

      if (command.startsWith('search ')) {
        const q = args.slice(7).trim();
        if (!q) { cmdTextarea.value = 'sudo search '; cmdTextarea.focus(); updateAutocomplete(); return; }
        navigate(q);
        return;
      }

      if (command.startsWith('wisp ')) {
        const wUrl = args.slice(5).trim();
        if (!wUrl) { showToast('Enter a Wisp endpoint', true); return; }
        setCustomWisp(wUrl);
        return;
      }

      if (/^sudo\s+/i.test(text) && !args.includes('.') && !args.includes('/')) {
        showToast(`Unknown command: ${args}`, true);
        addLog(`Unknown command: ${args}`, 'warn');
        updateAutocomplete();
        return;
      }

      // Default: sudo <url>
      navigate(args);
      return;
    }

    // 3. Direct URL or search input
    navigate(text);
  }

  /* ═══════════════════════════════════════════════════════
     7. BUTTONS & SHORTCUTS
  ═══════════════════════════════════════════════════════ */
  /* ═══ ABOUT:BLANK CLOAKING ═══ */
  function launchInAboutBlank() {
    const target = window.open('about:blank', '_blank');
    if (!target) {
      showToast('Pop-up blocked — allow pop-ups for this site', true);
      return;
    }
    const proxyUrl = location.href;
    target.document.open();
    target.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Super Learning</title>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body,iframe{width:100%;height:100%;border:none;overflow:hidden;background:#000}</style>
</head><body>
<iframe id="suFrame" src="${proxyUrl}" allow="autoplay; camera; microphone; fullscreen; clipboard-read; clipboard-write" allowfullscreen></iframe>
<script>
// Keep title locked to "Super Learning" at all times
Object.defineProperty(document, 'title', {
  get: () => 'Super Learning',
  set: () => {}
});
document.title = 'Super Learning';
// Keep about:blank in address bar always
const frame = document.getElementById('suFrame');
frame.addEventListener('load', () => {
  document.title = 'Super Learning';
});
</\script>
</body></html>`);
    target.document.close();

    // Immediately close the opener page that launched about:blank
    allowApplicationUnload = true;
    try {
      window.open('', '_self', '');
      window.close();
    } catch (_) {}
    setTimeout(() => {
      try { window.close(); } catch (_) {}
    }, 50);
  }

  document.getElementById('cloakAboutBlankBtn').addEventListener('click', launchInAboutBlank);
  document.getElementById('gamesSidebarBtn')?.addEventListener('click', () => navigate('su://games'));

  // Games fullscreen listener: hides search bar and buttons while in fullscreen
  document.addEventListener('fullscreenchange', () => {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    const tab = getActiveTab();
    const isGames = tab?.url?.startsWith('su://games') || (document.fullscreenElement && document.fullscreenElement.closest && document.fullscreenElement.closest('#frameArea'));
    if (isFs && isGames) {
      document.body.classList.add('games-fullscreen');
      try {
        const gameFrame = tab?.frame?.contentDocument?.getElementById('providerFrame');
        if (gameFrame && document.fullscreenElement !== gameFrame) {
          gameFrame.requestFullscreen?.().catch(() => {});
        }
      } catch (_) {}
    } else {
      document.body.classList.remove('games-fullscreen');
    }
  });

  document.getElementById('newTabBtn').addEventListener('click', () => createTab('home'));
  document.getElementById('collapseSidebarBtn').addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const collapsed = sidebar.classList.toggle('collapsed');
    const button = document.getElementById('collapseSidebarBtn');
    button.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    button.querySelector('span').textContent = collapsed ? '›' : '‹';
  });
  document.getElementById('searchTabsInput').addEventListener('input', filterTabs);

  document.getElementById('settingsBtn').addEventListener('click', () => showAppPage('settings'));
  document.getElementById('helpBtn').addEventListener('click', () => showAppPage('help'));
  document.getElementById('logsBtn').addEventListener('click', () => showAppPage('logs'));

  document.querySelectorAll('[data-settings-page]').forEach(button => {
    button.addEventListener('click', () => {
      document.getElementById('settingsSearch').value = '';
      document.getElementById('settingsSearch').dispatchEvent(new Event('input'));
      activateSettingsPage(button.dataset.settingsPage);
    });
  });

  document.getElementById('replayIntroBtn').addEventListener('click', () => {
    closeAllModals();
    playIntro();
  });

  document.getElementById('replayIntroPageBtn').addEventListener('click', () => {
    showAppPage(null);
    playIntro();
  });

  document.getElementById('resetSwBtn').addEventListener('click', async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (let r of regs) await r.unregister();
      addLog('Service worker unregistered. Reloading...', 'warn');
      allowApplicationUnload = true;
      location.reload();
    }
  });

  document.getElementById('resetSwPageBtn').addEventListener('click', async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const registration of regs) await registration.unregister();
      addLog('Service worker unregistered. Reloading...', 'warn');
      allowApplicationUnload = true;
      location.reload();
    }
  });

  document.getElementById('factoryResetBtn').addEventListener('click', () => {
    if (!confirm('Factory Reset will permanently remove all SuperUser data saved in this browser. Continue?')) return;
    localStorage.clear();
    allowApplicationUnload = true;
    location.reload();
  });

  function setCustomWisp(value) {
    value = value.trim();
    if (!/^wss?:\/\/.+/i.test(value)) {
      showToast('Use a ws:// or wss:// endpoint', true);
      return;
    }
    settings.wisp = value;
    localStorage.setItem(WISP_STORAGE_KEY, value);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.getElementById('customWispInputPage').value = value;
    document.getElementById('customWispInput').value = value;
    renderWispServer(value);
    addLog(`Using custom Wisp endpoint: ${value}`, 'info');
    initScramjetProxy();
  }
  function useCustomWisp(inputId) {
    setCustomWisp(document.getElementById(inputId).value);
  }
  function useAutomaticWisp() {
    localStorage.removeItem(WISP_STORAGE_KEY);
    settings.wisp = 'auto';
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    renderWispServer('Finding a Wisp server…');
    addLog('Switching to automatic Wisp server selection', 'info');
    initScramjetProxy();
  }
  document.getElementById('customWispBtnPage').addEventListener('click', () => useCustomWisp('customWispInputPage'));
  document.getElementById('customWispBtn').addEventListener('click', () => useCustomWisp('customWispInput'));
  document.getElementById('autoWispBtnPage').addEventListener('click', useAutomaticWisp);
  document.getElementById('autoWispBtn').addEventListener('click', useAutomaticWisp);
  document.getElementById('topSearchProvider').value = settings.searchProvider;
  if (!searchProviders.some(provider => provider.id === settings.searchProvider)) {
    settings.searchProvider = 'startpage';
    document.getElementById('topSearchProvider').value = settings.searchProvider;
  }
  renderSearchProviderMenu();
  document.getElementById('searchProviderButton').addEventListener('click', () => {
    const menu = document.getElementById('searchProviderMenu');
    menu.hidden = !menu.hidden;
    document.getElementById('searchProviderButton').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', event => {
    const control = document.getElementById('searchProviderControl');
    if (!control.contains(event.target)) {
      document.getElementById('searchProviderMenu').hidden = true;
      document.getElementById('searchProviderButton').setAttribute('aria-expanded', 'false');
    }
  });
  document.getElementById('topSearchProvider').addEventListener('change', event => {
    settings.searchProvider = event.target.value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    renderSearchProviderMenu();
  });
  document.getElementById('adBlockToggle').checked = settings.adBlock;
  document.getElementById('adBlockToggle').addEventListener('change', event => {
    settings.adBlock = event.target.checked;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    tabs.forEach(tab => {
      tab.adObserver?.disconnect();
      if (settings.adBlock) installAdBlocker(tab);
    });
  });
  window.addEventListener('beforeunload', (event) => {
    if (allowApplicationUnload) return;
    event.preventDefault();
    event.returnValue = '';
  });

  function toggleBlankMode() {
    const tab = getActiveTab();
    if (!tab) return;
    if (!tab.blankMode) {
      tab.blankMode = true;
      tab.savedTitle = tab.title;
      tab.savedFavicon = tab.favicon;
      tab.title = 'New Tab';
      tab.favicon = '';
      renderTabs();
      if (tab.url === 'home') navigate('https://www.google.com');
      frameArea.requestFullscreen?.().catch(() => {});
    } else {
      tab.blankMode = false;
      tab.title = tab.savedTitle || getHost(tab.url);
      tab.favicon = tab.savedFavicon || '';
      renderTabs();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
    saveTabs();
  }

  // Global keybinds
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
      e.preventDefault();
      createTab('home');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      if (topUrlBar.classList.contains('active')) {
        topUrlInput.focus();
        topUrlInput.select();
      } else {
        cmdTextarea.focus();
      }
    }
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      (topUrlBar.classList.contains('active') ? topUrlInput : cmdTextarea).focus();
    }
    if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      toggleBlankMode();
    }
  });

  /* ═══════════════════════════════════════════════════════
     8. MODALS & TOAST
  ═══════════════════════════════════════════════════════ */
  function openModal(id) {
    closeAllModals();
    const el = document.getElementById(id + 'Modal');
    if (el) el.classList.add('open');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  const toastPill = document.getElementById('toastPill');
  let toastTimer;

  function showToast(text, isErr = false) {
    toastPill.textContent = text;
    toastPill.className = 'toast-pill show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastPill.className = 'toast-pill';
    }, 2800);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let lastPingTime = 0;
  let cachedPingStr = '';

  function updateSystemStatus() {
    const time = new Date();
    document.getElementById('systemTime').textContent =
      time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    if (!activeTransport) {
      document.getElementById('serverPing').textContent = 'connecting…';
    } else {
      // Avoid spamming Wisp WebSocket: only re-measure ping if visible and >5 mins elapsed
      const now = Date.now();
      if (cachedPingStr && (now - lastPingTime < 300000 || document.hidden)) {
        document.getElementById('serverPing').textContent = cachedPingStr;
      } else if (!pingInFlight && !document.hidden) {
        pingInFlight = true;
        const started = performance.now();
        probeTransport(activeTransport)
          .then(() => {
            const ms = Math.round(performance.now() - started);
            cachedPingStr = `${ms}ms`;
            lastPingTime = Date.now();
            document.getElementById('serverPing').textContent = cachedPingStr;
          })
          .catch(() => {
            document.getElementById('serverPing').textContent = cachedPingStr || 'offline';
          })
          .finally(() => {
            pingInFlight = false;
          });
      }
    }
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        const update = () => {
          document.getElementById('systemBattery').textContent =
            `${Math.round(battery.level * 100)}%${battery.charging ? ' +': ''}`;
        };
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      }).catch(() => {});
    }
  }

  let pingInFlight = false;
  let initialExperienceActive = false;

  function restoreWindowMetadata() {
    const tab = getActiveTab();
    setWindowTitle(tab && tab.url !== 'home' ? `${tab.title} - SuperUser` : 'SuperUser Proxy');
    const appFavicon = document.getElementById('appFavicon');
    if (appFavicon) appFavicon.href = tab?.favicon || appPath('assets/shortcuts/icons/google.png');
  }

  function setupLearningScreen() {
    document.getElementById('learningMockupFrame').src = appPath('Mockups/learning.html');

    // If we're running inside an about:blank iframe (the cloaked tab),
    // the parent handles all cloaking — skip all blur/visibility listeners
    // so the mockup never flashes inside the iframe.
    const isEmbedded = (() => {
      try { return window.self !== window.top; } catch (_) { return true; }
    })();
    if (isEmbedded) return;

    function goHidden() {
      isCloakedOrHidden = true;
      document.title = 'Super Learning';
      learningScreen.style.zIndex = '10000';
      learningScreen.classList.remove('hidden');
    }
    function goVisible() {
      isCloakedOrHidden = false;
      learningScreen.style.zIndex = '';
      restoreWindowMetadata();
      if (!initialExperienceActive) learningScreen.classList.add('hidden');
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) goHidden(); else goVisible();
    });
    window.addEventListener('blur', () => {
      if (document.hidden) return; // already handled
      goHidden();
    });
    window.addEventListener('focus', () => {
      if (!document.hidden) goVisible();
    });

    if (localStorage.getItem('superuser-first-visit-complete') === 'true') {
      playIntro();
      return;
    }
    localStorage.setItem('superuser-first-visit-complete', 'true');
    initialExperienceActive = true;
    learningScreen.classList.remove('hidden');
    setTimeout(() => {
      if (document.hidden) {
        const resumeWelcome = () => {
          if (document.hidden) return;
          document.removeEventListener('visibilitychange', resumeWelcome);
          startEntryNotice();
        };
        document.addEventListener('visibilitychange', resumeWelcome);
        return;
      }
      startEntryNotice();
    }, 5000);

    function startEntryNotice() {
      initialExperienceActive = false;
      learningScreen.classList.add('hidden');
      const notice = document.getElementById('entryNotice');
      notice.classList.add('show');
      setTimeout(() => {
        notice.classList.remove('show');
        playIntro();
      }, 1100);
    }
  }

  /* ═══ FORCE ENGLISH LANGUAGE ON EVERY PAGE ═══ */
  function injectEnglishLanguage(tab) {
    applyEnglishPreferences();
    try {
      const win = tab?.frame?.contentWindow;
      if (win) {
        try {
          Object.defineProperty(win.navigator, 'language', { get: () => 'en-US', configurable: true });
          Object.defineProperty(win.navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });
          Object.defineProperty(win.navigator, 'userLanguage', { get: () => 'en-US', configurable: true });
        } catch (_) {}
      }
      const doc = tab?.frame?.contentDocument;
      if (!doc || !doc.documentElement) return;
      if (doc.documentElement.lang !== 'en') {
        doc.documentElement.lang = 'en';
        doc.documentElement.setAttribute('lang', 'en');
      }
      if (doc.querySelector('script[data-su-lang]')) return;
      const el = doc.createElement('script');
      el.setAttribute('data-su-lang', '1');
      el.textContent = `(function(){
  try {
    document.documentElement.lang = 'en';
    document.documentElement.setAttribute('lang', 'en');
    Object.defineProperty(navigator, 'language', { get: () => 'en-US', configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });
    Object.defineProperty(navigator, 'userLanguage', { get: () => 'en-US', configurable: true });
  } catch(_) {}
  const fixLang = () => {
    if (document.documentElement && document.documentElement.lang !== 'en') {
      document.documentElement.lang = 'en';
      document.documentElement.setAttribute('lang', 'en');
    }
  };
  try {
    const obs = new MutationObserver(fixLang);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch(_) {}
})();`;
      try {
        (doc.head || doc.documentElement).prepend(el);
      } catch (_) {}
    } catch (_) {}
  }

  function installAdBlocker(tab) {
    if (!settings.adBlock || !tab.frame?.contentDocument) return;
    const doc = tab.frame.contentDocument;
    const host = getHost(tab.url || '');
    if (host.includes('youtube.com')) return;
    let scheduled = false;
    const removeAds = () => {
      scheduled = false;
      doc.querySelectorAll('iframe, script, img, video, link, div').forEach(element => {
        const source = element.src || element.href || element.getAttribute('data-src') || '';
        try {
          if (source && AD_HOSTS.test(new URL(source, doc.baseURI).hostname)) element.remove();
        } catch (_) {}
      });
      doc.querySelectorAll(
        '[id^="ad_" i], [id*="-ad-" i], [id="player-ads" i], ' +
        '[class*="ad-container" i], [class*="advertisement" i], [data-ad-slot]'
      ).forEach(element => element.remove());
    };
    removeAds();
    tab.adObserver?.disconnect();
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(removeAds);
    };
    tab.adObserver = new MutationObserver(schedule);
    tab.adObserver.observe(doc.documentElement, { childList: true, subtree: true });
  }

  function renderExtensionSettings() {
    const list = document.getElementById('extensionSettingsList');
    if (!list) return;
    list.innerHTML = extensionCatalog.map(extension => `
      <label style="display:block;margin-top:8px;font-size:12px">
        <input type="checkbox" data-extension-toggle="${escapeHtml(extension.id)}" ${enabledExtensions[extension.id] ? 'checked' : ''}>
        ${escapeHtml(extension.title)} <span style="color:var(--text-dim)">(${escapeHtml(extension.id)})</span>
      </label>`).join('');
    list.querySelectorAll('[data-extension-toggle]').forEach(input => {
      input.addEventListener('change', event => {
        enabledExtensions[event.target.dataset.extensionToggle] = event.target.checked;
        localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(enabledExtensions));
      });
    });
  }

  function renderShortcuts() {
    const home = document.getElementById('quickShortcuts');
    if (!home) return;
    const faviconFor = shortcut => {
      if (shortcut.icon || shortcut.svg || shortcut.url === 'su://games') return '';
      let host = shortcut.domain;
      try { host = new URL(shortcut.url).hostname; } catch (_) {}
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    };
    const visibleTiles = visibleShortcuts.map(shortcut => {
      const isGames = shortcut.url === 'su://games';
      const svgIcon = shortcut.svg || (isGames ? GAMEPAD_SVG : null);
      return `
      <div class="shortcut-tile-wrap">
        <button class="shortcut-tile" type="button" data-shortcut-url="${escapeHtml(shortcut.url)}" title="${escapeHtml(shortcut.title)}">
          ${svgIcon
            ? `<span class="shortcut-svg" aria-hidden="true">${svgIcon}</span>`
            : (shortcut.icon && shortcut.icon !== '🎮')
              ? `<span class="shortcut-glyph" aria-hidden="true">${escapeHtml(shortcut.icon)}</span>`
              : `<img class="shortcut-icon" src="${escapeHtml(faviconFor(shortcut))}" alt="" loading="lazy">`}
          <span>${escapeHtml(shortcut.title)}</span>
        </button>
        <button class="shortcut-remove" type="button" data-remove-shortcut="${escapeHtml(shortcut.title)}" aria-label="Remove ${escapeHtml(shortcut.title)}" title="Remove shortcut">×</button>
      </div>`;
    }).join('');
    const availableDefaults = DEFAULT_SHORTCUTS.filter(shortcut =>
      !visibleShortcuts.some(item => item.title === shortcut.title));
    const defaultOptions = availableDefaults.map(shortcut =>
      `<option value="${escapeHtml(shortcut.title)}">${shortcut.icon ? `${escapeHtml(shortcut.icon)} ` : ''}${escapeHtml(shortcut.title)}</option>`
    ).join('');
    home.innerHTML = `${visibleTiles}
      <div class="shortcut-add-wrap">
        <button class="shortcut-tile" type="button" id="addShortcutBtn" aria-haspopup="true" aria-expanded="false">
          <span class="shortcut-glyph" aria-hidden="true">+</span><span>Add shortcut</span>
        </button>
        <div class="shortcut-add-menu" id="shortcutAddMenu" role="dialog" aria-modal="true" aria-labelledby="shortcutDialogTitle" hidden>
          <button class="shortcut-add-close" id="closeShortcutMenu" type="button" aria-label="Close add shortcut dialog">×</button>
          <h3 id="shortcutDialogTitle">Add a shortcut</h3>
          <form class="shortcut-default-form" id="defaultShortcutForm">
            <label for="defaultShortcutSelect">Add a premade shortcut</label>
            <select id="defaultShortcutSelect" aria-label="Premade shortcut" ${availableDefaults.length ? '' : 'disabled'}>
              <option value="">${availableDefaults.length ? 'Choose a shortcut…' : 'All premade shortcuts are added'}</option>
              ${defaultOptions}
            </select>
            <button class="modal-btn" type="submit" ${availableDefaults.length ? '' : 'disabled'}>Add</button>
          </form>
          <form class="shortcut-custom-form" id="customShortcutForm">
            <input id="customShortcutTitle" maxlength="40" placeholder="Shortcut name" aria-label="Shortcut name" required>
            <input id="customShortcutUrl" type="url" placeholder="https://example.com" aria-label="Shortcut URL" required>
            <button class="modal-btn" type="submit">Add custom shortcut</button>
          </form>
        </div>
      </div>`;
    home.querySelectorAll('[data-shortcut-url]').forEach(button => {
      button.addEventListener('click', () => navigate(button.dataset.shortcutUrl));
    });
    home.querySelectorAll('[data-remove-shortcut]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        visibleShortcuts = visibleShortcuts.filter(item => item.title !== button.dataset.removeShortcut);
        localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(visibleShortcuts));
        renderShortcuts();
      });
    });
    const addButton = document.getElementById('addShortcutBtn');
    const menu = document.getElementById('shortcutAddMenu');
    addButton.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      addButton.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.getElementById('closeShortcutMenu').addEventListener('click', () => {
      menu.hidden = true;
      addButton.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('defaultShortcutForm').addEventListener('submit', event => {
      event.preventDefault();
      const selectedTitle = document.getElementById('defaultShortcutSelect').value;
      const shortcut = DEFAULT_SHORTCUTS.find(item => item.title === selectedTitle);
      if (!shortcut || visibleShortcuts.some(item => item.title === shortcut.title)) return;
      visibleShortcuts.push(shortcut);
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(visibleShortcuts));
      renderShortcuts();
    });
    document.getElementById('customShortcutForm').addEventListener('submit', event => {
      event.preventDefault();
      const title = document.getElementById('customShortcutTitle').value.trim();
      let url;
      try {
        url = new URL(document.getElementById('customShortcutUrl').value.trim());
      } catch (_) {
        showToast('Enter a valid website URL', true);
        return;
      }
      if (!title || !['http:', 'https:'].includes(url.protocol)) {
        showToast('Shortcuts must use an http(s) URL', true);
        return;
      }
      if (visibleShortcuts.some(item => item.title.toLowerCase() === title.toLowerCase())) {
        showToast('A shortcut with that name already exists', true);
        return;
      }
      visibleShortcuts.push({ title, url: url.href, domain: url.hostname });
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(visibleShortcuts));
      renderShortcuts();
    });
    home.querySelectorAll('.shortcut-icon').forEach(icon => {
      icon.addEventListener('error', () => {
        const shortcut = visibleShortcuts.find(item => item.title === icon.closest('.shortcut-tile')?.title);
        const fallback = document.createElement('span');
        fallback.className = 'shortcut-glyph';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.textContent = shortcut?.title?.slice(0, 1).toUpperCase() || '?';
        icon.replaceWith(fallback);
      }, { once: true });
    });
  }

  /* ═══ EXTENSIONS & USERSCRIPT ENGINE ═══ */
  async function loadExtensionCatalog() {
    try {
      const response = await fetch(appPath('extensions/scripts/index.json'), { cache: 'no-store' });
      const builtin = await response.json();
      let custom = [];
      try { custom = JSON.parse(localStorage.getItem('superuser-custom-extensions') || '[]'); } catch (_) {}
      extensionCatalog = [
        ...builtin.map(e => ({ ...e, custom: false })),
        ...custom.map(e => ({ ...e, custom: true }))
      ];
    } catch (error) {
      addLog(`Extension catalog unavailable: ${error.message}`, 'warn');
    }
  }

  const _userscriptCache = {};
  const _requireCache = {};

  async function getUserScriptSource(id) {
    if (_userscriptCache[id]) return _userscriptCache[id];
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem('superuser-custom-extensions') || '[]'); } catch (_) {}
    const customMatch = custom.find(x => x.id === id);
    if (customMatch && customMatch.src) {
      _userscriptCache[id] = customMatch.src;
      return customMatch.src;
    }
    try {
      const res = await fetch(appPath(`extensions/scripts/${encodeURIComponent(id)}.js`), { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const src = await res.text();
      _userscriptCache[id] = src;
      return src;
    } catch (e) {
      addLog(`Failed to fetch userscript for ${id}: ${e.message}`, 'err');
      return null;
    }
  }

  function parseUserScriptMeta(src) {
    const meta = { matches: [], requires: [] };
    const block = src.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!block) return meta;
    for (const line of block[1].split('\n')) {
      const m = line.match(/\/\/\s*@([a-zA-Z_-]+)\s+(.+)/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim();
        if (k === 'match' || k === 'include') meta.matches.push(v);
        else if (k === 'require') meta.requires.push(v);
        else if (!meta[k]) meta[k] = v;
      }
    }
    return meta;
  }

  function matchesUrl(pattern, urlStr) {
    if (!pattern || !urlStr) return false;
    try {
      if (pattern === '*' || pattern === '<all_urls>') return true;
      const regexStr = '^' + pattern
        .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&')
        .replace(/\\\*/g, '.*') + '$';
      return new RegExp(regexStr).test(urlStr);
    } catch (_) {
      return false;
    }
  }

  async function installUserscriptFromUrl(url) {
    let rawUrl = url;
    const gfMatch = url.match(/greasyfork\.org\/.*?\/scripts\/(\d+)/);
    if (gfMatch) {
      rawUrl = `https://update.greasyfork.org/scripts/${gfMatch[1]}/${gfMatch[1]}.user.js`;
    }
    showToast('Fetching script from URL…');
    try {
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const src = await res.text();
      const meta = parseUserScriptMeta(src);
      const name = meta.name || rawUrl.split('/').pop().replace(/\.user\.js$/, '') || 'Custom Script';
      let id = meta.id;
      if (!id && meta.matches.length) {
        for (const m of meta.matches) {
          const parts = m.replace(/^\*:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, '');
          if (parts && parts !== '*') { id = parts; break; }
        }
      }
      if (!id) id = name.toLowerCase().replace(/[^a-z0-9]/gi, '_');
      let custom = [];
      try { custom = JSON.parse(localStorage.getItem('superuser-custom-extensions') || '[]'); } catch (_) {}
      const existingIdx = custom.findIndex(e => e.id === id);
      const entry = { id, title: name, url: rawUrl, src, matches: meta.matches };
      if (existingIdx >= 0) custom[existingIdx] = entry;
      else custom.push(entry);
      localStorage.setItem('superuser-custom-extensions', JSON.stringify(custom));
      enabledExtensions[id] = true;
      localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(enabledExtensions));
      delete _userscriptCache[id];
      await loadExtensionCatalog();
      showToast(`Installed: ${name}`);
      addLog(`Installed userscript: ${name} (${id})`, 'ok');
    } catch (e) {
      showToast('Install error: ' + e.message, true);
      addLog(`Failed to install userscript from ${url}: ${e.message}`, 'err');
    }
  }

  function uninstallExtension(id) {
    if (!id) {
      showToast('Usage: sudo ext uninstall <id>', true);
      return;
    }
    let custom = [];
    try { custom = JSON.parse(localStorage.getItem('superuser-custom-extensions') || '[]'); } catch (_) {}
    const initialLen = custom.length;
    custom = custom.filter(e => e.id.toLowerCase() !== id.toLowerCase() && e.title.toLowerCase() !== id.toLowerCase());
    if (custom.length < initialLen) {
      localStorage.setItem('superuser-custom-extensions', JSON.stringify(custom));
      delete enabledExtensions[id];
      delete _userscriptCache[id];
      localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(enabledExtensions));
      loadExtensionCatalog();
      showToast(`Uninstalled: ${id}`);
      addLog(`Uninstalled extension: ${id}`, 'ok');
    } else {
      if (extensionCatalog.some(e => e.id.toLowerCase() === id.toLowerCase())) {
        enabledExtensions[id] = false;
        localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(enabledExtensions));
        showToast(`Disabled built-in extension: ${id}`);
      } else {
        showToast(`Extension "${id}" not found`, true);
      }
    }
  }

  async function injectUserScript(tab, extension) {
    const doc = tab.frame?.contentDocument;
    if (!doc || !doc.documentElement) return;
    if (doc.querySelector(`[data-su-script="${CSS.escape(extension.id)}"]`)) return;
    const src = await getUserScriptSource(extension.id);
    if (!src) return;

    // Parse and fetch @require dependencies
    const reqMatches = [...src.matchAll(/\/\/\s*@require\s+(https?:\/\/\S+)/g)].map(m => m[1]);
    let reqCode = '';
    if (reqMatches.length) {
      const parts = await Promise.all(reqMatches.map(async reqUrl => {
        if (_requireCache[reqUrl]) return _requireCache[reqUrl];
        try {
          const r = await fetch(reqUrl);
          const t = await r.text();
          _requireCache[reqUrl] = t;
          return t;
        } catch (e) {
          console.warn('Failed to load @require', reqUrl, e);
          return '';
        }
      }));
      reqCode = parts.join('\n;\n');
    }

    const scriptEl = doc.createElement('script');
    scriptEl.setAttribute('data-su-script', extension.id);
    const storePrefix = `__gm_${extension.id.replace(/[^a-z0-9]/gi, '_')}_`;

    scriptEl.textContent = `
(function() {
  'use strict';
  // === Full Tampermonkey & Greasemonkey Compatibility Layer ===
  var __targetWindow = (function() { return (typeof window !== 'undefined' ? window : this) || (0, eval)('this') || globalThis; })();
  __targetWindow.unsafeWindow = __targetWindow;
  var unsafeWindow = __targetWindow;

  var _storagePrefix = ${JSON.stringify(storePrefix)};
  function GM_setValue(name, value) {
    try { localStorage.setItem(_storagePrefix + name, JSON.stringify(value)); } catch(e){}
  }
  function GM_getValue(name, defaultValue) {
    try {
      var item = localStorage.getItem(_storagePrefix + name);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch(e) { return defaultValue; }
  }
  function GM_deleteValue(name) {
    try { localStorage.removeItem(_storagePrefix + name); } catch(e){}
  }
  function GM_listValues() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(_storagePrefix) === 0) keys.push(k.substring(_storagePrefix.length));
      }
    } catch(e){}
    return keys;
  }
  function GM_addStyle(css) {
    try {
      var style = document.createElement('style');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
      return style;
    } catch(e) { return null; }
  }
  function GM_setClipboard(data, info) {
    try { navigator.clipboard?.writeText(String(data)).catch(function(){}); } catch(e){}
  }
  function GM_log() {
    try { console.log.apply(console, ['[TM:' + ${JSON.stringify(extension.id)} + ']'].concat(Array.prototype.slice.call(arguments))); } catch(e){}
  }
  function GM_notification(details, ondone) {
    var title = typeof details === 'object' ? details.title : 'SuperUser';
    var text = typeof details === 'object' ? details.text : String(details);
    try { console.log('[Notification: ' + title + ']', text); } catch(e){}
    if (typeof ondone === 'function') setTimeout(ondone, 100);
  }
  function GM_openInTab(url, options) {
    try { window.top.postMessage({ type: 'superuser:create-tab', url: url }, '*'); } catch(_) {}
    return null;
  }
  function GM_registerMenuCommand(caption, commandFunc, accessKey) { return Math.floor(Math.random() * 100000); }
  function GM_unregisterMenuCommand(cmdId) {}
  function GM_getResourceText(name) { return ''; }
  function GM_getResourceURL(name) { return ''; }

  function GM_xmlhttpRequest(details) {
    if (!details || !details.url) return;
    var method = (details.method || 'GET').toUpperCase();
    var headers = details.headers || {};
    var body = details.data || details.body || null;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (details.timeout && controller) {
      timer = setTimeout(function() {
        controller.abort();
        if (typeof details.ontimeout === 'function') details.ontimeout();
      }, details.timeout);
    }
    fetch(details.url, {
      method: method,
      headers: headers,
      body: body,
      signal: controller ? controller.signal : undefined
    }).then(function(res) {
      if (timer) clearTimeout(timer);
      return res.text().then(function(text) {
        var rawHeaders = '';
        try { res.headers.forEach(function(v, k) { rawHeaders += k + ': ' + v + '\\r\\n'; }); } catch(e){}
        var respObj = {
          status: res.status,
          statusText: res.statusText,
          readyState: 4,
          responseText: text,
          response: text,
          responseHeaders: rawHeaders,
          finalUrl: res.url
        };
        if (typeof details.onreadystatechange === 'function') details.onreadystatechange(respObj);
        if (typeof details.onload === 'function') details.onload(respObj);
      });
    }).catch(function(err) {
      if (timer) clearTimeout(timer);
      var errObj = { error: err.message, readyState: 4, status: 0 };
      if (typeof details.onerror === 'function') details.onerror(errObj);
    });
  }

  var GM_info = {
    script: {
      name: ${JSON.stringify(extension.title)},
      version: '1.0',
      namespace: 'http://tampermonkey.net/',
      description: '',
      matches: [${JSON.stringify('*://' + extension.id + '/*')}]
    },
    scriptMetaStr: '',
    scriptHandler: 'Tampermonkey',
    version: '5.1.0'
  };

  var GM = {
    setValue: function(k, v) { return Promise.resolve(GM_setValue(k, v)); },
    getValue: function(k, d) { return Promise.resolve(GM_getValue(k, d)); },
    deleteValue: function(k) { return Promise.resolve(GM_deleteValue(k)); },
    listValues: function() { return Promise.resolve(GM_listValues()); },
    addStyle: function(css) { return Promise.resolve(GM_addStyle(css)); },
    setClipboard: function(d, i) { return Promise.resolve(GM_setClipboard(d, i)); },
    xmlHttpRequest: GM_xmlhttpRequest,
    info: GM_info
  };

  try {
    __targetWindow.unsafeWindow = __targetWindow;
    __targetWindow.GM_setValue = GM_setValue;
    __targetWindow.GM_getValue = GM_getValue;
    __targetWindow.GM_deleteValue = GM_deleteValue;
    __targetWindow.GM_listValues = GM_listValues;
    __targetWindow.GM_addStyle = GM_addStyle;
    __targetWindow.GM_setClipboard = GM_setClipboard;
    __targetWindow.GM_log = GM_log;
    __targetWindow.GM_notification = GM_notification;
    __targetWindow.GM_openInTab = GM_openInTab;
    __targetWindow.GM_registerMenuCommand = GM_registerMenuCommand;
    __targetWindow.GM_unregisterMenuCommand = GM_unregisterMenuCommand;
    __targetWindow.GM_getResourceText = GM_getResourceText;
    __targetWindow.GM_getResourceURL = GM_getResourceURL;
    __targetWindow.GM_xmlhttpRequest = GM_xmlhttpRequest;
    __targetWindow.GM_info = GM_info;
    __targetWindow.GM = GM;
  } catch(e){}

  // === @require dependencies ===
  ${reqCode}

  // Ensure Swal is exposed
  if (typeof Sweetalert2 !== 'undefined') {
    __targetWindow.Swal = __targetWindow.SweetAlert = __targetWindow.sweetAlert = __targetWindow.swal = Sweetalert2;
  }
  var Swal = __targetWindow.Swal;

  // === Userscript Body ===
  ${src}
})();
`;
    try {
      (doc.head || doc.documentElement).appendChild(scriptEl);
      addLog(`Injected userscript: ${extension.title} (${extension.id})`, 'ok');
    } catch (e) {
      addLog(`Script injection error (${extension.id}): ${e.message}`, 'err');
    }
  }

  function offerSiteExtension(tab, host) {
    const tabUrl = tab.url || '';
    const extension = extensionCatalog.find(item => {
      if (host === item.id || host.endsWith(`.${item.id}`)) return true;
      if (Array.isArray(item.matches)) {
        return item.matches.some(p => matchesUrl(p, tabUrl));
      }
      return false;
    });
    if (!extension) return;

    // Auto-inject if the extension is enabled
    if (enabledExtensions[extension.id]) {
      injectUserScript(tab, extension);
      return;
    }

    // Prompt once to enable
    if (tab.extensionPrompted === extension.id) return;
    tab.extensionPrompted = extension.id;
    document.getElementById('extensionPromptText').textContent =
      `${extension.title} is available for this site:`;
    const prompt = document.getElementById('extensionPrompt');
    prompt.classList.add('open');
    const run = document.getElementById('runExtensionBtn');
    const cancel = document.getElementById('cancelExtensionBtn');
    const close = () => prompt.classList.remove('open');
    run.onclick = () => {
      enabledExtensions[extension.id] = true;
      localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(enabledExtensions));
      injectUserScript(tab, extension);
      close();
    };
    cancel.onclick = close;
  }

  /* ═══ BOOKMARKS ENGINE ═══ */
  function getSavedBookmarks() {
    try { return JSON.parse(localStorage.getItem('superuser-bookmarks') || '[]'); } catch (_) { return []; }
  }

  function bookmarkCurrentTab(tab) {
    if (!tab || !tab.url || tab.url === 'home' || tab.url.startsWith('su://bookmarks')) return;
    let bms = getSavedBookmarks();
    const existing = bms.find(b => b.url === tab.url);
    if (existing) {
      showToast('Page already bookmarked');
      return;
    }
    const host = getHost(tab.url);
    const bm = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      title: tab.title || host || 'Bookmark',
      url: tab.url,
      favicon: tab.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`,
      addedAt: Date.now()
    };
    bms.unshift(bm);
    localStorage.setItem('superuser-bookmarks', JSON.stringify(bms));
    renderBookmarksBar();
    showToast(`Bookmarked: ${bm.title}`);
  }

  function renderBookmarksBar() {
    const container = document.getElementById('bookmarksBarItems');
    if (!container) return;
    const bms = getSavedBookmarks();
    if (!bms.length) {
      container.innerHTML = '<span style="color:#52525b;font-size:11px;">No bookmarks yet. Right-click or press ⭐ to add.</span>';
      return;
    }
    container.innerHTML = bms.slice(0, 15).map(bm => {
      let host = 'example.com';
      try { host = new URL(bm.url).hostname; } catch(_) {}
      const icon = bm.favicon || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
      return `
        <button class="bm-bar-item" data-bm-url="${escapeHtml(bm.url)}" title="${escapeHtml(bm.title)} (${escapeHtml(bm.url)})">
          <img src="${escapeHtml(icon)}" alt="" onerror="this.style.display='none'">
          <span>${escapeHtml(bm.title)}</span>
        </button>
      `;
    }).join('');
    container.querySelectorAll('[data-bm-url]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.bmUrl));
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm(`Remove bookmark "${btn.title.split(' (')[0]}"?`)) {
          let updated = getSavedBookmarks().filter(b => b.url !== btn.dataset.bmUrl);
          localStorage.setItem('superuser-bookmarks', JSON.stringify(updated));
          renderBookmarksBar();
          showToast('Bookmark removed');
        }
      });
    });
  }

  /* ═══ 2FA TOTP ENGINE ═══ */
  async function getTotpCode(secret, period = 30, digits = 6) {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const c of secret.toUpperCase().replace(/[\s=]/g, '')) {
      const i = alpha.indexOf(c);
      if (i < 0) continue;
      bits += i.toString(2).padStart(5, '0');
    }
    const keyBytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < keyBytes.length; i++) keyBytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    const counter = BigInt(Math.floor(Date.now() / 1000 / period));
    const cb = new Uint8Array(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) { cb[i] = Number(tmp & 0xffn); tmp >>= 8n; }
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, cb));
    const off = sig[sig.length - 1] & 0x0f;
    const code = ((sig[off] & 0x7f) << 24 | (sig[off + 1] & 0xff) << 16 | (sig[off + 2] & 0xff) << 8 | (sig[off + 3] & 0xff)) % (10 ** digits);
    return String(code).padStart(digits, '0');
  }

  /* ═══ CONTEXT MENU ENGINE ═══ */
  const suContextMenu = document.getElementById('suContextMenu');
  let ctxCurrentTab = null;
  let ctxMatched2FaAccount = null;

  function closeContextMenu() {
    if (suContextMenu) suContextMenu.style.display = 'none';
  }
  document.addEventListener('click', closeContextMenu);
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('#suContextMenu')) return;
    const tab = getActiveTab();
    if (tab && tab.url && tab.url !== 'home') {
      handleContextMenu(e, tab, true);
    }
  });

  function handleContextMenu(e, tab, fromTop = false) {
    e.preventDefault();
    e.stopPropagation();
    ctxCurrentTab = tab;
    let x = e.clientX;
    let y = e.clientY;
    if (!fromTop && tab.frame) {
      const rect = tab.frame.getBoundingClientRect();
      x += rect.left;
      y += rect.top;
    }
    // Check 2FA accounts matching this tab's website
    let accounts = [];
    try { accounts = JSON.parse(localStorage.getItem('superuser-2fa-accounts') || '[]'); } catch (_) {}
    let host = getHost(tab.url || '');
    try { host = new URL(tab.url).hostname; } catch(_) {}
    ctxMatched2FaAccount = accounts.find(acc => acc.website && (host === acc.website || host.endsWith('.' + acc.website) || acc.website.includes(host)));

    const paste2faEl = document.getElementById('ctx-paste2fa');
    if (paste2faEl) {
      if (ctxMatched2FaAccount) {
        paste2faEl.style.display = 'flex';
        paste2faEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>Paste 2FA (${escapeHtml(ctxMatched2FaAccount.name)})`;
      } else {
        paste2faEl.style.display = 'none';
      }
    }

    suContextMenu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    suContextMenu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
    suContextMenu.style.display = 'block';
  }

  document.getElementById('ctx-bookmark')?.addEventListener('click', () => {
    closeContextMenu();
    if (ctxCurrentTab) bookmarkCurrentTab(ctxCurrentTab);
  });
  document.getElementById('ctx-open2fa')?.addEventListener('click', () => {
    closeContextMenu();
    navigate('su://2fa');
  });
  document.getElementById('ctx-extensions')?.addEventListener('click', () => {
    closeContextMenu();
    navigate('su://extensions');
  });
  document.getElementById('ctx-paste2fa')?.addEventListener('click', async () => {
    closeContextMenu();
    if (!ctxMatched2FaAccount || !ctxCurrentTab) return;
    try {
      const code = await getTotpCode(ctxMatched2FaAccount.secret);
      const frameDoc = ctxCurrentTab.frame?.contentDocument;
      const activeEl = frameDoc?.activeElement;
      if (activeEl && ('value' in activeEl)) {
        activeEl.value = code;
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        activeEl.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (activeEl && activeEl.isContentEditable) {
        activeEl.textContent = code;
      }
      navigator.clipboard?.writeText(code).catch(() => {});
      showToast(`Pasted 2FA code: ${code}`);
      addLog(`Pasted 2FA code for ${ctxMatched2FaAccount.name}`, 'ok');
    } catch (err) {
      showToast('Error generating 2FA code', true);
    }
  });

  // Start only after every DOM reference and event handler has been initialized.
  renderWispServer();
  if (settings.wisp && !['auto', 'local'].includes(settings.wisp) &&
      settings.wisp !== OFFICIAL_WISP_URL) {
    document.getElementById('customWispInputPage').value = settings.wisp;
    document.getElementById('customWispInput').value = settings.wisp;
  }
  updateSystemStatus();
  setInterval(updateSystemStatus, 30000);
  setupLearningScreen();
  loadExtensionCatalog();
  renderShortcuts();
  renderBookmarksBar();
  let restoredTabs = false;
  initScramjetProxy().then(ready => {
    if (ready && !restoredTabs) {
      restoredTabs = true;
      if (!restoreTabs()) createTab('home');
    }
  });

  // Launch in about:blank immediately when the page loads (if top-level window)
  window.addEventListener('load', () => {
    const isEmbedded = (() => {
      try { return window.self !== window.top; } catch (_) { return true; }
    })();
    if (!isEmbedded && !sessionStorage.getItem('su_page_blanked')) {
      sessionStorage.setItem('su_page_blanked', '1');
      setTimeout(() => {
        launchInAboutBlank();
      }, 250);
    }
  });
