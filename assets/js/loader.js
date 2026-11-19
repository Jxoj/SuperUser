import { gatewayContract, prefixes, ladder } from './config.js';
import { adapters } from './codecs.js';
import { WispTransport } from './wisp-transport.js';
import { Chunker } from './chunker.js';
import { detect } from './detect.js';
import { getReputation, setReputation } from './reputation.js';
import { prepareRequest } from './mutator.js';

class Loader {
  constructor() {
    this.transport = null;
    this.streamId = null;
    this.currentOrigin = null;
    this.probeResult = null;
    this.reputationCache = new Map();
  }

  async load(target) {
    // Determine form type based on ladder order
    let formType = null;
    let formIndex = -1;
    
    for (let i = 0; i < ladder.length; i++) {
      const candidate = ladder[i];
      if (adapters[candidate.form].encode(prefixes[0], target) === target) {
        formType = candidate.form;
        formIndex = i;
        break;
      }
    }
    
    if (!formType) {
      throw new Error('No form type matched');
    }
    
    // Try to use the selected form
    try {
      const result = await this._attemptForm(target, formType, formIndex);
      if (result.success) {
        return {
          success: true,
          form: formType,
          result: result.data,
          latency: result.latency,
          adapter: adapters[formType]
        };
      }
    } catch (error) {
      console.log(`${formType} failed:`, error.message);
    }
    
    // All forms failed
    return {
      success: false,
      error: 'All form attempts failed',
      form: formType
    };
  }

  async _attemptForm(target, formType, formIndex) {
    const startTime = Date.now();
    
    // Check if we have cached reputation for this origin
    const origin = new URL(target).origin;
    const cachedWinner = await getReputation(origin);
    
    if (cachedWinner === formType) {
      console.log(`Using cached winner for ${origin}: ${formType}`);
      // We need to actually attempt this form to get a result
      return this._performAttempt(target, formType, origin, startTime);
    }
    
    // Check if this form is still in the ladder (unblocked forms only)
    const availableForms = ladder.slice(formIndex);
    if (availableForms.length === 0) {
      throw new Error('No available forms remaining');
    }
    
    // Attempt the current form
    try {
      const result = await this._performAttempt(target, formType, origin, startTime);
      
      if (result.success) {
        // Cache the winner
        await setReputation(origin, formType);
        this.reputationCache.set(origin, formType);
        return result;
      } else {
        // Form failed, continue to next
        throw new Error(`Form ${formType} failed`);
      }
    } catch (error) {
      throw error;
    }
  }

  async _performAttempt(target, formType, origin, startTime) {
    // Prepare the request based on form type
    const encoded = adapters[formType].encode(prefixes[0], target);
    
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
    // Determine Wisp path based on form type
    let wispPath;
    if (formType === 'native') {
      wispPath = `${gatewayContract.pathTemplate.replace('{seg1}', gatewayContract.segments[0])}/${gatewayContract.segments[1]}/${encodeURIComponent(target)}`;
    } else {
      wispPath = `${gatewayContract.wispPath}${encoded}`;
    }
    
    // Prepare the request using mutator for native forms
    let payload;
    if (formType === 'native') {
      const { schema, mutated } = await prepareRequest(target);
      payload = mutated;
    } else {
      // For other forms, just use the encoded target
      payload = new TextEncoder().encode(target);
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