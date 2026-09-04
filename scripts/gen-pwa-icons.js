// 生成 PWA 图标（纯 Node，零依赖）：AI 面师 —— 靛蓝圆角底 + 双对话泡错落上升（A 方向「逐级对话」）
// 用法：node scripts/gen-pwa-icons.js
// 输出到 public/：icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png
// PNG 用 zlib 手写编码（IHDR/IDAT/IEND + CRC32），无需 sharp/canvas。
// 几何与 src/components/Logo.tsx、public/logo.svg 保持同一 100 网格（unit 值见 SHAPES）。

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

// ---------- 几何（归一化 100 网格，unit 值直接与 Logo.tsx / logo.svg 换算）----------
const SHAPES = {
  // 主泡（下左，你/当前场）：带左下尾
  main: { x0: 0.1, y0: 0.47, x1: 0.72, y1: 0.88, r: 0.16 },
  tail: [
    { x: 0.3, y: 0.88 },
    { x: 0.46, y: 0.88 },
    { x: 0.24, y: 0.97 },
  ],
  // 次级泡（上右，AI/下一级）——与主泡斜向错开成上升阶梯
  reply: { x0: 0.54, y0: 0.1, x1: 0.9, y1: 0.38, r: 0.13 },
};

// ---------- 绘制 ----------
// 形状判定（坐标以 unit 0..1）

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

// 缩放 unit 值到安全区（maskable inset）：绕画布中心 (0.5,0.5) 等比内缩
function scaleUnit(v, inset) {
  return 0.5 + (v - 0.5) * inset;
}

// 生成返回「unit 命中测试」的闭包
function makeRr(spec, inset) {
  const x0 = scaleUnit(spec.x0, inset);
  const x1 = scaleUnit(spec.x1, inset);
  const y0 = scaleUnit(spec.y0, inset);
  const y1 = scaleUnit(spec.y1, inset);
  const r = spec.r * inset;
  return (ux, uy) => inRoundedRect(ux, uy, x0, y0, x1, y1, r);
}

function makeTri(spec, inset) {
  return (ux, uy) =>
    inTri(
      ux,
      uy,
      scaleUnit(spec[0].x, inset),
      scaleUnit(spec[0].y, inset),
      scaleUnit(spec[1].x, inset),
      scaleUnit(spec[1].y, inset),
      scaleUnit(spec[2].x, inset),
      scaleUnit(spec[2].y, inset)
    );
}

// 采样一个亚像素点，返回颜色 [r,g,b]；null=形状外（透明）
// cfg.round=false → 满幅背景（maskable）；true → 圆角矩形背景，圆角外透明
function sample(cfg, sx, sy) {
  const s = cfg.size;
  const bg = cfg.bg; // [r,g,b]
  const white = [255, 255, 255];

  const outer = cfg.round
    ? inRoundedRect(sx / s, sy / s, 0, 0, 1, 1, cfg.radius / s)
    : sx >= 0 && sx <= s && sy >= 0 && sy <= s;
  if (!outer) return null;

  for (const hit of cfg.whites) {
    if (hit(sx / s, sy / s)) return white;
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

function baseConfig(size, round) {
  // maskable 用更内缩版式保证安全区（round=false → inset 0.82）
  const inset = round ? 1 : 0.82;
  const whites = [makeRr(SHAPES.main, inset), makeTri(SHAPES.tail, inset), makeRr(SHAPES.reply, inset)];
  return {
    size,
    round,
    radius: 0.225 * size,
    bg: INDIGO,
    whites,
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
