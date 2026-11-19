class Chunker {
  constructor(maxChunkSize = 65535) {
    if (!Number.isSafeInteger(maxChunkSize) || maxChunkSize <= 0) {
      throw new RangeError('maxChunkSize must be a positive safe integer');
    }
    this.maxChunkSize = maxChunkSize;
    this.chunkId = 0;
  }

  chunk(data) {
    const buffer = toUint8Array(data);
    const chunks = [];

    for (let offset = 0; offset < buffer.length; offset += this.maxChunkSize) {
      const end = Math.min(offset + this.maxChunkSize, buffer.length);
      chunks.push({
        id: this.chunkId++,
        data: buffer.slice(offset, end),
        offset
      });
    }

    return chunks;
  }

  static reassemble(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) return null;

    const ordered = [...chunks].sort((a, b) => a.offset - b.offset);
    let totalLength = 0;
    for (const chunk of ordered) {
      if (!Number.isSafeInteger(chunk.offset) || chunk.offset !== totalLength) {
        throw new Error('Chunks must have contiguous offsets starting at zero');
      }
      const data = toUint8Array(chunk.data);
      totalLength += data.length;
    }

    const result = new Uint8Array(totalLength);
    for (const chunk of ordered) {
      result.set(toUint8Array(chunk.data), chunk.offset);
    }
    return result;
  }
}

function toUint8Array(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('Chunk data must be an ArrayBuffer or an ArrayBuffer view');
}

export { Chunker };
