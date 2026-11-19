const KNOWN_FINGERPRINTS = new Set();

async function inspectFingerprint(body) {
  const bytes = toUint8Array(body);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  if (KNOWN_FINGERPRINTS.has(fingerprint)) {
    return { blocked: true, reason: fingerprint };
  }
  return { blocked: false };
}

async function learnFingerprint(body) {
  const bytes = toUint8Array(body);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  KNOWN_FINGERPRINTS.add(fingerprint);
  console.log('Learned fingerprint', fingerprint);
}

function toUint8Array(data) {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('Fingerprint input must be a string or byte buffer');
}

export { inspectFingerprint, inspectFingerprint as detect, learnFingerprint };