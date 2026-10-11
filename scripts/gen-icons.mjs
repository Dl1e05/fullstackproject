// Генерирует PNG-иконки PWA без внешних зависимостей: npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GREEN = [0x17, 0x6b, 0x52, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const p = pixel(x, y);
      raw.set(p, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Лесенка из трёх ступеней (логотип «шаг») внутри квадрата 0..1
function isStep(u, v, scale) {
  const pad = (1 - scale) / 2;
  const x = (u - pad) / scale;
  const y = (v - pad) / scale;
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  const col = Math.floor(x * 3);
  const top = 1 - (col + 1) / 3;
  return y >= top;
}

function icon(size, { rounded, scale }) {
  const r = rounded ? size * 0.22 : 0;
  return png(size, (x, y) => {
    const cx = Math.min(x, size - 1 - x);
    const cy = Math.min(y, size - 1 - y);
    if (rounded && cx < r && cy < r && (r - cx) ** 2 + (r - cy) ** 2 > r * r) return CLEAR;
    return isStep((x + 0.5) / size, (y + 0.5) / size, scale) ? WHITE : GREEN;
  });
}

writeFileSync('public/icon-192.png', icon(192, { rounded: true, scale: 0.56 }));
writeFileSync('public/icon-512.png', icon(512, { rounded: true, scale: 0.56 }));
writeFileSync('public/maskable-512.png', icon(512, { rounded: false, scale: 0.44 }));
writeFileSync('public/apple-touch-icon.png', icon(180, { rounded: false, scale: 0.52 }));
console.log('Иконки созданы в public/');
