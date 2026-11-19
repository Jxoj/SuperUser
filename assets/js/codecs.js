import { gatewayContract } from './config.js';

function encodeB64Url(str) {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeB64Url(encoded) {
  const pad = encoded.length % 4;
  const actual = pad ? encoded + '='.repeat(4 - pad) : encoded;
  return atob(actual.replace(/-/g, '+').replace(/_/g, '/'));
}

function encodeHex(str) {
  return Array.from(str, c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

function decodeHex(hex) {
  return hex.match(/.{2}/g).map(b => String.fromCharCode(parseInt(b, 16))).join('');
}

function encodePercent(str) {
  return encodeURIComponent(str);
}

function decodePercent(encoded) {
  return decodeURIComponent(encoded);
}

export const adapters = {
  fragment: {
    encode: (prefix, target) => {
      const b64 = encodeB64Url(target);
      return `${prefix}/#${b64}`;
    },
    decode: (url) => {
      const match = url.match(/^#([^?#]+)$/);
      return match ? decodeB64Url(match[1]) : null;
    }
  },
  'path-b64': {
    encode: (prefix, target) => {
      const b64 = encodeB64Url(target);
      return `${prefix}/${b64}`;
    },
    decode: (path) => {
      const match = path.match(/^([^/]+)/);
      return match ? decodeB64Url(match[1]) : null;
    }
  },
  'query-b64': {
    encode: (prefix, target) => {
      const b64 = encodeB64Url(target);
      return `${prefix}?u=${b64}`;
    },
    decode: (url) => {
      const match = url.match(/\bu=([^#]+)/);
      return match ? decodeB64Url(match[1]) : null;
    }
  },
  'path-schemeless': {
    encode: (prefix, target) => {
      const pct = encodePercent(target).replace(/%3A%2F%2F/g, '');
      return `${prefix}/${pct}`;
    },
    decode: (path) => {
      const match = path.match(/^([^/]+)/);
      return match ? decodePercent(match[1]) : null;
    }
  },
  'path-hex': {
    encode: (prefix, target) => {
      const hex = encodeHex(target);
      return `${prefix}/${hex}`;
    },
    decode: (path) => {
      const match = path.match(/^([^/]+)/);
      return match ? decodeHex(match[1]) : null;
    }
  },
  native: {
    encode: (prefix, target) => {
      const pct = encodePercent(target);
      return `${gatewayContract.pathTemplate.replace('{seg1}', gatewayContract.segments[0]).replace('{seg2}', gatewayContract.segments[1])}/${pct}`;
    },
    decode: (url) => {
      const match = url.match(new RegExp(`^${gatewayContract.segments[0]}/${gatewayContract.segments[1]}/([^/]+)$`));
      return match ? decodePercent(match[1]) : null;
    }
  }
};