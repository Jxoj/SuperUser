import { gatewayContract } from './config.js';

function varintEncode(num) {
  const out = [];
  do {
    let byte = num & 0x7f;
    num >>>= 7;
    if (num) byte |= 0x80;
    out.push(byte);
  } while (num);
  return new Uint8Array(out);
}

function varintDecode(data, offset = 0) {
  let value = 0;
  let shift = 0;
  let end = offset;
  while (end < data.length) {
    const byte = data[end];
    value += (byte & 0x7f) * shift;
    shift += 7;
    end++;
    if (!(byte & 0x80)) break;
  }
  return { value, bytes: end - offset };
}

class FrameParser {
  constructor() {
    this.buffer = new Uint8Array();
    this.streamRegistry = {};
    this.creditState = {};
  }

  feed(data) {
    this.buffer = new Uint8Array([...this.buffer, ...data]);
    while (this.buffer.length >= 1) {
      const type = this.buffer[0];
      if (![0x01, 0x02, 0x03, 0x04, 0x05].includes(type)) {
        this._closeStream(this._readVarint(this.buffer, 1).value);
        break;
      }
      const { value: streamId, bytes: len } = this._readVarint(this.buffer, 1);
      const payloadStart = 1 + len;
      const frameHeaderSize = payloadStart;
      if (this.buffer.length < frameHeaderSize) break;
      const frame = {
        type,
        streamId,
        payload: this.buffer.subarray(1, payloadStart)
      };
      this._dispatchFrame(frame);
      this.buffer = this.buffer.subarray(payloadStart);
    }
  }

  _readVarint(data, offset) {
    return varintDecode(data, offset);
  }

  _dispatchFrame(frame) {
    switch (frame.type) {
      case 0x01: // CONNECT
        this._handleConnect(frame.streamId, frame.payload);
        break;
      case 0x02: // DATA
        if (!this.creditState[frame.streamId] || this.creditState[frame.streamId] > 0) {
          this._handleData(frame.streamId, frame.payload);
        }
        break;
      case 0x03: // CONTINUE
        if (this.creditState[frame.streamId]) this.creditState[frame.streamId]++;
        break;
      case 0x04: // CLOSE
        this._closeStream(frame.streamId, frame.payload);
        break;
      case 0x05: // INFO
        this._handleInfo(frame.streamId, frame.payload);
        break;
    }
  }

  _handleConnect(streamId, payload) {
    if (streamId % 2 === 0) return; // server allocates even
    if (payload.length < 3) return;
    const port = new DataView(payload.buffer, payload.byteOffset, 2).getUint16BE(0);
    const addrType = payload[2];
    const addr = payload.subarray(3);
    this.streamRegistry[streamId] = {
      port,
      addrType,
      addr,
      state: 'open',
      credit: 0
    };
  }

  _handleData(streamId, payload) {
    if (!this.streamRegistry[streamId]) return;
    if (this.streamRegistry[streamId].credit <= 0) return;
    this.streamRegistry[streamId].credit--;
    // emit data
  }

  _closeStream(streamId, reason = new Uint8Array([0])) {
    delete this.streamRegistry[streamId];
    delete this.creditState[streamId];
  }

  _handleInfo(streamId, payload) {
    // UTF-8 decode and emit info
  }

  acquireCredit(streamId, amount = 1) {
    if (!this.creditState[streamId]) this.creditState[streamId] = 0;
    this.creditState[streamId] += amount;
  }

  releaseCredit(streamId, amount = 1) {
    if (this.creditState[streamId]) this.creditState[streamId] = Math.max(0, this.creditState[streamId] - amount);
  }
}

class FrameEncoder {
  encodeConnect(streamId, port, addrType, addr) {
    const idBytes = varintEncode(streamId);
    const payload = new Uint8Array([port >>> 8, port & 0xff, addrType, ...addr]);
    return new Uint8Array([0x01, ...idBytes, ...payload]);
  }

  encodeData(streamId, payload) {
    const idBytes = varintEncode(streamId);
    return new Uint8Array([0x02, ...idBytes, ...payload]);
  }

  encodeContinue(streamId) {
    const idBytes = varintEncode(streamId);
    return new Uint8Array([0x03, ...idBytes]);
  }

  encodeClose(streamId, reason) {
    const idBytes = varintEncode(streamId);
    return new Uint8Array([0x04, ...idBytes, reason]);
  }

  encodeInfo(streamId, message) {
    const idBytes = varintEncode(streamId);
    const payload = new TextEncoder().encode(message);
    return new Uint8Array([0x05, ...idBytes, ...payload]);
  }
}

export { FrameParser, FrameEncoder };