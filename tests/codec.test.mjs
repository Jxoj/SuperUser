import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { before, test } from 'node:test';
import { ladder, prefixes } from '../assets/js/config.js';

const records = new Map();
const database = {
  objectStoreNames: { contains: () => true },
  transaction() {
    let transaction;
    const complete = () => queueMicrotask(() => transaction.oncomplete?.());
    const request = result => {
      const item = {};
      queueMicrotask(() => {
        item.result = result();
        item.onsuccess?.();
        complete();
      });
      return item;
    };
    transaction = {
      objectStore() {
        return {
          put(record) {
            records.set(record.hash, record);
            complete();
          },
          get(hash) {
            return request(() => records.get(hash));
          },
          getAll() {
            return request(() => [...records.values()]);
          },
          delete(hash) {
            records.delete(hash);
            complete();
          }
        };
      }
    };
    return transaction;
  }
};

globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = database;
      request.onsuccess?.();
    });
    return request;
  }
};

let adapters;
let registry;
before(async () => {
  ({ adapters, registry } = await import('../assets/js/codecs.js'));
});

test('normalization lowercases only scheme and host', () => {
  assert.equal(
    registry.normalizeTarget('HTTPS://ExAmPlE.COM/Case?Q=UP#Frag'),
    'https://example.com/Case?Q=UP#Frag'
  );
});

test('registry URLs use resource type and target extension while resolving through the hash lookup', async () => {
  const target = 'https://Example.com/scripts/chunk-abc.js?Build=A';
  const normalized = registry.normalizeTarget(target);
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  const encoded = await adapters.registry.encode('/assets/', target);

  assert.equal(encoded, `/assets/js/${hash}.js`);
  assert.equal(
    `/assets/abc12345/${encoded.replace(/^\/assets\//, '')}`,
    `/assets/abc12345/js/${hash}.js`
  );
  assert.equal(await adapters.registry.decode(new URL(encoded, 'https://proxy.test').pathname), target);

  const grouped = await adapters.registry.encode('/pkg/', target);
  assert.equal(grouped, `/pkg/js/${hash}.js`);
  assert.equal(await adapters.registry.decode(new URL(grouped, 'https://proxy.test').pathname), target);
});

test('self-contained URLs hex-encode UTF-8 targets and reject a tampered digest', async () => {
  const target = 'https://example.com/Path/雪.png?x=1';
  const encoded = await adapters['self-contained'].encode('/cdn/', target);
  const parsed = new URL(encoded, 'https://proxy.test');
  const [, prefix, hash, payload] = parsed.pathname.match(/^\/(cdn)\/([0-9a-f]{8})\/([0-9a-f]+)\.png$/);

  assert.equal(prefix, 'cdn');
  assert.equal(registry.decodeHex(payload), target);
  assert.equal(await adapters['self-contained'].decode(parsed.pathname), target);
  const changedHash = `${hash[0] === '0' ? '1' : '0'}${hash.slice(1)}`;
  assert.equal(await adapters['self-contained'].decode(`/cdn/${changedHash}/${payload}.png`), null);
});

test('registry URLs select a path category from the target resource type', () => {
  const examples = [
    ['https://host.test/app.js', 'js'],
    ['https://host.test/page.html', 'html'],
    ['https://host.test/data.json', 'articles'],
    ['https://host.test/app.css', 'css'],
    ['https://host.test/photo.jpg', 'imgs'],
    ['https://host.test/font.woff2', 'files'],
    ['https://host.test/file.jpeg', 'imgs'],
    ['https://host.test/no-extension', 'files']
  ];
  for (const [target, filename] of examples) {
    assert.equal(registry.registryType(target), filename);
  }
});

test('native adapter hides the scheme and encodes the remaining URL', async () => {
  const target = 'https://Example.com/Path?q=UP#frag';
  const encoded = await adapters.native.encode('/assets/', target);
  assert.equal(encoded, '/assets/fv65qma5/1RXhhbXBsZS5jb20vUGF0aD9xPVVQI2ZyYWc');
  assert.equal(adapters.native.decode(encoded), target);
  assert.ok(!encoded.includes('https'));
  assert.ok(!encoded.includes('Example.com'));

  const httpTarget = 'http://example.com/page';
  const httpEncoded = await adapters.native.encode('/assets/', httpTarget);
  assert.equal(adapters.native.decode(httpEncoded), httpTarget);
  assert.ok(httpEncoded.endsWith('/0ZXhhbXBsZS5jb20vcGFnZQ'));
});

test('Scramjet codec encodes HTTP URLs opaquely and preserves other URL schemes', () => {
  const target = 'https://example.com/a.js?x=1';
  const encoded = registry.encodeScramjetUrl(target);
  assert.ok(!encoded.includes('https'));
  assert.ok(!encoded.includes('example.com'));
  assert.equal(registry.decodeScramjetUrl(encoded), target);

  const dataUrl = 'data:text/plain,hello world';
  assert.equal(registry.decodeScramjetUrl(registry.encodeScramjetUrl(dataUrl)), dataUrl);
});

