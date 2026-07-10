const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }

  let crc = -1;
  for (const b of buf) {
    crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chan(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function createPng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    pixels.copy(row, 1, y * width * 4, (y + 1) * width * 4);
    rows.push(row);
  }
  const idat = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chan('IHDR', ihdr),
    chan('IDAT', idat),
    chan('IEND', Buffer.alloc(0))
  ]);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const radius = size * 0.4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let r = 37;
      let g = 99;
      let b = 235;
      let a = 255;
      if (dist < radius) {
        r = 255;
        g = 255;
        b = 255;
      }
      const idx = (y * size + x) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }
  return pixels;
}

function createIco(width, pixels) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const png = createPng(width, width, pixels);
  const dir = Buffer.alloc(16);
  dir.writeUInt8(width, 0);
  dir.writeUInt8(width, 1);
  dir.writeUInt8(0, 2);
  dir.writeUInt16LE(0, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(png.length, 8);
  dir.writeUInt32LE(6 + 16, 12);

  return Buffer.concat([header, dir, png]);
}

function writeIcon(name, size) {
  const pixels = drawIcon(size);
  const png = createPng(size, size, pixels);
  fs.writeFileSync(name, png);
  console.log('Wrote', name);
}

function writeFavicon(name, size) {
  const pixels = drawIcon(size);
  const ico = createIco(size, pixels);
  fs.writeFileSync(name, ico);
  console.log('Wrote', name);
}

writeIcon('icon-192.png', 192);
writeIcon('icon-512.png', 512);
writeFavicon('favicon.ico', 32);
fs.writeFileSync('favicon.png', createPng(32, 32, drawIcon(32)));
console.log('Generated icons');
