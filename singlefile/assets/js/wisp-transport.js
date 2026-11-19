import { gatewayContract } from './config.js';
import { FrameEncoder } from './wisp-frames.js';

const PROTOCOL_VERSION = '1.0';

class WispTransport {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.streams = {};
    this.credits = {};
    this.encoder = new FrameEncoder();
    this.parser = null;
    this.state = 'closed';
    this.bufferedData = [];
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
  }

  async connect() {
    if (this.state === 'open') return;
    try {
      this.socket = new WebSocket(this.url);
      this.parser = new (await import('./wisp-frames.js')).FrameParser();
      this.socket.addEventListener('message', event => {
        const data = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : new Uint8Array(event.data);
        this.parser.feed(data);
      });
      this.socket.addEventListener('open', () => {
        this.state = 'open';
        this.reconnectAttempts = 0;
        console.log('WispTransport connected');
      });
      this.socket.addEventListener('close', () => {
        this.state = 'closed';
        console.log('WispTransport disconnected');
        this._reconnect();
      });
      this.socket.addEventListener('error', err => {
        console.error('WispTransport error', err);
        this.state = 'error';
      });
    } catch (e) {
      console.error('Failed to connect WispTransport', e);
      this.state = 'error';
      this._reconnect();
    }
  }

  _reconnect() {
    if (this.reconnectAttempts < this.maxReconnects) {
      setTimeout(() => this.connect(), 1000);
    }
    this.reconnectAttempts++;
  }

  sendFrame(type, streamId, payload) {
    if (this.state !== 'open') return;
    let frame;
    switch (type) {
      case 'CONNECT':
        frame = this.encoder.encodeConnect(streamId, payload.port, payload.addrType, payload.addr);
        break;
      case 'DATA':
        frame = this.encoder.encodeData(streamId, payload);
        break;
      case 'CONTINUE':
        frame = this.encoder.encodeContinue(streamId);
        break;
      case 'CLOSE':
        frame = this.encoder.encodeClose(streamId, payload.reason);
        break;
      case 'INFO':
        frame = this.encoder.encodeInfo(streamId, payload.message);
        break;
      default:
        throw new Error(`Unknown frame type ${type}`);
    }
    this.socket.send(frame.buffer || frame);
  }

  openStream(host, port, addrType = 3) {
    const streamId = Math.floor(Math.random() * 1000000) | 1; // odd
    const payload = { port, addrType, addr: new TextEncoder().encode(host) };
    this.sendFrame('CONNECT', streamId, payload);
    this.streams[streamId] = { host, port, addrType, state: 'handshake' };
    this.credits[streamId] = 0;
    return streamId;
  }

  sendData(streamId, data) {
    if (!this.streams[streamId] || this.streams[streamId].state !== 'open') return false;
    if (this.credits[streamId] <= 0) return false;
    this.credits[streamId]--;
    this.sendFrame('DATA', streamId, data);
    return true;
  }

  requestCredit(streamId, amount = 1) {
    this.sendFrame('CONTINUE', streamId, null);
  }

  closeStream(streamId, reason = new Uint8Array([0])) {
    delete this.streams[streamId];
    this.sendFrame('CLOSE', streamId, { reason });
    delete this.credits[streamId];
  }

  close() {
    if (this.socket) {
      this.socket.close();
    }
    this.state = 'closed';
    this.streams = {};
    this.credits = {};
  }
}

export { WispTransport };