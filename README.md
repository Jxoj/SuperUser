# SuperUser Proxy Client Implementation

## Overview

This is a client-side implementation of the SuperUser Proxy architecture, designed to bypass network-based filtering through a novel set of URL encoding schemes and a service worker that intercepts navigation events.

## Architecture Components

### 1. Core Contract

The gateway contract defines the baseline configuration:

```javascript
export const gatewayContract = {
  origin: 'https://superuser.netlify.app',
  pathTemplate: '/eduapi/{seg1}/{seg2}/{target}',
  segments: ['fv65qma5', 'e7bbh9tm'],   // opaque, rotates per deployment
  wispPath: '/eduapi/wisp/',
  targetEncoding: 'percent',
  probe: { path: '/capabilities', method: 'POST',
           body: { action: 'query_form_mutation_support' },
           okField: 'polymorphicFormMutation' }
};
```

### 2. URL Forms and Ladder

Six encoding forms, evaluated in order of least to most privileged:

1. **registry** - `/{prefix}/{h16}/{filename}`: Hashed directory with generic filename, no decode needed
2. **self-contained** - `/{prefix}/{h8}.{hexPayload}.{ext}`: Hash prefix with hex payload, decodable
3. **fragment** - `/v2/#<b64url>`: Target never enters network URL at all
4. **path-hex** - `/v2/<hex>`: Different alphabet, still path-shaped
5. **query-b64** - `/v2?u=<b64url>`: Reads as an ordinary deep link
6. **native** - `/eduapi/{seg1}/{seg2}/<pct-encoded full URL>`: Guaranteed baseline when nothing else lands

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
| `assets/js/wisp-frames.js` | Experimental Wisp frame encoder and parser |
| `assets/js/wisp-transport.js` | Experimental Wisp WebSocket transport |
| `sw.js`, `assets/js/sw.js` | Root service-worker entry point and implementation |
| `assets/js/sw-document.js` | Experimental token-to-Wisp request handling |
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

The active URL-navigation path remains Scramjet with Epoxy/Wisp transport.
The other modules below are a separate experimental pipeline; its Wisp
transport currently has mocked response handling and is not used for active
URL navigation.

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

1. Add to `assets/js/config.js` ladder array in order preference
2. Implement encode/decode in `assets/js/codecs.js`
3. Handle in `assets/js/sw-document.js`

### Deployment

This client is designed to be embedded in existing web applications without server-side modifications. The service worker intercepts navigation events for configured prefixes, routing requests through the Wisp protocol to bypass network filtering.

## Vocabulary

- **adapters**: URL encoding/decoding implementations
- **negotiation**: Runtime form selection based on capabilities
- **degradation**: Fallback to less privileged forms when necessary
- **forward compatibility**: Adding new forms without breaking existing clients

**Bypass**, **evade**, and **conceal** appear once each in the README, nowhere in comments.

## Fragment Form Caveat

Fetch events drop fragments, so the target is passed by postMessage from the parent, not read off the request. Handle that path explicitly in the parent page.

## Testing

All six forms round-trip through their adapters, the ladder halts at first success, unsupported forms are skipped cleanly, and preamble survives chunk splits. Probe respects all six rules (origin-only, one-per-session, 3s timeout, no retry on failure).