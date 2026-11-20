(() => {
  const DATABASE = 'superuser-url-registry';
  const STORE = 'targets';
  const MAX_ENTRIES = 5000;
  const PREFIXES = ['/assets/', '/static/', '/cdn/', '/pkg/', '/_next/static/'];
  let databasePromise;
  let accessClock = 0;
  let prefixIndex = 0;

  function normalizeTarget(target) {
    if (typeof target !== 'string') throw new TypeError('Target must be a URL string');
    const parsed = new URL(target);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new TypeError('Target must use http or https');
    }
    const match = /^([a-z][a-z\d+.-]*:)\/\/([^/?#]+)([\s\S]*)$/i.exec(target);
    if (!match) throw new TypeError('Target must be an absolute URL');
    const at = match[2].lastIndexOf('@');
    const authority = at < 0
      ? match[2].toLowerCase()
      : `${match[2].slice(0, at + 1)}${match[2].slice(at + 1).toLowerCase()}`;
    return `${match[1].toLowerCase()}//${authority}${match[3]}`;
  }

  function isHttpTarget(target) {
    if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) return false;
    try {
      return ['http:', 'https:'].includes(new URL(target).protocol);
    } catch {
      return false;
    }
  }

  async function digest(target) {
    if (!globalThis.crypto?.subtle) {
      throw new Error('SHA-256 requires Web Crypto in a secure context');
    }
    const bytes = new TextEncoder().encode(normalizeTarget(target));
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function nextPrefix() {
    const prefix = PREFIXES[prefixIndex % PREFIXES.length];
    prefixIndex += 1;
    return prefix;
  }

  function normalizePrefix(prefix) {
    const normalized = `/${String(prefix).replace(/^\/+|\/+$/g, '')}/`;
    if (!PREFIXES.includes(normalized)) throw new TypeError(`Unsupported URL prefix: ${prefix}`);
    return normalized;
  }

  function targetExtension(target) {
    const pathname = new URL(target).pathname;
    const match = /\.([a-z\d]+)$/i.exec(pathname);
    if (!match) return '';
    const extension = match[1].toLowerCase();
    return ['js', 'json', 'html', 'htm', 'css', 'png', 'jpg', 'jpeg', 'svg', 'woff2', 'webp', 'gif', 'ico'].includes(extension)
      ? extension
      : '';
  }

  function registryType(target) {
    const extension = targetExtension(target);
    if (extension === 'js') return 'js';
    if (extension === 'css') return 'css';
    if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'ico'].includes(extension)) return 'imgs';
    if (['html', 'htm'].includes(extension)) return 'html';
    if (['json', 'xml'].includes(extension)) return 'articles';
    return 'files';
  }

  function encodeHex(value) {
    return Array.from(new TextEncoder().encode(value), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function decodeHex(hex) {
    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }

  function encodeBase64Url(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  function decodeBase64Url(value) {
    if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
    try {
      const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  }

  function openDatabase() {
    if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable'));
    if (databasePromise) return databasePromise;
    const opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'hash' });
          store.createIndex('lastAccessed', 'lastAccessed');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open URL registry'));
    });
    databasePromise = opening.catch(error => {
      databasePromise = undefined;
      throw error;
    });
    return databasePromise;
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error || new Error('URL registry transaction aborted'));
      transaction.onerror = () => reject(transaction.error || new Error('URL registry transaction failed'));
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('URL registry request failed'));
    });
  }

  async function nextAccessTime(store, records) {
    if (!accessClock) {
      const current = records || await requestResult(store.getAll());
      accessClock = current.reduce((latest, record) => Math.max(latest, record.lastAccessed || 0), 0);
    }
    accessClock = Math.max(Date.now(), accessClock + 1);
    return accessClock;
  }

  async function recordTarget(target, hash) {
    const db = await openDatabase();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    const records = await requestResult(store.getAll());
    const record = { hash, target, lastAccessed: await nextAccessTime(store, records) };
    store.put(record);
    const updatedRecords = records.filter(existing => existing.hash !== hash).concat(record);
    if (updatedRecords.length > MAX_ENTRIES) {
      updatedRecords.sort((left, right) => left.lastAccessed - right.lastAccessed);
      for (const stale of updatedRecords.slice(0, updatedRecords.length - MAX_ENTRIES)) {
        store.delete(stale.hash);
      }
    }
    await done;
  }

  async function lookupTarget(hash) {
    if (!/^[0-9a-f]{16}$/.test(hash)) return null;
    const db = await openDatabase();
    const transaction = db.transaction(STORE, 'readwrite');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(STORE);
    const record = await requestResult(store.get(hash));
    if (record) {
      record.lastAccessed = await nextAccessTime(store);
      store.put(record);
    }
    await done;
    return record?.target || null;
  }

  async function recordFetch(target) {
    const hash = (await digest(target)).slice(0, 16);
    await recordTarget(target, hash);
  }

  async function encodeRegistry(_prefix, target) {
    const normalizedPrefix = normalizePrefix(_prefix);
    const hash = (await digest(target)).slice(0, 16);
    await recordTarget(target, hash);
    const extension = targetExtension(target) || 'bin';
    return `${normalizedPrefix}${registryType(target)}/${hash}.${extension}`;
  }

  async function decodeRegistry(pathname) {
    const match = matchRegistryPath(pathname);
    if (!match) return null;
    const target = await lookupTarget(match.hash);
    if (!isHttpTarget(target) || (await digest(target)).slice(0, 16) !== match.hash) return null;
    if (registryType(target) !== match.type || (targetExtension(target) || 'bin') !== match.extension) return null;
    return target;
  }

  function matchRegistryPath(pathname) {
    const match = /^\/(?:(?:assets|pkg|imgs|articles)\/)?(js|css|imgs|backgrounds|html|articles|files)\/([0-9a-f]{16})\.([a-z\d]+)$/i.exec(pathname);
    return match
      ? { type: match[1].toLowerCase(), hash: match[2], extension: match[3].toLowerCase() }
      : null;
  }

  async function encodeSelfContained(prefix, target) {
    const normalizedPrefix = normalizePrefix(prefix);
    const fullHash = await digest(target);
    const hash = fullHash.slice(0, 8);
    await recordTarget(target, fullHash.slice(0, 16));
    const extension = targetExtension(target);
    const payload = encodeHex(target);
    return `${normalizedPrefix}${hash}/${payload}${extension ? `.${extension}` : ''}`;
  }

  async function decodeSelfContained(pathname) {
    for (const prefix of [...PREFIXES].sort((a, b) => b.length - a.length)) {
      if (!pathname.startsWith(prefix)) continue;
      const match = /^([0-9a-f]{8})\/([0-9a-f]+)(?:\.([a-z\d]+))?$/.exec(pathname.slice(prefix.length));
      if (!match) return null;
      const target = decodeHex(match[2]);
      if (!isHttpTarget(target)) return null;
      const extension = targetExtension(target);
      if ((match[3] || '') !== extension) return null;
      const fullHash = await digest(target);
      if (fullHash.slice(0, 8) !== match[1]) return null;
      await recordTarget(target, fullHash.slice(0, 16));
      return target;
    }
    return null;
  }

  function decodePath(pathname, form) {
    const prefixes = [...PREFIXES].sort((a, b) => b.length - a.length);
    for (const prefix of prefixes) {
      if (!pathname.startsWith(prefix)) continue;
      const payload = pathname.slice(prefix.length);
      if (form === 'path-hex') return decodeHex(payload);
      if (form === 'fragment') return decodeBase64Url(payload);
      return null;
    }
    return null;
  }

  async function encodeFragment(prefix, target) {
    await recordFetch(target);
    return `${normalizePrefix(prefix)}#${encodeBase64Url(target)}`;
  }

  async function encodePathHex(prefix, target) {
    await recordFetch(target);
    return `${normalizePrefix(prefix)}${encodeHex(target)}`;
  }

  async function encodeQueryBase64(prefix, target) {
    await recordFetch(target);
    return `${normalizePrefix(prefix)}?u=${encodeBase64Url(target)}`;
  }

  async function encodeNative(_prefix, target, pathTemplate, segments) {
    const encodedTarget = encodeNativeTarget(target);
    return `${pathTemplate
      .replace('{seg1}', segments[0])
      .replace('{seg2}', segments[1])
      .replace('{target}', encodedTarget)}`;
  }

  function encodeNativeTarget(target) {
    if (!isHttpTarget(target)) throw new TypeError('Target must use http or https');
    const protocolMarker = target.toLowerCase().startsWith('https://') ? '1' : '0';
    const remainderStart = protocolMarker === '1' ? 'https://'.length : 'http://'.length;
    return `${protocolMarker}${encodeBase64Url(target.slice(remainderStart))}`;
  }

  function decodeNative(encodedTarget) {
    if (typeof encodedTarget !== 'string') return null;
    const match = /^([01])([A-Za-z0-9_-]+)$/.exec(encodedTarget);
    if (!match) return null;
    const remainder = decodeBase64Url(match[2]);
    if (!remainder) return null;
    const target = `${match[1] === '1' ? 'https://' : 'http://'}${remainder}`;
    return isHttpTarget(target) ? target : null;
  }

  function encodeScramjetUrl(value) {
    if (!value) return value;
    return isHttpTarget(value) ? encodeNativeTarget(value) : encodeURIComponent(value);
  }

  function decodeScramjetUrl(value) {
    if (!value) return value;
    return decodeNative(value) || decodeURIComponent(value);
  }

  function classifyPath(pathname, search = '', hash = '') {
    if (matchRegistryPath(pathname)) return 'registry';
    if (/^\/assets\/[a-z\d]{8}\/[01][a-z\d_-]+$/i.test(pathname)) return 'native';
    for (const prefix of [...PREFIXES].sort((a, b) => b.length - a.length)) {
      if (!pathname.startsWith(prefix)) continue;
      const payload = pathname.slice(prefix.length);
      if (/^[0-9a-f]{8}\/[0-9a-f]+(?:\.[a-z\d]+)?$/i.test(payload)) return 'self-contained';
      if (hash && !search && !pathname.slice(prefix.length)) return 'fragment';
      if (/^[0-9a-f]+$/i.test(payload)) return 'path-hex';
      if (search.startsWith('?u=')) return 'query-b64';
      return null;
    }
    return null;
  }

  async function resolveEncodedPath(pathname, search = '', hash = '') {
    const form = classifyPath(pathname, search, hash);
    if (form === 'registry') return { form, target: await decodeRegistry(pathname) };
    if (form === 'self-contained') return { form, target: await decodeSelfContained(pathname) };
    if (form === 'path-hex') return { form, target: decodePath(pathname, form) };
    if (form === 'query-b64') {
      return { form, target: decodeBase64Url(new URLSearchParams(search).get('u') || '') };
    }
    if (form === 'fragment') return { form, target: decodeBase64Url(hash.slice(1)) };
    return form ? { form, target: null } : null;
  }

  globalThis.SuperUserRegistry = Object.freeze({
    MAX_ENTRIES,
    PREFIXES: Object.freeze(PREFIXES),
    classifyPath,
    decodeBase64Url,
    decodeHex,
    decodeNative,
    decodeScramjetUrl,
    decodePath,
    decodeRegistry,
    decodeSelfContained,
    digest,
    encodeBase64Url,
    encodeHex,
    encodeNativeTarget,
    encodeScramjetUrl,
    encodeFragment,
    encodeNative,
    encodePathHex,
    encodeQueryBase64,
    encodeRegistry,
    encodeSelfContained,
    isHttpTarget,
    lookupTarget,
    matchRegistryPath,
    nextPrefix,
    normalizePrefix,
    normalizeTarget,
    recordTarget,
    recordFetch,
    registryType,
    resolveEncodedPath,
    targetExtension
  });
})();
