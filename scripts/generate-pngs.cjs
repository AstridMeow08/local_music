const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPng(width, height, isMaskable = false) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data: height rows, each starting with filter byte 0, followed by width * 4 bytes RGBA
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.min(width, height) / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background gradient
      let r = 12, g = 16, b = 23, a = 255;

      // Glow circle in center
      if (dist < maxR * 0.75) {
        const factor = 1 - (dist / (maxR * 0.75));
        r = Math.floor(12 + factor * 20);
        g = Math.floor(16 + factor * 80);
        b = Math.floor(23 + factor * 50);
      }

      // Equalizer bars motif
      // 5 bars centered around cx
      const barWidth = Math.max(3, Math.floor(width * 0.045));
      const gap = Math.max(2, Math.floor(width * 0.035));
      const totalBarsWidth = 5 * barWidth + 4 * gap;
      const startX = cx - totalBarsWidth / 2;
      const barHeights = [0.35, 0.65, 0.95, 0.58, 0.28].map(h => h * height * 0.45);

      if (x >= startX && x < startX + totalBarsWidth) {
        const relX = x - startX;
        const barIndex = Math.floor(relX / (barWidth + gap));
        const inBar = (relX % (barWidth + gap)) < barWidth;

        if (inBar && barIndex >= 0 && barIndex < 5) {
          const bHeight = barHeights[barIndex];
          if (Math.abs(y - cy) <= bHeight / 2) {
            // Neon emerald/cyan gradient
            r = 34;
            g = 197;
            b = 150;
            a = 255;
          }
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// CRC32 implementation
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPng(192, 192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPng(512, 512));
fs.writeFileSync(path.join(publicDir, 'icon-maskable-192.png'), createPng(192, 192, true));
fs.writeFileSync(path.join(publicDir, 'icon-maskable-512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(32, 32));

console.log('Successfully generated all PWA icons: icon-192, icon-512, maskables, apple-touch-icon, favicon.ico');
