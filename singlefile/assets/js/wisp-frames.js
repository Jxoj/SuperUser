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
  let multiplier = 1;
  let end = offset;
  while (end < data.length) {
    const byte = data[end];
    value += (byte & 0x7f) * multiplier;
    end++;
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('Wisp stream ID exceeds the safe integer range');
    }
    if (!(byte & 0x80)) {
      return { value, bytes: end - offset };
    }
    multiplier *= 128;
    if (multiplier > Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Wisp stream ID varint is too large');
    }
  }
  throw new Error('Incomplete Wisp stream ID varint');
}

class FrameParser {
  constructor() {
    this.streamRegistry = {};
    this.creditState = {};
  }

  feed(data) {
    const bytes = toUint8Array(data);
    if (bytes.length < 2) {
      throw new Error('Wisp frame is missing its type or stream ID');
    }
    const type = bytes[0];
    if (![0x01, 0x02, 0x03, 0x04, 0x05].includes(type)) {
      throw new Error(`Unknown Wisp frame type: ${type}`);
    }
    const { value: streamId, bytes: idLength } = varintDecode(bytes, 1);
    const frame = {
      type,
      streamId,
      payload: bytes.subarray(1 + idLength)
    };
    this._dispatchFrame(frame);
    return frame;
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
        this.creditState[frame.streamId] = (this.creditState[frame.streamId] || 0) + 1;
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
    const port = new DataView(payload.buffer, payload.byteOffset, 2).getUint16(0, false);
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

function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('Wisp frame data must be an ArrayBuffer or an ArrayBuffer view');
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