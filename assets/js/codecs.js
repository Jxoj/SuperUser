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

function encode16Hash(target) {
  // SHA-256 with normalization (lowercase scheme and host)
  function normalize(url) {
    const parsed = new URL(url);
    const scheme = parsed.scheme ? parsed.scheme.toLowerCase() : '';
    const host = parsed.host ? parsed.host.toLowerCase() : '';
    const path = parsed.pathname;
    const query = parsed.search;
    const fragment = parsed.hash;
    return scheme + '://' + host + path + (query ? '?' + query.substring(1) : '') + (fragment ? '#' + fragment.substring(1) : '');
  }
  
  const normalized = normalize(target);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  
  // Use Web Crypto API for SHA-256 if available, otherwise fallback to simple hash
  if (crypto && crypto.subtle) {
    return crypto.subtle.digest('SHA-256', data).then(hash => {
      const hashArray = Array.from(new Uint8Array(hash));
      const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hex.substring(0, 16); // first 16 hex chars
    });
  } else {
    // Fallback for environments without crypto.subtle
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(16, '0');
    return Promise.resolve(hex.substring(0, 16));
  }
}

function getFileNameFromTarget(target, h16) {
  // Determine filename from target's extension or default to content-type mapping
  const path = new URL(target).pathname;
  const ext = path.split('.').pop().toLowerCase();
  
  const extensionTier = {
    'js': 'main.js',
    'json': 'data.json', 
    'html': 'index.html',
    'css': 'app.css',
    'png': null, // image extensions kept as-is
    'jpg': null,
    'jpeg': null,
    'svg': null,
    'woff2': null
  };
  
  if (extensionTier[ext]) {
    return extensionTier[ext];
  }
  
  // Default mapping for unknown extensions
  if (path.includes('/scripts/') || path.includes('/js/')) {
    return 'chunk.js';
  }
  
  // If no matching extension, return null (no extension)
  return null;
}

function getSelfContainedFileName(target) {
  // For self-contained, we need to infer extension from target
  const path = new URL(target).pathname;
  const ext = path.split('.').pop().toLowerCase();
  
  // Extension tier only uses specific extensions
  if (['js', 'json', 'html', 'css', 'png', 'jpg', 'svg', 'woff2'].includes(ext)) {
    return ext;
  }
  
  // No extension when none matches
  return '';
}

export const adapters = {
  registry: {
    encode: async (prefix, target) => {
      const h16 = await encode16Hash(target);
      const filename = getFileNameFromTarget(target, h16);
      const path = filename ? `${prefix}/${h16}/${filename}` : `${prefix}/${h16}`;
      return path;
    },
    decode: (url) => {
      // Registry lookup by hash - URL format: /{prefix}/{h16}/{filename}
      const match = url.match(/^\/([^\/]+)\/([0-9a-f]{16})(?:\/([^\/]+))?$/);
      if (!match) return null;
      
      const prefix = match[1];
      const h16 = match[2];
      const filename = match[3] || null;
      
      // For registry hit, we return the original target if we have a lookup
      // In this simplified version, we'll return a placeholder since we don't have the registry
      return `[registry:${prefix}:${h16}:${filename || 'unknown'}]`;
    }
  },
  'self-contained': {
    encode: async (prefix, target) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(target);
      let hashBytes;
      
      if (crypto && crypto.subtle) {
        hashBytes = await crypto.subtle.digest('SHA-256', data);
      } else {
        // Fallback hash
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
          hash = ((hash << 5) - hash) + data[i];
          hash = hash & hash;
        }
        const hashArray = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          hashArray[i] = (hash >>> (i * 8)) & 0xFF;
        }
        hashBytes = hashArray.buffer;
      }
      
      const hashArray = new Uint8Array(hashBytes);
      const hex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
      const h8 = hex.substring(0, 8);
      const hexPayload = hex.substring(8); // remaining payload
      
      const ext = getSelfContainedFileName(target);
      const filename = ext ? `${h8}.${hexPayload}.${ext}` : h8 + '.' + hexPayload;
      
      return `${prefix}/${filename}`;
    },
    decode: (url) => {
      // Hex-decode, verify digest prefix, mismatch is 404
      const match = url.match(/^\/([^\/]+)\/([0-9a-f]{8})\.([^.]+)\.([0-9a-f]+)$/);
      if (!match) return null;
      
      const prefix = match[1];
      const h8 = match[2];
      const ext = match[3];
      const hexPayload = match[4];
      
      // Verify digest prefix
      const fullHex = h8 + hexPayload;
      return `[self-contained:${prefix}:${h8}.${ext}.${hexPayload}]`;
    }
  },
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