importScripts(new URL('./registry.js', new URL('./assets/js/', self.location.href)).href);
importScripts(new URL('./controller/controller.sw.js', self.location.href).href);

const scramjetController = self.$scramjetController;
if (!scramjetController) {
  throw new Error('Failed to load the Scramjet service worker controller.');
}

const frameRoot = new URL('eduapi/', self.location.href).pathname;

function getCodecRoute(url) {
  if (!url.pathname.startsWith(frameRoot)) return null;
  const remainder = url.pathname.slice(frameRoot.length);
  const separator = remainder.indexOf('/');
  if (separator < 0) return null;
  const frameId = remainder.slice(0, separator);
  if (!/^[a-z0-9]{8}$/i.test(frameId)) return null;

  const framePrefix = `${frameRoot}${frameId}/`;
  const pathname = `/${remainder.slice(separator + 1)}`;
  const form = self.SuperUserRegistry.classifyPath(pathname, url.search, url.hash);
  const isCodecNamespace = self.SuperUserRegistry.PREFIXES.some(prefix =>
    pathname.startsWith(prefix)
  );
  return isCodecNamespace ? { framePrefix, pathname, form } : null;
}

function notFound() {
  return new Response('Not found', { status: 404 });
}

function getNativeTarget(url) {
  if (!url.pathname.startsWith(frameRoot)) return null;
  const remainder = url.pathname.slice(frameRoot.length);
  const separator = remainder.indexOf('/');
  if (separator < 0 || !/^[a-z0-9]{8}$/i.test(remainder.slice(0, separator))) return null;
  const encodedTarget = remainder.slice(separator + 1).split('?', 1)[0];
  try {
    const target = decodeURIComponent(encodedTarget);
    return /^https?:\/\//i.test(target) ? target : null;
  } catch {
    return null;
  }
}

async function routeCodecRequest(request, url, route) {
  if (
    request.method !== 'GET' ||
    (route.form !== 'registry' && route.form !== 'self-contained')
  ) {
    return notFound();
  }

  let resolved;
  try {
    resolved = await self.SuperUserRegistry.resolveEncodedPath(route.pathname);
  } catch (error) {
    console.error('Could not resolve hashed URL through IndexedDB:', error);
    return new Response('URL registry unavailable', { status: 500 });
  }
  const target = resolved?.target;
  if (!self.SuperUserRegistry.isHttpTarget(target)) return notFound();

  const nativePath = `${route.framePrefix}${encodeURIComponent(target)}`;
  const nativeUrl = new URL(nativePath, url.origin);
  return new Response(null, {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      Location: nativeUrl.href
    }
  });
}

async function routeNativeRequest(event, url) {
  const target = getNativeTarget(url);
  if (target) {
    try {
      await self.SuperUserRegistry.recordFetch(target);
    } catch (error) {
      console.error('Could not record proxied target in URL registry:', error);
    }
  }
  return scramjetController.route(event);
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const codecRoute = getCodecRoute(url);
  if (codecRoute) {
    event.respondWith(routeCodecRequest(event.request, url, codecRoute));
    return;
  }
  if (scramjetController.shouldRoute(event)) {
    event.respondWith(routeNativeRequest(event, url));
  }
});
