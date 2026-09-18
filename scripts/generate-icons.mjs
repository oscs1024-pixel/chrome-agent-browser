// scripts/generate-icons.mjs
// 为 agent-browser 生成全新专属的 16x16 / 48x48 / 128x128 PNG 图标
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function createPng(width, height, pixelFn) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function chunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    header,
    chunk('IHDR', ihdrData),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// 距离辅助函数
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// 绘制 agent-browser 专属图标：
// 现代 Squircle 背景（深蓝紫科技感渐变），上部为极简浏览器框架，中部为 Agent 闪电与交互光标符号
function renderPixel(x, y, w, h) {
  // 归一化到 [-1, 1]
  const nx = (x + 0.5) / w * 2 - 1;
  const ny = (y + 0.5) / h * 2 - 1;

  // 1. 圆角矩形背景 (SDF)
  const r = 0.78; // 半径
  const cr = 0.28; // 圆角半径
  const qx = Math.abs(nx) - (r - cr);
  const qy = Math.abs(ny) - (r - cr);
  const dOuter = Math.hypot(Math.max(0, qx), Math.max(0, qy)) + Math.min(0, Math.max(qx, qy)) - cr;
  const pxWidth = 2.0 / w;
  const bgAlpha = 1.0 - smoothstep(0, pxWidth * 1.5, dOuter);

  if (bgAlpha <= 0) return [0, 0, 0, 0];

  // 背景渐变：从左上深蓝 (#1d4ed8) 到右下深靛紫 (#0f172a)
  const grad = (nx + ny + 2) / 4;
  let bgR = Math.round(29 * (1 - grad) + 15 * grad);
  let bgG = Math.round(78 * (1 - grad) + 23 * grad);
  let bgB = Math.round(216 * (1 - grad) + 42 * grad);

  // 2. 内部图形：浏览器顶栏面板与光标/闪电
  // 浏览器外框 (y in [-0.55, 0.55], x in [-0.6, 0.6])
  const fx = Math.abs(nx) - 0.6;
  const fy = Math.abs(ny) - 0.55;
  const dFrame = Math.hypot(Math.max(0, fx), Math.max(0, fy)) + Math.min(0, Math.max(fx, fy)) - 0.08;
  const inFrame = dFrame <= 0;

  // 顶栏分割线 y = -0.22
  const isTopBarLine = Math.abs(ny - (-0.22)) < pxWidth * 1.0 && Math.abs(nx) < 0.6;

  // 顶栏三个小控制点
  const dotY = -0.38;
  const dDot1 = Math.hypot(nx - (-0.42), ny - dotY) - 0.06;
  const dDot2 = Math.hypot(nx - (-0.26), ny - dotY) - 0.06;
  const dDot3 = Math.hypot(nx - (-0.10), ny - dotY) - 0.06;

  // 中部 Agent 符号：精准有力的命令行/智能体光标 ">_" 结合几何连接菱形
  // 箭头 > 顶点在 (0.05, 0.15)
  // 线条 1: (-0.25, -0.05) -> (0.05, 0.15)
  // 线条 2: (0.05, 0.15) -> (-0.25, 0.35)
  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  const dArrow1 = distToSegment(nx, ny, -0.28, -0.02, 0.02, 0.15);
  const dArrow2 = distToSegment(nx, ny, 0.02, 0.15, -0.28, 0.32);
  const dArrow = Math.min(dArrow1, dArrow2) - 0.065;

  // 光标下划线: (0.15, 0.32) -> (0.38, 0.32)
  const dCursor = distToSegment(nx, ny, 0.14, 0.32, 0.38, 0.32) - 0.06;

  let fgAlpha = 0;
  let fgR = 255, fgG = 255, fgB = 255;

  if (dDot1 < 0 || dDot2 < 0 || dDot3 < 0) {
    fgAlpha = 0.9;
    fgR = 56; fgG = 189; fgB = 248; // 电光蓝
  } else if (isTopBarLine) {
    fgAlpha = 0.35;
    fgR = 255; fgG = 255; fgB = 255;
  } else if (dArrow < 0 || dCursor < 0) {
    const aDist = Math.min(dArrow, dCursor);
    fgAlpha = 1.0 - smoothstep(-pxWidth * 1.5, pxWidth * 0.5, aDist);
    // 亮白到青绿微渐变
    fgR = 240; fgG = 253; fgB = 250;
  } else if (inFrame && Math.abs(dFrame) < pxWidth * 1.2) {
    fgAlpha = 0.4;
    fgR = 148; fgG = 163; fgB = 184;
  }

  // 颜色混合
  const rOut = Math.round(bgR * (1 - fgAlpha) + fgR * fgAlpha);
  const gOut = Math.round(bgG * (1 - fgAlpha) + fgG * fgAlpha);
  const bOut = Math.round(bgB * (1 - fgAlpha) + fgB * fgAlpha);
  const aOut = Math.round(bgAlpha * 255);

  return [rOut, gOut, bOut, aOut];
}

const sizes = [16, 48, 128];
for (const s of sizes) {
  const png = createPng(s, s, renderPixel);
  const targetPath = path.join(ROOT, 'extension', 'icons', `icon${s}.png`);
  fs.writeFileSync(targetPath, png);
  console.log(`✅ Generated icon${s}.png (${png.length} bytes) -> ${targetPath}`);
}

// 提取 128x128 的 base64 供 mark.js 替换
const icon128Buf = fs.readFileSync(path.join(ROOT, 'extension', 'icons', 'icon128.png'));
const b64 = icon128Buf.toString('base64');
console.log('Icon128 Base64 Length:', b64.length);

// 替换 extension/mark.js 中的 AVATAR_B64
const markPath = path.join(ROOT, 'extension', 'mark.js');
let markContent = fs.readFileSync(markPath, 'utf8');
markContent = markContent.replace(/const AVATAR_B64 = '[^']+';/, `const AVATAR_B64 = '${b64}';`);
fs.writeFileSync(markPath, markContent);
console.log('✅ Updated AVATAR_B64 in extension/mark.js');
