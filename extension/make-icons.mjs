import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Minimal PNG writer — avoids pulling in an image library for three flat icons.

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'icons');
fs.mkdirSync(OUT, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Rounded green square with a white "+" cut through the middle.
const icon = (x, y, s) => {
  const r = s * 0.22;
  const dx = Math.max(r - x, x - (s - 1 - r), 0);
  const dy = Math.max(r - y, y - (s - 1 - r), 0);
  if (Math.hypot(dx, dy) > r) return [0, 0, 0, 0];

  const c = (s - 1) / 2;
  const arm = s * 0.30;
  const thick = Math.max(1, s * 0.11);
  const onPlus =
    (Math.abs(x - c) <= arm && Math.abs(y - c) <= thick / 2) ||
    (Math.abs(y - c) <= arm && Math.abs(x - c) <= thick / 2);

  return onPlus ? [4, 20, 10, 255] : [41, 224, 106, 255];
};

for (const size of [16, 48, 128]) {
  const file = path.join(OUT, `icon${size}.png`);
  fs.writeFileSync(file, png(size, icon));
  console.log(`wrote ${file}`);
}
