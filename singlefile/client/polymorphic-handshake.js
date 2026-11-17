export function wispToHttpCapabilitiesEndpoint(wispEndpoint) {
  if (typeof wispEndpoint !== 'string') return null;

  const trimmed = wispEndpoint.trim();
  if (!/^wss?:\/\//i.test(trimmed)) return null;

  try {
    const httpUrl = new URL(trimmed);
    httpUrl.protocol = httpUrl.protocol.toLowerCase() === 'wss:' ? 'https:' : 'http:';
    httpUrl.pathname = `${httpUrl.pathname.replace(/\/+$/, '')}/capabilities`;
    httpUrl.search = '';
    httpUrl.hash = '';
    return httpUrl.href;
  } catch (_) {
    return null;
  }
}

export async function verifyServerPolymorphismSupport(wispEndpoint) {
  const httpEndpoint = wispToHttpCapabilitiesEndpoint(wispEndpoint);
  if (!httpEndpoint) return false;

  const controller = typeof AbortController === 'undefined'
    ? null
    : new AbortController();
  const timeout = controller
    ? setTimeout(() => controller.abort(), 3500)
    : null;

  try {
    const res = await fetch(httpEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'query_form_mutation_support' }),
      cache: 'no-store',
      signal: controller?.signal
    });

    if (!res.ok) return false;
    if (res.status === 204) return false;

    const data = await res.json();
    return data?.polymorphicFormMutation === true;
  } catch (_) {
    return false;
  } finally {
    if (timeout !== null) clearTimeout(timeout);
  }
}
