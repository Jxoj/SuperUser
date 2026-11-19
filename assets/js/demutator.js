import { gatewayContract } from './config.js';

async function finalizeResponse(payload, schema) {
  const data = new TextDecoder().decode(payload);
  const plain = JSON.parse(data);
  const validated = validateSchema(plain, schema);
  return validated;
}

function validateSchema(data, schema) {
  if (typeof schema !== 'object' || !schema.properties) return data;
  const result = { ...data };
  if (schema.properties.url && !result.url) {
    result.url = '';
  }
  return result;
}

export { finalizeResponse };