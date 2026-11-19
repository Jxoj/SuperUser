import { adapters, registry } from './codecs.js';

function detectFormType(url) {
  const parsed = new URL(url, globalThis.location?.origin || 'https://localhost');
  return registry.classifyPath(parsed.pathname, parsed.search, parsed.hash);
}

async function extractTargetFromUrl(url, formType = detectFormType(url)) {
  const parsed = new URL(url, globalThis.location?.origin || 'https://localhost');
  switch (formType) {
    case 'registry':
      return adapters.registry.decode(parsed.pathname);
    case 'self-contained':
      return adapters['self-contained'].decode(parsed.pathname);
    case 'fragment':
      return adapters.fragment.decode(parsed.href);
    case 'path-hex':
      return adapters['path-hex'].decode(parsed.pathname);
    case 'query-b64':
      return adapters['query-b64'].decode(parsed.search);
    case 'native':
      return adapters.native.decode(parsed.href);
    default:
      return null;
  }
}

export { detectFormType, extractTargetFromUrl };
