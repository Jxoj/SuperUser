import { prefixes } from './config.js';

const CONTROL_PAGES = ['/admin', '/control', '/shell'];
const APP_SHELL = ['/app', '/index.html', '/manifest.json'];

let registration = null;

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      await navigator.serviceWorker.ready;
      if (registration && 'clients' in registration) {
        registration.clients.claim();
      }
      console.log('SW registered');
      setupNavigationInterceptor();
    } catch (e) {
      console.error('SW registration failed', e);
    }
  }
}

function setupNavigationInterceptor() {
  if (!registration || !('navigationPreload' in registration)) return;
  self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const pathPrefix = prefixes.find(p => url.pathname.startsWith(`/${p}/`));
    if (!pathPrefix) return;
    const path = url.pathname.substring(1);
    if (CONTROL_PAGES.includes(path) || APP_SHELL.includes(path)) {
      return;
    }
    event.respondWith(fetchViaWisp(url));
  });
}

async function fetchViaWisp(url) {
  const path = url.pathname.substring(1);
  const prefixMatch = prefixes.find(p => path.startsWith(`${p}/`));
  if (!prefixMatch) return new Response('Unsupported prefix', { status: 400 });
  const prefix = prefixMatch;
  const encoded = Array.from(new TextEncoder().encode(url.href), b => b.toString(16).padStart(2, '0')).join('');
  const target = `/${prefix}/#${encoded}`;
  if (isFragmentForm(target)) {
    const channel = new BroadcastChannel('wisp-control');
    channel.postMessage({ type: 'NAVIGATE', target });
    channel.close();
    return await waitForResponse(target);
  }
  return await fetchViaWispPath(target);
}

function isFragmentForm(target) {
  return /^\/[a-zA-Z0-9-]+\/#[^?#]+$/.test(target);
}

async function fetchViaWispPath(target) {
  const adapter = detectAdapter(target);
  const wispPath = adapters[adapter].encode(prefix, target.split('/').pop());
  const fullUrl = gatewayContract.wispPath + wispPath;
  const response = await fetchWispTransport(fullUrl);
  if (!response.ok) return response;
  const body = await response.clone().arrayBuffer();
  const { blocked } = await detectFingerprint(body);
  if (blocked) {
    return new Response('Blocked by fingerprint', { status: 451 });
  }
  return new Response(response.body, { headers: response.headers });
}

const gatewayContract = { wispPath: '/eduapi/wisp/' };
const adapters = {};
async function fetchWispTransport(url) { return fetch(url); }
async function detectFingerprint(body) { return { blocked: false }; }
function waitForResponse(target) { return new Promise(resolve => setTimeout(() => resolve(new Response('OK')), 0)); }

addEventListener('install', event => {
  event.waitUntil(registerSW());
});

addEventListener('activate', event => {
  event.waitUntil(clientsClaim());
});

function clientsClaim() {
  if (registration && 'clients' in registration) {
    return registration.clients.claim();
  }
  return Promise.resolve();
}