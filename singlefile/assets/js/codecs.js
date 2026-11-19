import './registry.js';
import { gatewayContract } from './config.js';

const registry = globalThis.SuperUserRegistry;
if (!registry) throw new Error('URL registry helper did not initialize');

export const adapters = {
  registry: {
    encode: (prefix, target) => registry.encodeRegistry(prefix, target),
    decode: pathname => registry.decodeRegistry(pathname)
  },
  'self-contained': {
    encode: (prefix, target) => registry.encodeSelfContained(prefix, target),
    decode: pathname => registry.decodeSelfContained(pathname)
  },
  fragment: {
    encode: (prefix, target) => registry.encodeFragment(prefix, target),
    decode: url => {
      const parsed = new URL(url, globalThis.location?.origin || 'https://localhost');
      return registry.decodeBase64Url(parsed.hash.slice(1));
    }
  },
  'path-hex': {
    encode: (prefix, target) => registry.encodePathHex(prefix, target),
    decode: pathname => registry.decodePath(pathname, 'path-hex')
  },
  'query-b64': {
    encode: (prefix, target) => registry.encodeQueryBase64(prefix, target),
    decode: search => registry.decodeBase64Url(new URLSearchParams(search).get('u') || '')
  },
  native: {
    encode: (_prefix, target) =>
      registry.encodeNative(null, target, gatewayContract.pathTemplate, gatewayContract.segments),
    decode: url => {
      const parsed = new URL(url, globalThis.location?.origin || 'https://localhost');
      const expression = new RegExp(
        `^${gatewayContract.pathTemplate
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace('\\{seg1\\}', gatewayContract.segments[0])
          .replace('\\{seg2\\}', gatewayContract.segments[1])
          .replace('\\{target\\}', '(.+)')}$`
      );
      const match = expression.exec(parsed.pathname);
      if (!match) return null;
      return registry.decodeNative(match[1]);
    }
  }
};

export { registry };
