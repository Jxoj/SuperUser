import { gatewayContract, ladder } from './config.js';
import { adapters } from './codecs.js';
import { WispTransport } from './wisp-transport.js';
import { Chunker } from './chunker.js';
import { detect } from './detect.js';
import './registry.js';
import { getReputation, setReputation } from './reputation.js';
import { prepareRequest } from './mutator.js';

const registry = globalThis.SuperUserRegistry;
if (!registry) throw new Error('URL registry helper did not initialize');

class Loader {
  constructor() {
    this.transport = null;
    this.streamId = null;
    this.currentOrigin = null;
    this.probeResult = null;
    this.reputationCache = new Map();
  }

  async load(target) {
    const parsedTarget = new URL(target);
    if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
      throw new TypeError('Proxy targets must use http or https');
    }

    const errors = [];
    for (let index = 0; index < ladder.length; index += 1) {
      const { form } = ladder[index];
      const adapter = adapters[form];
      if (!adapter || typeof adapter.encode !== 'function') {
        errors.push(`${form}: adapter is unavailable`);
        continue;
      }

      let encoded;
      try {
        encoded = await adapter.encode(registry.nextPrefix(), target);
      } catch (error) {
        errors.push(`${form}: ${error.message}`);
        continue;
      }

      try {
        const result = await this._attemptForm(target, form, index, encoded);
        if (result.success) {
          try {
            await setReputation(parsedTarget.origin, form);
            this.reputationCache.set(parsedTarget.origin, form);
          } catch (error) {
            console.warn(`Could not persist URL-form reputation: ${error.message}`);
          }
          return {
            success: true,
            form,
            encoded,
            result: result.data,
            latency: result.latency,
            adapter
          };
        }
        errors.push(`${form}: request was unsuccessful`);
      } catch (error) {
        errors.push(`${form}: ${error.message}`);
      }
    }

    return {
      success: false,
      error: `All form attempts failed (${errors.join('; ')})`,
      form: ladder.at(-1)?.form
    };
  }

  async _attemptForm(target, formType, formIndex, encoded) {
    const startTime = Date.now();
    const origin = new URL(target).origin;
    try {
      const cachedWinner = await getReputation(origin);
      if (cachedWinner && ladder.slice(0, formIndex).some(item => item.form === cachedWinner)) {
        console.info(`Retrying ladder in order; cached ${cachedWinner} is not selected ahead of ${formType}`);
      }
    } catch (error) {
      console.warn(`Could not read URL-form reputation: ${error.message}`);
    }
    return this._performAttempt(target, formType, origin, startTime, encoded);
  }

  async _performAttempt(target, formType, origin, startTime, encoded) {
    
    // For fragment form, we need special handling via postMessage
    if (formType === 'fragment') {
      return await this._handleFragmentForm(target, encoded, origin, startTime);
    }
    
    // For other forms, fetch via Wisp transport
    return await this._handleFetchForm(target, formType, encoded, origin, startTime);
  }

  async _handleFragmentForm(target, encoded, origin, startTime) {
    // Fragment form uses postMessage to parent
    const channel = new BroadcastChannel('wisp-control');
    channel.postMessage({ type: 'NAVIGATE', target: encoded });
    
    const response = await this._waitForFragmentResponse(encoded, startTime);
    channel.close();
    
    if (response.ok) {
      const body = await response.clone().arrayBuffer();
      const { blocked } = await detect(body);
      
      if (blocked) {
        throw new Error('Blocked by fingerprint');
      }
      
      return {
        success: true,
        data: await response.text(),
        latency: Date.now() - startTime
      };
    }
    
    throw new Error(`Fragment form failed: ${response.status} ${response.statusText}`);
  }

  async _handleFetchForm(target, formType, encoded, origin, startTime) {
    // Prepare the request using mutator for native forms
    let payload;
    if (formType === 'native') {
      const { schema, mutated } = await prepareRequest(target);
      payload = mutated;
    } else {
      payload = new TextEncoder().encode(encoded);
    }
    
    // Use Wisp transport to fetch
    if (!this.transport) {
      this.transport = new WispTransport(gatewayContract.wispPath);
      await this.transport.connect();
    }
    
    if (!this.streamId) {
      const host = gatewayContract.origin.replace(/^https?:\/\//, '');
      const port = 443;
      this.streamId = this.transport.openStream(host, port, 3); // hostname
    }
    
    // Request credit
    this.transport.requestCredit(this.streamId, 4);
    
    // Send the payload using chunker
    const chunker = new Chunker();
    const chunks = chunker.chunk(payload);
    
    for (const chunk of chunks) {
      const sent = this.transport.sendData(this.streamId, chunk.data);
      if (!sent) {
        await this._waitForStream(this.streamId);
        break;
      }
    }
    
    // Wait for response
    const response = await this._waitForStream(this.streamId);
    
    if (response.status >= 200 && response.status < 300) {
      const body = await response.clone().arrayBuffer();
      const { blocked } = await detect(body);
      
      if (blocked) {
        throw new Error('Blocked by fingerprint');
      }
      
      return {
        success: true,
        data: body,
        latency: Date.now() - startTime
      };
    } else {
      throw new Error(`Fetch form failed: ${response.status} ${response.statusText}`);
    }
  }

  async _waitForFragmentResponse(target, startTime) {
    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(new Response('Timeout', { status: 504 }));
      }, 3000); // 3s timeout
      
      const channel = new BroadcastChannel('wisp-response');
      
      const handler = (event) => {
        if (event.data && event.data.target === target) {
          clearTimeout(timeout);
          channel.close();
          resolve(event.data.response);
        }
      };
      
      channel.addEventListener('message', handler);
    });
  }

  async _waitForStream(streamId) {
    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(new Response('Stream timeout', { status: 504 }));
      }, 3000); // 3s timeout
      
      const checkStream = () => {
        // This is a simplified implementation
        // In a real implementation, we'd need to track stream responses
        resolve(new Response('Mock stream response', { status: 200 }));
        clearTimeout(timeout);
      };
      
      // Mock immediate resolution for now
      setTimeout(checkStream, 100);
    });
  }

  async probe() {
    if (this.probeResult) {
      return this.probeResult;
    }
    
    const probeConfig = gatewayContract.probe;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
    
    try {
      const response = await fetch(probeConfig.path, {
        method: probeConfig.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(probeConfig.body),
        signal: controller.signal
      });
      
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data[probeConfig.okField]) {
        throw new Error(`Missing ok field: ${probeConfig.okField}`);
      }
      
      this.probeResult = {
        supports: true,
        timestamp: Date.now()
      };
      
      return this.probeResult;
    } catch (error) {
      this.probeResult = {
        supports: false,
        error: error.message,
        timestamp: Date.now()
      };
      
      console.log('Probe failed:', error.message);
      return this.probeResult;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async shutdown() {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.streamId = null;
    this.reputationCache.clear();
  }
}

export { Loader };