// 生成 PWA 图标（纯 Node，零依赖）：AI 面师 —— 靛蓝圆角底 + 白色对话气泡 + 三个点
// 用法：node scripts/gen-pwa-icons.js
// 输出到 public/：icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png
// PNG 用 zlib 手写编码（IHDR/IDAT/IEND + CRC32），无需 sharp/canvas。

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // 每行前加 filter byte 0
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- 绘制 ----------
// 形状判定（坐标以 size 归一化的浮点，0..size）

function inRoundedRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const cx = Math.max(x0 + r, Math.min(px, x1 - r));
  const cy = Math.max(y0 + r, Math.min(py, y1 - r));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function inTri(px, py, ax, ay, bx, by, cx, cy) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
  const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
  return !(hasNeg && hasPos);
}

// 采样一个亚像素点，返回颜色 [r,g,b]；null=形状外（透明）
// cfg.round=false → 满幅背景（maskable）；true → 圆角矩形背景，圆角外透明
function sample(cfg, sx, sy) {
  const s = cfg.size;
  const bg = cfg.bg; // [r,g,b]
  const dot = cfg.dot;
  const white = [255, 255, 255];

  const outer = cfg.round
    ? inRoundedRect(sx, sy, 0, 0, s, s, cfg.radius)
    : sx >= 0 && sx <= s && sy >= 0 && sy <= s;
  if (!outer) return null;

  const b = cfg.bubble; // {x0,y0,x1,y1,r}
  const inBubble = inRoundedRect(sx, sy, b.x0 * s, b.y0 * s, b.x1 * s, b.y1 * s, b.r * s);
  const t = cfg.tail;
  const inTail = inTri(sx, sy, t[0].x * s, t[0].y * s, t[1].x * s, t[1].y * s, t[2].x * s, t[2].y * s);
  if (inBubble || inTail) {
    for (const d of cfg.dots) {
      const dx = sx - d.x * s;
      const dy = sy - d.y * s;
      if (dx * dx + dy * dy <= (d.r * s) * (d.r * s)) return dot;
    }
    return white;
  }
  return bg;
}

// 超采样 3x3 → 抗锯齿；返回 PNG Buffer
function render(cfg) {
  const size = cfg.size;
  const SS = 3;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let aSum = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const col = sample(cfg, px, py);
          if (col) {
            aSum += 1;
            rSum += col[0];
            gSum += col[1];
            bSum += col[2];
          }
        }
      }
      const i = (y * size + x) * 4;
      const n = SS * SS;
      if (aSum === 0) {
        rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0;
      } else {
        rgba[i] = Math.round(rSum / aSum);
        rgba[i + 1] = Math.round(gSum / aSum);
        rgba[i + 2] = Math.round(bSum / aSum);
        rgba[i + 3] = Math.round((aSum / n) * 255);
      }
    }
  }
  return encodePNG(size, size, rgba);
}

// ---------- 配置 ----------
const INDIGO = [99, 102, 241]; // #6366f1
const INDIGO_DARK = [67, 56, 202]; // #4338ca 三个点

function baseConfig(size, round) {
  // maskable 用更内缩版式保证安全区（round=false → inset 0.82）
  const inset = round ? 1 : 0.82;
  const bw = 0.58 * inset;
  const bh = 0.44 * inset;
  const b = {
    x0: 0.5 - bw / 2,
    x1: 0.5 + bw / 2,
    y0: 0.53 - bh / 2,
    y1: 0.53 + bh / 2,
    r: 0.1 * inset,
  };
  const tail = [
    { x: b.x0 + 0.1, y: b.y1 },
    { x: b.x0 + 0.24, y: b.y1 },
    { x: b.x0 + 0.12, y: b.y1 + 0.14 * inset },
  ];
  const dy = (b.y0 + b.y1) / 2;
  const dots = [-0.13, 0, 0.13].map((off) => ({
    x: 0.5 + off * 0.62,
    y: dy,
    r: 0.032 * inset,
  }));
  return {
    size,
    round,
    radius: 0.225 * size,
    bg: INDIGO,
    dot: INDIGO_DARK,
    bubble: b,
    tail,
    dots,
  };
}

function main() {
  const outDir = path.join(__dirname, "..", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const jobs = [
    ["icon-192.png", baseConfig(192, true)],
    ["icon-512.png", baseConfig(512, true)],
    ["icon-maskable-512.png", baseConfig(512, false)],
    ["apple-touch-icon.png", baseConfig(180, true)],
  ];
  for (const [name, cfg] of jobs) {
    const png = render(cfg);
    const file = path.join(outDir, name);
    fs.writeFileSync(file, png);
    console.log("wrote", path.relative(process.cwd(), file), `${cfg.size}x${cfg.size}`, `${png.length} bytes`);
  }
}

main();
