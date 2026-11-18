import { gatewayContract } from './config.js';

async function prepareRequest(target) {
  const schema = generateSchema(target);
  const mutated = await mutate(target, schema);
  return { schema, mutated };
}

function generateSchema(target) {
  return {
    type: 'object',
    properties: {
      url: { type: 'string' },
      timestamp: { type: 'number' },
      source: { type: 'string' }
    },
    required: ['url']
  };
}

async function mutate(target, schema) {
  const data = new TextEncoder().encode(JSON.stringify({ url: target, timestamp: Date.now(), source: 'client' }));
  const key = crypto.getRandomValues(new Uint8Array(data.length));
  const output = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] ^ key[i];
  }
  return output;
}

export { prepareRequest };