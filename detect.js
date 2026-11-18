import { adapters } from './codecs.js';
import { gatewayContract } from './config.js';

const KNOWN_FINGERPRINTS = new Set();

async function inspectFingerprint(body) {
  const text = new TextDecoder().decode(body);
  const hash = await crypto.digest('SHA-256', text);
  const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  if (KNOWN_FINGERPRINTS.has(fingerprint)) {
    return { blocked: true, reason: fingerprint };
  }
  return { blocked: false };
}

async function learnFingerprint(body) {
  const text = new TextDecoder().decode(body);
  const hash = await crypto.digest('SHA-256', text);
  const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  KNOWN_FINGERPRINTS.add(fingerprint);
  console.log('Learned fingerprint', fingerprint);
}

export { inspectFingerprint, learnFingerprint };