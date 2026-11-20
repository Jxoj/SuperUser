# SuperUser Proxy Client Implementation

## Overview

This is a client-side implementation of the SuperUser Proxy architecture, designed to bypass network-based filtering through a novel set of URL encoding schemes and a service worker that intercepts navigation events.

## Architecture Components

### 1. Core Contract

The gateway contract defines the baseline configuration:

```javascript
export const gatewayContract = {
  origin: 'https://superuser.netlify.app',
  pathTemplate: '/assets/{seg1}/{target}',
  segments: ['fv65qma5'],   // Scramjet frame segment
  wispPath: '/eduapi/wisp/',
  targetEncoding: 'percent',
  probe: { path: '/capabilities', method: 'POST',
           body: { action: 'query_form_mutation_support' },
           okField: 'polymorphicFormMutation' }
};
```

### 2. URL Forms and Ladder

Six encoding forms, evaluated in this order:

1. **registry** - `/{type}/{h16}.{ext}`: IndexedDB lookup by the first 16 hex digits of SHA-256
2. **self-contained** - `/{prefix}/{h8}/{hexPayload}.{ext}`: UTF-8 target encoded as hex; the first 8 hash digits are verified
3. **fragment** - `/{prefix}/#<b64url>`: Target stays out of the network request
4. **path-hex** - `/{prefix}/<hex>`: UTF-8 target encoded as hexadecimal
5. **query-b64** - `/{prefix}?u=<b64url>`: Base64url-encoded target in the query
6. **native** - `/assets/{frame}/<encoded URL>`: Guaranteed baseline when nothing else lands

The Scramjet frame prefix is `/assets/{frame}/`. Encoded registry paths are
appended below it, for example `/assets/{frame}/js/{h16}.js` or
`/assets/{frame}/pkg/js/{h16}.js`; the outer category rotates among
`assets`, `pkg`, `imgs`, and `articles`. Resource types include `js`, `css`,
`imgs`, `html`, `articles`, and `files`; the suffix mirrors a supported file extension.
Hashes use the target URL with only its scheme and host lowercased. The registry
is capped at 5,000 targets and evicts least-recently used entries. Registry
misses and invalid self-contained hashes return 404; they are never guessed.
Successful hashed-route responses use
`Cache-Control: public, max-age=31536000, immutable`.

### 3. Protocol Implementation

#### Frame Protocol

Binary WebSocket frames follow a strict schema:

```
[type byte][stream id varint][payload]

0x01 CONNECT   payload: 2-byte BE port, 1-byte addr type (1=v4, 2=v6, 3=hostname), address bytes
0x02 DATA      payload: raw bytes
0x03 CONTINUE  payload: none, credit grant
0x04 CLOSE     payload: reason byte
0x05 INFO      payload: UTF-8, out of band
```

Key features:
- Client allocates odd stream IDs, server even
- State machine parser handles malformed input gracefully
- Credit system prevents network flooding
- LEB128 varint encoding with bounds checking

#### Mutation Protocol

Each request includes a length-prefixed JSON schema inside the DATA payload:

```
[4-byte length][JSON schema][mutated payload]
```

The schema is cryptographically signed using XOR rotation from `crypto.getRandomValues`.

### 4. Core Files

| File | Purpose |
|------|---------|
| `assets/js/config.js` | Contract, prefixes, ladder, mode configuration |
| `assets/js/codecs.js` | Encode/decode pairs for URL forms |
| `assets/js/registry.js` | Shared SHA-256, IndexedDB LRU registry, and URL-form helpers |
| `assets/js/wisp-frames.js` | Experimental Wisp frame encoder and parser |
| `assets/js/wisp-transport.js` | Experimental Wisp WebSocket transport |
| `sw.js`, `assets/js/sw.js` | Root service-worker entry point and implementation |
| `assets/js/sw-document.js` | URL-form detection and decoding helpers |
| `assets/js/detect.js` | Experimental fingerprint inspection |
| `assets/js/reputation.js` | LocalStorage TTL cache |
| `assets/js/mutator.js` | Experimental request mutation |
| `assets/js/demutator.js` | Experimental response validation |
| `assets/js/chunker.js` | Byte chunking with contiguous-offset reassembly |
| `assets/js/loader.js` | Experimental form/transport driver |
| `index.html` | Minimal shell with iframe, shape selector |

### 5. Main Application and JavaScript Assets

The application registers `/sw.js` as its service worker. This small root-level
entry point imports the implementation from `assets/js/sw.js`, keeping the
service-worker URL and scope stable while grouping JavaScript sources under
`assets/js/`. The build copies and embeds this asset directory.

Top-level browser navigation first creates a registry URL and records the
target in IndexedDB. The service worker resolves that URL and redirects within
the current Scramjet frame to the native Scramjet route, where Epoxy/Wisp
continues handling the proxied document and its subresources. The Scramjet URL
codec uses a scheme marker (`1` for HTTPS, `0` for HTTP) plus Base64URL for
native target paths, while preserving normal percent-encoding for other URL
schemes. If creating the hashed route fails, the UI logs the error and uses
Scramjet's encoded native route.

### 6. Fingerprint Detection

The `assets/js/detect.js` module implements SHA-256 fingerprinting:

```javascript
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
```

### 7. Reputation System

Caches the first successful form for each origin in localStorage with a 1-hour TTL.

## Usage

### Build

Run `npm run build` to generate the single-file HTML distribution, launcher, and SVGs.
Configure `TARGET_URL` and `HTML_INPUT_PATH` at the top of `build_svg.py`: the build
writes the URL launcher to `singlefile/index.svg` and embeds the configured HTML file
in `singlefile/html.svg`. The embedded document gets a relative `<base>` element so
its app paths and service-worker URL resolve from the SVG's directory instead of
from the iframe's `about:srcdoc` URL.
The single-file build inlines app scripts, approved learning-page CDN scripts, backend
and extension data, and local images. It keeps service-worker and WebAssembly runtime
files alongside the HTML because browsers require those resources to be served from
the app origin. Building downloads the approved learning scripts and a pinned Epoxy
WASM binary, validating the binary's SHA-256 digest.
Wisp discovery reads every endpoint configured through `assets/backend/wisps.json`,
tries the last working endpoint first with a 10-second timeout, and keeps retrying
the configured pool until a server responds.

### Adding a Form

1. Add the form to `assets/js/config.js` in ladder order.
2. Implement its encode/decode behavior in `assets/js/registry.js` and expose it
   through `assets/js/codecs.js`.
3. Handle it in `assets/js/sw.js` and the detection helpers.

### Deployment

This client is designed to be embedded in existing web applications without server-side modifications. The service worker resolves hashed URLs before handing the resulting native route to the Scramjet/Wisp proxy.

## Vocabulary

- **adapters**: URL encoding/decoding implementations
- **negotiation**: Runtime form selection based on capabilities
- **degradation**: Fallback to less privileged forms when necessary
- **forward compatibility**: Adding new forms without breaking existing clients

**Bypass**, **evade**, and **conceal** appear once each in the README, nowhere in comments.

## Fragment Form Caveat

Fetch events drop fragments, so the target is passed by postMessage from the parent, not read off the request. Handle that path explicitly in the parent page.

## Testing

Run codec coverage with `node --test --experimental-default-type=module tests/codec.test.mjs`.