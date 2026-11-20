export const gatewayContract = {
  origin: 'https://superuser.netlify.app',
  pathTemplate: '/assets/{seg1}/{target}',
  segments: ['fv65qma5'],
  wispPath: '/eduapi/wisp/',
  targetEncoding: 'base64url-scheme-marker',
  probe: {
    path: '/capabilities',
    method: 'POST',
    body: { action: 'query_form_mutation_support' },
    okField: 'polymorphicFormMutation'
  }
};

export const prefixes = ['/assets/', '/pkg/', '/imgs/', '/articles/'];

export const ladder = [
  { form: 'registry', rationale: 'hashed directory with generic filename, no decode needed' },
  { form: 'self-contained', rationale: 'hash prefix with hex payload, decodable' },
  { form: 'fragment', rationale: 'target never enters the network URL at all' },
  { form: 'path-hex', rationale: 'UTF-8 target encoded as hexadecimal' },
  { form: 'query-b64', rationale: 'reads as an ordinary deep link' },
  { form: 'native', rationale: 'guaranteed baseline when nothing else lands' }
];

export const mode = 'client';