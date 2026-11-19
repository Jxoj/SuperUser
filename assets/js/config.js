export const gatewayContract = {
  origin: 'https://superuser.netlify.app',
  pathTemplate: '/eduapi/{seg1}/{seg2}/{target}',
  segments: ['fv65qma5', 'e7bbh9tm'],
  wispPath: '/eduapi/wisp/',
  targetEncoding: 'percent',
  probe: {
    path: '/capabilities',
    method: 'POST',
    body: { action: 'query_form_mutation_support' },
    okField: 'polymorphicFormMutation'
  }
};

export const prefixes = ['assets', 'static', 'cdn', 'pkg', '_next/static/'];

export const ladder = [
  { form: 'registry', rationale: 'hashed directory with generic filename, no decode needed' },
  { form: 'self-contained', rationale: 'hash prefix with hex payload, decodable' },
  { form: 'fragment', rationale: 'target never enters the network URL at all' },
  { form: 'path-hex', rationale: 'different alphabet, still path-shaped' },
  { form: 'query-b64', rationale: 'reads as an ordinary deep link' },
  { form: 'native', rationale: 'guaranteed baseline when nothing else lands' }
];

export const mode = 'client';