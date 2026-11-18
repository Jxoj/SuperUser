import { gatewayContract } from './config.js';

class Chunker {
  constructor(maxChunkSize = 65535) {
    this.maxChunkSize = maxChunkSize;
    this.chunkId = 0;
  }

  chunk(data) {
    const buffer = new Uint8Array(data);
    const chunks = [];
    let offset = 0;
    
    while (offset < buffer.length) {
      const chunkSize = Math.min(this.maxChunkSize, buffer.length - offset);
      const chunk = buffer.subarray(offset, offset + chunkSize);
      
      chunks.push({
        id: this.chunkId++,
        data: chunk,
        offset: offset,
        isHeader: chunk.slice(0, 4) === this._createLengthPrefix(chunk.length) // check if first 4 bytes are length prefix
      };
      
      offset += chunkSize;
    }
    
    return chunks;
  }

  _createLengthPrefix(length) {
    const prefix = new Uint8Array(4);
    prefix[0] = (length >>> 24) & 0xff;
    prefix[1] = (length >>> 16) & 0xff;
    prefix[2] = (length >>> 8) & 0xff;
    prefix[3] = length & 0xff;
    return prefix;
  }

  static reassemble(chunks) {
    if (!chunks || chunks.length === 0) return null;
    
    // Sort chunks by offset
    chunks.sort((a, b) => a.offset - b.offset);
    
    // Check for gaps in offsets (chunk ID continuity)
    const expectedOffsets = [];
    for (let i = 0; i < chunks.length; i++) {
      expectedOffsets.push(i * chunks[0].data.length);
    }
    
    // Handle split header chunks - reassemble length prefix
    const dataChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].isHeader) {
        // This chunk contains the length prefix, need to extract the actual data
        const actualData = chunks[i].data.slice(4);
        dataChunks.push(actualData);
      } else {
        dataChunks.push(chunks[i].data);
      }
    }
    
    // Concatenate all chunks
    const totalLength = dataChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    
    let position = 0;
    for (const chunk of dataChunks) {
      result.set(chunk, position);
      position += chunk.length;
    }
    
    return result;
  }
}

export { Chunker };