test('all ladder forms are detected and decoded by the request helpers', async () => {
  const { detectFormType, extractTargetFromUrl } = await import('../assets/js/sw-document.js');
  const target = 'https://forms.test/Path/data.json?Case=Yes';
  for (const { form } of ladder) {
    const encoded = await adapters[form].encode('/assets/', target);
    const url = new URL(encoded, 'https://proxy.test');
    assert.equal(detectFormType(url.href), form);
    assert.equal(await extractTargetFromUrl(url.href, form), target);
  }
});

test('service worker routes registry hits to the native Scramjet path and returns 404 on misses', async () => {
  const target = 'https://proxy-target.test/page.html';
  const encoded = await adapters.registry.encode('/assets/', target);
  const listeners = {};
  const scramjetController = {
    shouldRoute: () => true,
    route: async () => new Response('native route')
  };
  const self = {
    location: { href: 'https://proxy.test/sw.js' },
    SuperUserRegistry: registry,
    $scramjetController: scramjetController,
    addEventListener: (type, listener) => { listeners[type] = listener; }
  };
  const source = await readFile(new URL('../assets/js/sw.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    self,
    importScripts() {},
    URL,
    Response,
    console
  });

  async function fetchThroughWorker(path) {
    let responsePromise;
    listeners.fetch({
      request: new Request(`https://proxy.test/assets/abc12345/${path.replace(/^\/+/, '')}`),
      respondWith(response) { responsePromise = response; }
    });
    return responsePromise;
  }

  const hit = await fetchThroughWorker(encoded.replace(/^\/assets\//, ''));
  assert.equal(hit.status, 307);
  assert.equal(hit.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  const hitTarget = 'https://proxy-target.test/page.html';
  const hitEncoded = registry.encodeNativeTarget(hitTarget);
  assert.equal(hit.headers.get('Location'), `https://proxy.test/assets/abc12345/${hitEncoded}`);

  const grouped = await adapters.registry.encode('/pkg/', target);
  assert.equal((await fetchThroughWorker(grouped)).status, 307);

  const miss = await fetchThroughWorker('/js/ffffffffffffffff.html');
  assert.equal(miss.status, 404);

  const selfContained = await adapters['self-contained'].encode('/cdn/', 'https://target.test/page.html');
  const selfContainedPath = new URL(selfContained, 'https://proxy.test').pathname;
  const alteredPath = selfContainedPath.replace(
    /\/([0-9a-f]{8})\//,
    (_match, hash) => `/${hash[0] === '0' ? '1' : '0'}${hash.slice(1)}/`
  );
  assert.equal((await fetchThroughWorker(alteredPath)).status, 404);

  const nativeTarget = 'https://native-target.test/chunk.js';
  const nativeEncoded = (await adapters.native.encode('/assets/', nativeTarget)).split('/').at(-1);
  const nativeResponse = await fetchThroughWorker(`/${nativeEncoded}`);
  assert.equal(await nativeResponse.text(), 'native route');
  const nativeHash = (await registry.digest(nativeTarget)).slice(0, 16);
  assert.equal(await registry.lookupTarget(nativeHash), nativeTarget);
});

test('prefixes rotate and opaque tiers do not reveal the target host', async () => {
  const target = 'https://private.example.org/assets/data.json';
  const prefixes = Array.from({ length: 5 }, () => registry.nextPrefix());
  assert.deepEqual(prefixes, registry.PREFIXES);

  for (const form of ['self-contained', 'fragment', 'path-hex', 'query-b64']) {
    const encoded = await adapters[form].encode('/static/', target);
    assert.ok(!encoded.includes('private.example.org'));
    assert.ok(!encoded.includes('%3A%2F%2F'));
  }
  const queryUrl = await adapters['query-b64'].encode('/assets/', target);
  assert.equal(new URL(queryUrl, 'https://proxy.test').pathname, '/assets/');
  assert.deepEqual(prefixes, registry.PREFIXES);
  assert.deepEqual(ladder.map(({ form }) => form), [
    'registry', 'self-contained', 'fragment', 'path-hex', 'query-b64', 'native'
  ]);
});

test('registry evicts least-recently-used entries at the 5000-entry cap', async () => {
  records.clear();
  for (let index = 0; index < registry.MAX_ENTRIES; index += 1) {
    const hash = index.toString(16).padStart(16, '0');
    await registry.recordTarget(`https://host.test/${index}`, hash);
  }
  assert.equal(await registry.lookupTarget('0000000000000000'), 'https://host.test/0');
  await registry.recordTarget('https://host.test/5000', '0000000000001388');

  assert.equal(records.size, 5000);
  assert.equal(await registry.lookupTarget('0000000000000000'), 'https://host.test/0');
  assert.equal(await registry.lookupTarget('0000000000000001'), null);
  assert.equal(await registry.lookupTarget('0000000000001388'), 'https://host.test/5000');
});
