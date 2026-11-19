import { adapters } from './codecs.js';
import { gatewayContract } from './config.js';
import { WispTransport } from './wisp-transport.js';

const PREFIXES = ['v2', 'v3', 'v4'];

let transport = null;
let streamId = null;
let schema = null;

async function fetchViaWisp(target, formType) {
  if (!transport) {
    transport = new WispTransport(gatewayContract.wispPath);
    await transport.connect();
  }
  if (streamId === null) {
    const host = gatewayContract.origin.replace(/^https?:\/\//, '');
    const port = 443;
    streamId = transport.openStream(host, port, 3); // hostname
  }
  if (!schema) {
    schema = await getRequestSchema(target);
  }
  const payload = await mutateTarget(target, schema);
  transport.requestCredit(streamId, 4); // default credit
  const sent = transport.sendData(streamId, payload);
  if (!sent) return await waitForStream(streamId);
  return streamId;
}

async function getRequestSchema(target) {
  // Simulate schema fetch: always returns a simple schema for demonstration
  return { type: 'object', properties: { url: { type: 'string' } } };
}

async function mutateTarget(target, schema) {
  const encoded = new TextEncoder().encode(target);
  const key = crypto.getRandomValues(new Uint8Array(encoded.length));
  const mutated = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    mutated[i] = encoded[i] ^ key[i];
  }
  return mutated;
}

async function waitForStream(streamId) {
  // Wait for response frames (simplified)
  return await new Promise(resolve => {
    setTimeout(() => {
      resolve({ status: 200, body: new ReadableStream() });
    }, 100);
  });
}

// PostMessage handler for fragment form
setupFragmentHandler();

function setupFragmentHandler() {
  if (typeof window === 'undefined' && typeof self !== 'undefined') {
    self.addEventListener('message', async event => {
      if (event.data && event.data.type === 'NAVIGATE') {
        const target = event.data.target;
        // Determine form type (assume fragment)
        const result = await fetchViaWisp(target, 'fragment');
        event.source?.postMessage({ type: 'RESPONSE', result });
      }
    });
  }
}

// Intercept fetch events under prefixes
if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
  self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const path = url.pathname.substring(1);
    const prefix = PREFIXES.find(p => path.startsWith(`${p}/`));
    if (!prefix) return;
    if (['/admin', '/control', '/shell', '/app', '/index.html', '/manifest.json'].includes(path)) {
      return;
    }

    const formType = detectFormType(event.request.url);
    if (formType === 'fragment') return;

    const target = extractTargetFromUrl(event.request.url, formType);
    event.respondWith(target
      ? fetchViaWisp(target, formType)
      : Promise.resolve(new Response('Invalid target', { status: 400 }))
    );
  });
}

function detectFormType(url) {
  const parsed = new URL(url);
  const path = parsed.pathname;
  const query = parsed.search;
  if (path.match(/^\/\w+\/#[^?#]+$/)) return 'fragment';
  if (path.match(/^\/\w+\/[A-Za-z0-9_-]+$/)) return 'path-b64';
  if (query.startsWith('?u=')) return 'query-b64';
  if (path.match(/^\/\w+\/[^?#]+$/)) return 'path-schemeless';
  if (path.match(/^\/\w+\/[0-9a-f]+$/)) return 'path-hex';
  if (path.match(/^\/eduapi\/\w+\/\w+\/([^/?]+)/)) return 'native';
  return null;
}

function extractTargetFromUrl(url, formType) {
  const parsed = new URL(url);
  const path = parsed.pathname;
  const query = parsed.search;
  switch (formType) {
    case 'path-b64': {
      const match = path.match(/^\/\w+\/([^/?]+)/);
      return match ? adapters['path-b64'].decode(match[1]) : null;
    }
    case 'query-b64': {
      const match = query.match(/\bu=([^&#]+)/);
      return match ? adapters['query-b64'].decode(match[1]) : null;
    }
    case 'path-schemeless': {
      const match = path.match(/^\/\w+\/([^/?]+)/);
      return match ? adapters['path-schemeless'].decode(match[1]) : null;
    }
    case 'path-hex': {
      const match = path.match(/^\/\w+\/([^/?]+)/);
      return match ? adapters['path-hex'].decode(match[1]) : null;
    }
    case 'native': {
      const match = path.match(/^\/eduapi\/\w+\/\w+\/([^/?]+)/);
      return match ? adapters['native'].decode(match[1]) : null;
    }
    default:
      return null;
  }
}

export { fetchViaWisp }; // for tests