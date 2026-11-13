// Scramjet service worker and offline app-shell cache.
importScripts(new URL("./controller/controller.sw.js", self.location.href).href);

const APP_BASE = new URL("./", self.location.href);
const CACHE_PREFIX = `superuser-shell:${APP_BASE.pathname}`;
const CACHE_NAME = `${CACHE_PREFIX}:v2`;
const SHELL_FILES = [
  "index.html",
  "controller/controller.api.js",
  "controller/controller.inject.js",
  "controller/controller.sw.js",
  "controller/epoxy.js",
  "scramjet/scramjet.js",
  "scramjet/scramjet.wasm",
  "extensions/scripts/index.json",
  "internals/games/index.html",
  "internals/games/providers.json",
  "Mockups/learning.html",
];
const SHELL_URLS = SHELL_FILES.map((path) => new URL(path, APP_BASE));
const INDEX_URL = new URL("index.html", APP_BASE);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch (error) {
        console.warn("Offline app-shell cache skipped:", url.href, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function serveAppNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  let cached = await cache.match(INDEX_URL);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(INDEX_URL, response.clone());
      return response;
    }
    if (cached) return cached;
    return response;
  } catch (error) {
    cached = cached || await cache.match(INDEX_URL);
    if (cached) return cached;
    throw error;
  }
}

async function serveShellAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
    return;
  }

  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE.pathname)) return;

  if (request.mode === "navigate" &&
      (url.pathname === APP_BASE.pathname || url.pathname === INDEX_URL.pathname)) {
    event.respondWith(serveAppNavigation(request));
    return;
  }

  if (SHELL_URLS.some((shellUrl) => shellUrl.pathname === url.pathname)) {
    event.respondWith(serveShellAsset(request));
  }
});
