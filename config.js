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

export const prefixes = ['v2', 'v3', 'v4'];

export const ladder = [
  { form: 'fragment', rationale: 'target never enters the network URL at all' },
  { form: 'path-b64', rationale: 'opaque, no reserved characters' },
  { form: 'query-b64', rationale: 'reads as an ordinary deep link' },
  { form: 'path-schemeless', rationale: 'drops the %3A%2F%2F signature' },
  { form: 'path-hex', rationale: 'different alphabet, still path-shaped' },
  { form: 'native', rationale: 'guaranteed baseline when nothing else lands' }
];

export const mode = 'client';