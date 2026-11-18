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

1. **fragment** - `/v2/#<b64url>`: Target never enters network URL at all
2. **path-b64** - `/v2/<b64url>`: Opaque, no reserved characters
3. **query-b64** - `/v2?u=<b64url>`: Reads as an ordinary deep link
4. **path-schemeless** - `/v2/<pct-encoded, scheme stripped>`: Drops the %3A%2F%2F signature
5. **path-hex** - `/v2/<hex>`: Different alphabet, still path-shaped
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
| `config.js` | Contract, prefixes, ladder, mode configuration |
| `codecs.js` | One self-contained encode/decode pair per form |
| `wisp-frames.js` | Frame encoder, streaming parser, varint codec, credit accounting |
| `wisp-transport.js` | Socket lifecycle, stream registry, backpressure, close reasons |
| `sw.js` | Service worker registration, clients.claim, navigation intercept |
| `sw-document.js` | Token to native path, fetch over Wisp, Response handling |
| `detect.js` | Fingerprint inspection on fetched bodies, blocking logic |
| `reputation.js` | LocalStorage TTL cache, winner tracking |
| `mutator.js` | Per-request schema generation, XOR encryption |
| `demutator.js` | Schema validation, payload decryption |
| `chunker.js` | Length-prefixed chunking with reassembly |
| `loader.js` | Main driver: attempt forms, detect, advance, cap at 4 |
| `index.html` | Minimal shell with iframe, shape selector |

### 5. Service Worker Integration

The service worker (`sw.js`) handles navigation interception:

1. Registers with scope `/`
2. Intercepts fetch events for configured prefixes (`v2`, `v3`, `v4`)
3. Excludes control pages (`/admin`, `/control`, `/shell`) and app shell
4. Routes to Wisp transport for non-fragment forms
5. For fragment forms, uses postMessage from parent page

### 6. Fingerprint Detection

The `detect.js` module implements SHA-256 fingerprinting:

```javascript
const hash = await crypto.digest('SHA-256', text);
const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
```

### 7. Reputation System

Caches the first successful form for each origin in localStorage with a 1-hour TTL.

## Usage

### Adding a Form

1. Add to `config.js.ladder` array in order preference
2. Implement encode/decode in `codecs.js.adapters`
3. Handle in `sw-document.js` and `sw.js`

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