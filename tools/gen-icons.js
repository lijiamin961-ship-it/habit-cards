/* 生成 PWA 图标：纸面圆角底 + 朱红圆点 + 横杠（与站内 favicon 同一视觉），2x 超采样抗锯齿
   输出：icons/icon-192.png 与 icons/icon-512.png（any + maskable 安全区留白已预留） */
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
/* pixel(x,y) 用连续坐标（含小数）取色，内部做圆角矩形 SDF 判定 */
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;   // filter: none
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (const p of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const c = pixel(x + p[0], y + p[1]);
        r += c[0]; g += c[1]; b += c[2]; a += c[3];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(r / 4);
      raw[o + 1] = Math.round(g / 4);
      raw[o + 2] = Math.round(b / 4);
      raw[o + 3] = Math.round(a / 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
/* 圆角矩形 SDF：<=0 在内部 */
function sdRound(x, y, cx, cy, hw, hh, r) {
  const dx = Math.max(Math.abs(x - cx) - hw, 0);
  const dy = Math.max(Math.abs(y - cy) - hh, 0);
  return Math.sqrt(dx * dx + dy * dy) - r;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function cov(v) { return clamp01(0.5 - v); }   /* SDF 距离 → 覆盖率（1px 过渡带） */

function buildPixel(size) {
  return function (x, y) {
    /* 纸面圆角底：整张画布（maskable 图标安全区由内容约束保证） */
    const dPaper = sdRound(x, y, size / 2, size / 2, size / 2 - 1, size / 2 - 1, size * 0.22);
    const paper = cov(dPaper);
    if (paper <= 0) return [0, 0, 0, 0];
    /* 朱红圆点 + 圆角横杠 */
    const dDot = Math.hypot(x - size / 2, y - size * 0.35) - size * 0.15;
    const dot = cov(dDot);
    const dBar = sdRound(x, y, size / 2, size * 0.635, size * 0.27, size * 0.055, size * 0.055);
    const bar = cov(dBar);
    const mark = clamp01(dot + bar);
    /* 纸面色 (246,244,239) 与朱红 (192,57,43) 按 mark 混合 */
    const r = 246 + (192 - 246) * mark;
    const g = 244 + (57 - 244) * mark;
    const b = 239 + (43 - 239) * mark;
    return [r, g, b, 255 * paper];
  };
}
const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, 'icon-' + size + '.png'), png(size, buildPixel(size)));
  console.log('已生成 icons/icon-' + size + '.png');
}
