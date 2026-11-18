import {drawText, textWidth} from './font';
import {S, BAR, washKicks, dropHits, DROP_FLIGHT, clamp, ease, easeOut} from './timeline';

export const W = 180;
export const H = 320;
const TAU = Math.PI * 2;
const P = {
  bg: '#1a1f3d', bg2: '#222850', ink: '#0b0e20', dark: '#141935', cream: '#f2e2c0', creamD: '#cdb894', creamL: '#fff6e2',
  orange: '#ff6b35', yellow: '#ffd23f', pink: '#ff5fa2', steel: '#8e9ad8', steelD: '#5c669e', steelDD: '#3a4172', steelL: '#c9d0f4',
  water: '#3f9cff', waterD: '#2463c4', waterL: '#a6dbff', teal: '#3ec9a7', tealD: '#24806b', red: '#ff4057', white: '#ffffff',
  glass: '#253a78', copper: '#e0803a', rubber: '#2d2f45',
};

let ctx: CanvasRenderingContext2D;
let cam = {x: 90, y: 170, z: 1};
let dither = 1;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const sx = (x: number) => (x - cam.x) * cam.z + 90;
const sy = (y: number) => (y - cam.y) * cam.z + 170;

// ---------- raster primitives (all go through hline/vline so dithering works) ----------
function hline(x0: number, x1: number, y: number, c: string) {
  if (y < 0 || y >= H) return;
  x0 = Math.max(0, x0); x1 = Math.min(W, x1);
  if (x1 <= x0) return;
  ctx.fillStyle = c;
  if (dither >= 1) { ctx.fillRect(x0, y, x1 - x0, 1); return; }
  for (let x = x0; x < x1; x++) if (bay(x, y) < dither) ctx.fillRect(x, y, 1, 1);
}
function vline(x: number, y0: number, y1: number, c: string) {
  if (x < 0 || x >= W) return;
  y0 = Math.max(0, y0); y1 = Math.min(H, y1);
  if (y1 <= y0) return;
  ctx.fillStyle = c;
  if (dither >= 1) { ctx.fillRect(x, y0, 1, y1 - y0); return; }
  for (let y = y0; y < y1; y++) if (bay(x, y) < dither) ctx.fillRect(x, y, 1, 1);
}
function srect(x: number, y: number, w: number, h: number, c: string) { for (let yy = y; yy < y + h; yy++) hline(x, x + w, yy, c); }
function rect(x: number, y: number, w: number, h: number, c: string) {
  const x0 = Math.round(sx(x)), y0 = Math.round(sy(y));
  const x1 = Math.max(x0 + 1, Math.round(sx(x + w))), y1 = Math.max(y0 + 1, Math.round(sy(y + h)));
  srect(x0, y0, x1 - x0, y1 - y0, c);
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
  const X = sx(cx), Y = sy(cy), RX = rx * cam.z, RY = ry * cam.z;
  for (let yy = Math.floor(Y - RY); yy <= Math.ceil(Y + RY); yy++) {
    const dy = (yy + 0.5 - Y) / RY;
    if (Math.abs(dy) > 1) continue;
    const h = RX * Math.sqrt(1 - dy * dy);
    const a = Math.round(X - h), b = Math.max(a + 1, Math.round(X + h));
    hline(a, b, yy, c);
  }
}
const disc = (cx: number, cy: number, r: number, c: string) => ellipse(cx, cy, r, r, c);
function ring(cx: number, cy: number, r: number, t: number, c: string) {
  const X = sx(cx), Y = sy(cy), RO = r * cam.z, RI = Math.max(0, (r - t) * cam.z);
  for (let yy = Math.floor(Y - RO); yy <= Math.ceil(Y + RO); yy++) {
    const dy = yy + 0.5 - Y;
    if (Math.abs(dy) > RO) continue;
    const ho = Math.sqrt(RO * RO - dy * dy);
    if (Math.abs(dy) < RI) {
      const hi = Math.sqrt(RI * RI - dy * dy);
      let a = Math.round(X - ho), b = Math.max(a + 1, Math.round(X - hi));
      hline(a, b, yy, c);
      a = Math.round(X + hi); b = Math.max(a + 1, Math.round(X + ho));
      hline(a, b, yy, c);
    } else {
      const a = Math.round(X - ho);
      hline(a, Math.max(a + 1, Math.round(X + ho)), yy, c);
    }
  }
}
function poly(pts: number[][], c: string) {
  const p = pts.map(([x, y]) => [sx(x), sy(y)]);
  const ys = p.map((q) => q[1]);
  for (let yy = Math.floor(Math.min(...ys)); yy <= Math.ceil(Math.max(...ys)); yy++) {
    const yc = yy + 0.5, xs: number[] = [];
    for (let i = 0; i < p.length; i++) {
      const [ax, ay] = p[i], [bx, by] = p[(i + 1) % p.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.round(xs[i]);
      hline(a, Math.max(a + 1, Math.round(xs[i + 1])), yy, c);
    }
  }
}
function sline(x0: number, y0: number, x1: number, y1: number, c: string, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), stx = x0 < x1 ? 1 : -1, sty = y0 < y1 ? 1 : -1;
  const o = Math.floor((w - 1) / 2);
  let err = dx + dy;
  for (let guard = 0; guard < 2000; guard++) {
    for (let k = 0; k < w; k++) hline(x0 - o, x0 - o + w, y0 - o + k, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += stx; }
    if (e2 <= dx) { err += dx; y0 += sty; }
  }
}
const line = (x0: number, y0: number, x1: number, y1: number, c: string, w = 1) =>
  sline(sx(x0), sy(y0), sx(x1), sy(y1), c, Math.max(1, Math.round(w * cam.z)));
function dot(x: number, y: number, c: string, s = 1) {
  const n = Math.max(1, Math.round(s * cam.z));
  srect(Math.round(sx(x) - n / 2), Math.round(sy(y) - n / 2), n, n, c);
}
function pipe(pts: number[][], w: number, c: string) {
  for (let i = 0; i + 1 < pts.length; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], P.ink, w + 2);
  for (let i = 0; i + 1 < pts.length; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, w);
}
// moving dashes along a polyline (shows flow)
function flow(pts: number[][], f: number, c: string, speed = 1.2, gap = 6) {
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const L = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < L; s += 1) {
      const d = acc + s - f * speed;
      if (((d % gap) + gap) % gap < 2) dot(ax + ((bx - ax) * s) / L, ay + ((by - ay) * s) / L, c, 1);
    }
    acc += L;
  }
}
const txt = (s: string, x: number, y: number, sc: number, c: string, o: Parameters<typeof drawText>[6] = {}) => drawText(ctx, s, x, y, sc, c, o);

// ---------- timeline state ----------
const OMEGA_SLOW = 16.5 / DROP_FLIGHT / 44; // drop leaves with rim speed and crosses the 3px gap in DROP_FLIGHT frames
function omegaAt(f: number) {
  if (f < S.fill) return 0.03;
  if (f < S.wash) return 0;
  if (f < S.motor) {
    const k = Math.floor((f - S.wash) / BAR), q = (f - S.wash) % BAR;
    return (k % 2 === 0 ? 1 : -1) * 0.09 * Math.min(1, q / 8, (BAR - q) / 8);
  }
  if (f < S.drain) return 0.09;
  if (f < S.spin) return 0.035;
  if (f < S.slow) return 0.035 + (0.62 - 0.035) * ease((f - S.spin) / 130);
  if (f < S.done) return OMEGA_SLOW;
  if (f < S.door) return 0.62 * Math.pow(clamp(1 - (f - S.done) / 38), 2);
  return 0;
}
const TH = new Float64Array(S.end + 2);
for (let f = 0; f <= S.end; f++) TH[f + 1] = TH[f] + omegaAt(f);
function rpmAt(f: number): number | null {
  if (f >= S.wash && f < S.motor) return Math.round((Math.abs(omegaAt(f)) / 0.09) * 50);
  if (f >= S.spin && f < S.slow) return Math.round(40 + 1160 * ease((f - S.spin) / 130));
  if (f >= S.slow && f < S.done) return 1200;
  if (f >= S.done && f < S.door) return Math.round(1200 * Math.pow(clamp(1 - (f - S.done) / 38), 2));
  return null;
}
const fmt = (n: number) => (n >= 1000 ? `${Math.floor(n / 1000)}.${String(n % 1000).padStart(3, '0')}` : String(n));
function waterY(f: number) {
  if (f >= S.fill + 22 && f < S.drain) return 219 - 33 * ease((f - (S.fill + 22)) / 55);
  if (f >= S.drain && f < S.spin) return 186 + 34 * ease((f - (S.drain + 4)) / 66);
  return 999;
}
const lastKick = (f: number) => { let k = -999; for (const t of washKicks) if (t <= f) k = t; return k; };

type Cam = [number, number, number, number];
const CAMS: Cam[] = [
  [0, 90, 170, 1], [60, 90, 170, 1], [80, 90, 184, 3.2],
  [80, 60, 128, 1.6], [116, 60, 128, 1.6], [134, 90, 172, 1], [S.wash, 90, 172, 1], [176, 90, 172, 1.18], [S.motor, 90, 172, 1.3],
  [S.motor, 90, 175, 1], [S.drain, 90, 178, 1.05],
  [S.drain, 96, 190, 1.05], [416, 106, 198, 1.3], [S.spin, 106, 198, 1.3], [500, 90, 172, 1], [S.slow, 90, 172, 1],
  [662, 128, 172, 1.9], [756, 128, 172, 1.9], [790, 90, 172, 1], [S.door, 90, 172, 1],
  [S.door, 90, 172, 1], [S.outro, 90, 172, 1], [S.end, 90, 176, 1.08],
];
function camAt(f: number) {
  for (let i = CAMS.length - 2; i >= 0; i--) {
    const a = CAMS[i], b = CAMS[i + 1];
    if (f >= a[0] && a[0] !== b[0]) {
      const t = ease((f - a[0]) / (b[0] - a[0]));
      return {x: a[1] + (b[1] - a[1]) * t, y: a[2] + (b[2] - a[2]) * t, z: a[3] + (b[3] - a[3]) * t};
    }
  }
  return {x: 90, y: 170, z: 1};
}

// ---------- clothes ----------
const CLOTHES = [
  {c: P.red, d: '#a12339', r: 7, land: -0.38, lift: 2.0, off: 0.3},
  {c: P.yellow, d: '#c2950f', r: 6, land: 0.02, lift: 1.55, off: 1.6},
  {c: P.teal, d: P.tealD, r: 7, land: 0.4, lift: 2.25, off: 2.8},
  {c: P.pink, d: '#b33f78', r: 5, land: -0.12, lift: 1.3, off: 4.0},
  {c: '#e6e9ff', d: '#9198c4', r: 6, land: 0.2, lift: 1.85, off: 5.1},
];
let CX = 90, CY = 172;
const polar = (a: number, r: number) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
function clothPos(i: number, f: number): number[] {
  const c = CLOTHES[i], dist = 41 - c.r, base = Math.PI / 2 + c.land;
  const rest = polar(base, dist);
  if (f >= S.wash && f < S.motor) {
    const start = S.wash + Math.floor((f - S.wash) / 40) * 40, p = (f - start) / 40;
    const d = Math.floor((start - S.wash) / BAR) % 2 === 0 ? 1 : -1;
    if (p < 0.6) return polar(base + d * c.lift * ease(p / 0.6), dist);
    const s = (p - 0.6) / 0.4, A = polar(base + d * c.lift, dist);
    return [A[0] + (rest[0] - A[0]) * s, A[1] + (rest[1] - A[1]) * s * s];
  }
  if (f >= S.spin && f < S.door) {
    const wall = polar(TH[f] + c.off, 42 - c.r);
    const t = ease((f - S.spin) / 24);
    return [rest[0] + (wall[0] - rest[0]) * t, rest[1] + (wall[1] - rest[1]) * t];
  }
  return rest;
}
function cloth(x: number, y: number, c: (typeof CLOTHES)[number]) {
  ellipse(x, y, c.r + 1, c.r * 0.85 + 1, P.ink);
  ellipse(x + 1, y + 1, c.r - 0.5, c.r * 0.85 - 0.5, c.d);
  ellipse(x - 0.5, y - 0.5, c.r - 1.5, c.r * 0.85 - 1.5, c.c);
  dot(x - c.r * 0.35, y - c.r * 0.35, P.white, 1);
  line(x - c.r * 0.6, y + 1, x + c.r * 0.5, y + 1, c.d, 1);
}

// ---------- scene pieces ----------
function cabinet(f: number) {
  rect(22, 88, 136, 162, P.ink);
  rect(24, 90, 132, 158, P.cream);
  rect(150, 90, 6, 158, P.creamD);
  rect(28, 106, 122, 138, P.dark);
  for (let x = 34; x < 150; x += 12) rect(x, 106, 1, 138, '#181e3d');
  rect(24, 104, 132, 2, P.ink);
  rect(30, 92, 30, 10, P.ink); rect(31, 93, 28, 8, P.steelL); // detergent drawer
  for (let i = 0; i < 6; i++) dot(35 + i * 4, 98, i % 2 ? P.white : P.waterL, 1); // soap powder
  rect(108, 93, 30, 9, P.ink);
  disc(146, 97, 5, P.ink); disc(146, 97, 4, P.steelL); line(146, 97, 146 + Math.cos(f * 0.02) * 3, 97 - 3, P.ink, 1);
  rect(28, 250, 10, 4, P.ink); rect(142, 250, 10, 4, P.ink);
}
function panelText(s: string, x: number, y: number, c: string) {
  const sc = Math.max(1, Math.round(cam.z));
  if (sc !== 1) return;
  txt(s, Math.round(sx(x)), Math.round(sy(y)), 1, c);
}
function springsDampers(f: number) {
  for (const [ax, ay, bx, by] of [[38, 107, CX - 33, CY - 33], [142, 107, CX + 33, CY - 33]]) {
    const n = 9, pts: number[][] = [];
    const L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
    for (let i = 0; i <= n; i++) {
      const t = i / n, o = i === 0 || i === n ? 0 : (i % 2 ? 3 : -3);
      pts.push([ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o]);
    }
    for (let i = 0; i < n; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], P.ink, 3);
    for (let i = 0; i < n; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], P.copper, 1);
  }
  for (const [ax, ay, bx, by] of [[CX - 26, CY + 43, 44, 244], [CX + 26, CY + 43, 136, 244]]) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    line(ax, ay, mx, my, P.ink, 3); line(ax, ay, mx, my, P.steelL, 1);
    line(mx, my, bx, by, P.ink, 6); line(mx, my, bx, by, P.teal, 4);
    rect(bx - 4, 244, 8, 3, P.ink);
  }
}
function inletAndDrain(f: number) {
  // inlet hose + solenoid valve + drawer hose
  pipe([[-60, 113], [30, 113]], 3, P.rubber);
  rect(29, 107, 14, 12, P.ink); rect(30, 108, 12, 10, P.steel);
  const open = f >= 96 && f < 158;
  rect(32, 109, 8, 6, P.copper); for (let y = 110; y < 115; y += 2) rect(32, y, 8, 1, '#a0521c');
  rect(35, open ? 103 : 105, 2, 4, P.steelL); // plunger lifts when energised
  pipe([[36, 107], [36, 102]], 2, P.steelD);
  pipe([[54, 102], [54, 112], [64, 127]], 3, P.rubber);
  if (open) {
    flow([[-60, 113], [36, 113], [36, 102]], f, P.waterL, 1.6);
    flow([[54, 102], [54, 112], [64, 127]], f, P.waterL, 1.6);
    if (f > 104) for (let i = 0; i < 3; i++) { const t = ((f * 1.3 + i * 9) % 28) / 28; dot(54 + (i === 1 ? 3 : 0), 102 + t * 10, P.white, 1); }
    // falling stream into the tub
    const top = 128, bottom = Math.min(waterY(f), 214);
    for (let y = top; y < bottom; y += 1) if ((y + f * 3) % 5 < 3) dot(66 + Math.sin(y * 0.4) * 0.6, y, P.waterL, 1.4);
    if (f % 8 < 4) { dot(70, 108, P.yellow, 1); dot(72, 106, P.yellow, 1); }
  }
  // drain pipe + pump + outlet hose
  const pumping = f >= S.drain + 4 && f < S.drain + 74;
  pipe([[CX, 222], [CX, 236], [101, 236]], 3, P.rubber);
  pipe([[114, 236], [150, 236], [150, 118], [200, 118]], 3, P.rubber);
  disc(108, 236, 8, P.ink); disc(108, 236, 7, P.steel); disc(108, 236, 5, P.ink);
  const pa = pumping ? f * 0.8 : 0;
  for (let k = 0; k < 4; k++) line(108, 236, 108 + Math.cos(pa + (k * TAU) / 4) * 4, 236 + Math.sin(pa + (k * TAU) / 4) * 4, P.yellow, 1);
  disc(108, 236, 1.2, P.steelL);
  if (pumping) {
    flow([[CX, 222], [CX, 236], [101, 236]], f, '#7fb4ff', 1.8);
    flow([[114, 236], [150, 236], [150, 118], [200, 118]], f, '#7fb4ff', 1.8);
  }
}
function tubAndDrum(f: number, clothesOn = true) {
  const th = TH[f], om = omegaAt(f), blur = clamp((Math.abs(om) - 0.2) / 0.3);
  ring(CX, CY, 50, 3, P.ink);
  ring(CX, CY, 49, 2, P.steelD);
  disc(CX, CY, 47, '#10142e');
  disc(CX, CY, 43, P.steelDD);
  for (const [rr, n] of [[12, 6], [24, 12], [34, 18]]) {
    if (blur > 0.3) { dither = 0.5; ring(CX, CY, rr + 1, 1, '#2a3060'); dither = 1; continue; }
    for (let k = 0; k < n; k++) { const [x, y] = polar(th + (k * TAU) / n + rr, rr); dot(x, y, '#252a55', 1.5); }
  }
  disc(CX, CY, 5, P.steelD); disc(CX, CY, 2, P.ink);
  const wy = waterY(f);
  const kAmp = f >= S.wash && f < S.motor + 6 ? 3 * Math.exp(-(f - lastKick(f)) / 7) : 0;
  const drawWater = (alpha: number) => {
    if (wy > 218) return;
    const X = sx(CX), Y = sy(CY), R = 47 * cam.z, YW = sy(wy);
    dither = alpha;
    for (let x = Math.floor(X - R); x <= Math.ceil(X + R); x++) {
      const dx = x + 0.5 - X;
      if (Math.abs(dx) > R) continue;
      const h = Math.sqrt(R * R - dx * dx), u = (x - X) / cam.z;
      const surf = Math.round(YW + (kAmp * Math.sin(u * 0.25 + f * 0.5) + 0.8 * Math.sin(u * 0.13 - f * 0.12)) * cam.z);
      const top = Math.max(surf, Math.round(Y - h)), bot = Math.round(Y + h);
      if (bot <= top) continue;
      vline(x, top, bot, P.water);
      vline(x, top, Math.min(bot, top + Math.max(1, Math.round(cam.z))), P.waterL);
      if (alpha >= 1 && f >= S.wash && f < S.motor && hash(x * 3.1 + Math.floor(f / 5)) < 0.18) vline(x, top - 1, top, P.white);
    }
    dither = 1;
  };
  drawWater(1);
  if (clothesOn) {
    CLOTHES.forEach((c, i) => {
      if (blur > 0) {
        dither = 0.35;
        for (let g = 1; g <= 3; g++) { const p = clothPos(i, f); const a = Math.atan2(p[1] - CY, p[0] - CX) - om * g * 0.33; const q = polar(a, Math.hypot(p[0] - CX, p[1] - CY)); cloth(q[0], q[1], c); }
        dither = 1;
      }
      const [x, y] = clothPos(i, f);
      cloth(x, y, c);
    });
  }
  drawWater(0.45);
  // splash after clothes land on the beat
  if (f >= S.wash && f < S.motor + 8) {
    const k = lastKick(f), dt = f - k;
    if (k > 0 && dt < 12) for (let i = 0; i < 10; i++) {
      const vx = (hash(k + i) - 0.5) * 2.6, vy = -1.4 - hash(k * 2 + i) * 1.6;
      const x = CX - 10 + hash(k * 3 + i) * 20 + vx * dt, y = wy + vy * dt + 0.16 * dt * dt;
      if (y < wy + 1) dot(x, y, i % 3 ? P.waterL : P.white, 1.5);
    }
  }
  // drum rim + paddles
  ring(CX, CY, 44, 4, P.ink);
  ring(CX, CY, 43.5, 3, P.steel);
  ring(CX, CY, 43.5, 1, P.steelL);
  const paddles = (a0: number) => {
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * TAU) / 3;
      poly([polar(a - 0.2, 43), polar(a + 0.2, 43), polar(a + 0.1, 30), polar(a - 0.1, 30)], P.ink);
      poly([polar(a - 0.15, 42), polar(a + 0.15, 42), polar(a + 0.06, 31.5), polar(a - 0.06, 31.5)], P.steelL);
      poly([polar(a + 0.02, 42), polar(a + 0.15, 42), polar(a + 0.06, 31.5), polar(a + 0.02, 31.5)], P.steel);
    }
  };
  if (blur > 0) { dither = 0.35; for (let g = 1; g <= 3; g++) paddles(th - om * g * 0.33); dither = 1; }
  paddles(th);
  if (blur < 0.5) for (let k = 0; k < 24; k++) { const [x, y] = polar(th + (k * TAU) / 24 + 0.13, 42.2); dot(x, y, P.steelDD, 1); }
  // water flung out during the spin (real speed)
  if (f >= S.spin + 20 && f < S.slow) {
    for (let i = 0; i < 12 * blur; i++) {
      const a = hash(f * 7 + i) * TAU, r = 44 + hash(f * 3 + i) * 3;
      const [x, y] = polar(a, r), [x2, y2] = polar(a + 0.12, r + 1);
      line(x, y, x2, y2, P.waterL, 1);
    }
  }
}
function rearView(f: number) {
  rect(22, 88, 136, 162, P.ink); rect(24, 90, 132, 158, P.cream); rect(150, 90, 6, 158, P.creamD);
  rect(28, 94, 122, 150, P.dark);
  for (const [x, y] of [[32, 98], [146, 98], [32, 240], [146, 240]]) { disc(x, y, 2, P.steelD); dot(x, y, P.ink, 1); }
  rect(28, 250, 10, 4, P.ink); rect(142, 250, 10, 4, P.ink);
  const C1 = [90, 160], R = 47, C2 = [90, 228], r = 5.6, th = TH[f];
  // motor body
  rect(58, 219, 64, 19, P.ink); rect(60, 221, 60, 15, P.steelD);
  for (let x = 63; x < 118; x += 4) rect(x, 221, 1, 15, P.steelDD);
  rect(60, 221, 60, 2, P.steel);
  rect(120, 224, 6, 9, P.ink); rect(121, 225, 4, 7, P.copper);
  // big pulley
  disc(C1[0], C1[1], R + 1, P.ink); disc(C1[0], C1[1], R, P.steelD);
  ring(C1[0], C1[1], R, 4, P.steel); ring(C1[0], C1[1], R - 1, 1, P.steelL);
  for (let k = 0; k < 5; k++) {
    const a = th + (k * TAU) / 5;
    line(C1[0] + Math.cos(a) * 8, C1[1] + Math.sin(a) * 8, C1[0] + Math.cos(a) * 42, C1[1] + Math.sin(a) * 42, P.ink, 5);
    line(C1[0] + Math.cos(a) * 8, C1[1] + Math.sin(a) * 8, C1[0] + Math.cos(a) * 42, C1[1] + Math.sin(a) * 42, P.steel, 3);
  }
  disc(C1[0], C1[1], 9, P.ink); disc(C1[0], C1[1], 8, P.steelL); disc(C1[0], C1[1], 3, P.ink);
  // belt path: arc around big pulley (far side) + tangents + arc under small pulley
  const RB = R + 1.5, rb = r + 1.5, d = C2[1] - C1[1], beta = Math.acos((RB - rb) / d);
  const down = Math.PI / 2, pts: number[][] = [];
  for (let a = down + beta; a <= down + TAU - beta + 1e-6; a += 0.03) pts.push([C1[0] + Math.cos(a) * RB, C1[1] + Math.sin(a) * RB]);
  const s0 = [C2[0] + Math.cos(down - beta) * rb, C2[1] + Math.sin(down - beta) * rb];
  pts.push(s0);
  for (let a = down - beta; a <= down + beta + 1e-6; a += 0.1) pts.push([C2[0] + Math.cos(a) * rb, C2[1] + Math.sin(a) * rb]);
  pts.push(pts[0]);
  let acc = 0;
  const v = 0.09 * RB;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < L; s += 0.7) {
      const q = acc + s + f * v;
      const x = ax + ((bx - ax) * s) / L, y = ay + ((by - ay) * s) / L;
      dot(x, y, P.ink, 3);
    }
    acc += L;
  }
  acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < L; s += 0.7) {
      const q = acc + s + f * v;
      dot(ax + ((bx - ax) * s) / L, ay + ((by - ay) * s) / L, ((q % 8) + 8) % 8 < 4 ? P.orange : '#8a3a1c', 1);
    }
    acc += L;
  }
  // small pulley spins ~10x faster (motion blur)
  disc(C2[0], C2[1], r + 1, P.ink); disc(C2[0], C2[1], r, P.steelL);
  dither = 0.5; ring(C2[0], C2[1], r - 1.5, 1, P.steelD); dither = 1;
  disc(C2[0], C2[1], 1.5, P.ink);
}
function frontMachine(f: number, open: number, display: string) {
  ellipse(90, 252, 64, 4, '#11152c');
  rect(34, 98, 112, 152, P.ink); rect(36, 100, 108, 148, P.cream); rect(138, 100, 6, 148, P.creamD);
  rect(36, 100, 108, 22, P.creamD); rect(36, 122, 108, 1, P.ink);
  rect(40, 104, 30, 14, P.ink); rect(41, 105, 28, 12, P.creamL); rect(48, 113, 14, 2, P.creamD);
  rect(96, 104, 30, 14, P.ink); rect(97, 105, 28, 12, '#0f2a2a');
  panelText(display, 99, 108, P.teal);
  disc(134, 111, 6, P.ink); disc(134, 111, 5, P.steelL); line(134, 111, 134, 107, P.ink, 1);
  rect(36, 236, 108, 1, P.creamD); rect(36, 237, 108, 11, P.creamD);
  const C = [90, 182];
  // opening + drum seen through it
  disc(C[0], C[1], 37, P.ink); disc(C[0], C[1], 34, P.steelD); disc(C[0], C[1], 30, '#121633');
  const th = TH[f];
  for (let k = 0; k < 16; k++) dot(C[0] + Math.cos(th + (k * TAU) / 16) * 26, C[1] + Math.sin(th + (k * TAU) / 16) * 26, '#262b56', 1.5);
  CLOTHES.forEach((c, i) => {
    const a = open > 0 ? Math.PI / 2 + c.land * 1.6 : th * 1.0 + c.off, rr = open > 0 ? 22 - c.r * 0.6 : 16;
    const s = {...c, r: c.r * 0.75};
    cloth(C[0] + Math.cos(a) * rr, C[1] + Math.sin(a) * rr, s);
  });
  // door (swings open on its left hinge)
  const rx = 36 * (1 - 0.82 * open), cx = 54 + rx - open * 6;
  ellipse(cx, C[1], rx + 1, 37, P.ink);
  ellipse(cx, C[1], rx, 36, P.steel);
  ellipse(cx, C[1], Math.max(1, rx - 6), 30, open > 0 ? '#3b4d8c' : P.glass);
  if (open === 0) { dither = 0.3; disc(C[0], C[1], 29, P.waterL); dither = 1; }
  if (rx > 14) { line(cx - rx * 0.45, C[1] - 18, cx - rx * 0.15, C[1] - 24, P.white, 1); line(cx - rx * 0.5, C[1] - 12, cx - rx * 0.4, C[1] - 14, P.white, 1); }
  ellipse(cx, C[1], rx, 36, P.steel); // keep rim on top
  ellipse(cx, C[1], Math.max(1, rx - 6), 30, open > 0 ? '#3b4d8c' : P.glass);
  if (open === 0) {
    dither = 0.28; disc(C[0], C[1], 29, P.waterL); dither = 1;
    // clothes visible through the glass (re-drawn on top of glass with dither)
    dither = 0.75;
    CLOTHES.forEach((c) => { const a = th + c.off; cloth(C[0] + Math.cos(a) * 16, C[1] + Math.sin(a) * 16, {...c, r: c.r * 0.75}); });
    dither = 1;
    line(C[0] - 16, C[1] - 18, C[0] - 6, C[1] - 24, P.white, 1); line(C[0] - 19, C[1] - 11, C[0] - 17, C[1] - 13, P.white, 1);
  }
  rect(cx + rx - 4, C[1] - 6, 3, 12, P.ink); // handle
}

// ---------- UI ----------
function badge(s: string, x: number, y: number, c: string, align: 'left' | 'right' = 'left') {
  const w = textWidth(s, 1);
  const bx = align === 'left' ? x : x - w - 6;
  srect(bx, y, w + 6, 13, c); srect(bx + 1, y + 1, w + 4, 11, P.bg);
  txt(s, bx + 3, y + 4, 1, c);
}
function header(f: number, start: number, step: string, title: string, sub: string) {
  const t = f - start;
  badge(step, 6, 6, P.pink);
  const dy = Math.round(-24 * (1 - easeOut(t / 9)));
  txt(title, 90, 34 + dy, 2, P.cream, {shadow: P.orange, outline: P.ink, align: 'center'});
  const n = clamp(Math.floor((t - 6) * 1.5), 0, sub.length);
  txt(sub.slice(0, n), 90, 52, 1, P.yellow, {outline: P.ink, align: 'center'});
}
function rpmCounter(f: number) {
  const r = rpmAt(f);
  if (r === null) return;
  txt(fmt(r), 174, 6, 2, P.yellow, {outline: P.ink, align: 'right'});
  txt('RPM', 174, 22, 1, P.cream, {align: 'right'});
}
type Cap = [number, string, string];
const CAPS: Cap[] = [
  [10, 'COMO UMA MÁQUINA DE LAVAR', 'FUNCIONA POR DENTRO?'],
  [86, 'A PLACA ABRE A VÁLVULA', 'SOLENOIDE (UM ÍMÃ ELÉTRICO)'],
  [122, 'A ÁGUA PASSA PELA GAVETA', 'E LEVA O SABÃO JUNTO'],
  [164, 'AS PÁS DO TAMBOR LEVANTAM', 'A ROUPA ATÉ O ALTO...'],
  [204, '...E ELA CAI NA ÁGUA.', 'É ESSE TOMBO QUE LAVA!'],
  [244, 'O TAMBOR GIRA PRA UM LADO,', 'PARA, E GIRA PRO OUTRO'],
  [284, 'ASSIM A ROUPA NÃO ENROLA', 'E O SABÃO ENTRA NO TECIDO'],
  [324, 'O MOTOR GIRA RÁPIDO, MAS', 'COM POUCA FORÇA'],
  [362, 'A POLIA GRANDE É 10X MAIOR:', 'GIRA DEVAGAR COM MUITA FORÇA'],
  [404, 'A BOMBA DE DRENAGEM PUXA', 'A ÁGUA SUJA PELO FUNDO'],
  [442, 'E MANDA PELA MANGUEIRA', 'DIRETO PRO ESGOTO'],
  [484, 'AGORA O TAMBOR ACELERA ATÉ', '1.200 VOLTAS POR MINUTO'],
  [524, 'A ROUPA GRUDA NA PAREDE', 'E A ÁGUA SAI PELOS FUROS'],
  [564, 'MOLAS E AMORTECEDORES', 'SEGURAM A TREMEDEIRA'],
  [604, 'VAMOS VER ISSO EM', 'CÂMERA LENTA...'],
  [644, 'CADA VOLTA DURA SÓ', '0,05 SEGUNDO'],
  [684, 'A FORÇA NA ROUPA CHEGA A', 'QUASE 400X A GRAVIDADE'],
  [724, 'CADA GOTA SAI EM LINHA RETA', '(INÉRCIA) PELOS FURINHOS'],
  [764, 'BATE NO TANQUE E ESCORRE', 'ATÉ A BOMBA'],
  [804, 'O MOTOR DESACELERA', 'E O TAMBOR PARA...'],
  [844, 'A TRAVA SOLTA E A ROUPA', 'SAI SÓ UM POUCO ÚMIDA'],
  [884, 'ENCHE, LAVA, DRENA', 'E CENTRIFUGA. SIMPLES!'],
];
function caption(f: number) {
  let cur: Cap | null = null;
  for (const c of CAPS) if (c[0] <= f) cur = c;
  if (!cur || f > S.end - 20) return;
  const t = f - cur[0];
  const pop = Math.round(6 * (1 - easeOut(t / 5)));
  srect(4, 263 + pop, 172, 38, P.steelDD); srect(5, 264 + pop, 170, 36, P.ink);
  let n = Math.floor(t * 1.8);
  const l1 = cur[1].slice(0, clamp(n, 0, cur[1].length));
  n -= cur[1].length;
  const l2 = cur[2].slice(0, clamp(n, 0, cur[2].length));
  const x1 = Math.round(90 - textWidth(cur[1], 1) / 2), x2 = Math.round(90 - textWidth(cur[2], 1) / 2);
  txt(l1, x1, 272 + pop, 1, P.white);
  txt(l2, x2, 287 + pop, 1, P.white);
  if (n < cur[2].length && f % 6 < 4) {
    const onL2 = n >= 0;
    srect((onL2 ? x2 + l2.length * 6 : x1 + l1.length * 6), (onL2 ? 287 : 272) + pop, 5, 7, P.yellow);
  }
}
function progress(f: number) {
  const step = f < S.wash ? 1 : f < S.motor ? 2 : f < S.drain ? 3 : f < S.spin ? 4 : 5;
  if (f < S.fill || f >= S.door) return;
  for (let i = 0; i < 5; i++) {
    const x = 90 - 24 + i * 10;
    srect(x - 1, 307, 8, 8, P.ink);
    srect(x, 308, 6, 6, i + 1 < step ? P.steelD : i + 1 === step ? P.orange : P.bg2);
  }
}
type Lab = [number, number, string, () => number[], number, number];
function label(f: number, l: Lab) {
  const [a, b, s, tgt, lx, ly] = l;
  if (f < a || f >= b) return;
  const n = clamp(Math.floor((f - a) * 2), 0, s.length);
  const w = textWidth(s, 1), bx = lx, by = ly;
  const [wx, wy] = tgt();
  const tx = Math.round(sx(wx)), ty = Math.round(sy(wy));
  const ex = clamp(tx, bx, bx + w + 4), ey = ty < by ? by - 1 : by + 13;
  sline(ex, ey, tx, ty, P.ink, 3);
  sline(ex, ey, tx, ty, P.yellow, 1);
  srect(tx - 2, ty - 2, 4, 4, P.ink); srect(tx - 1, ty - 1, 2, 2, P.yellow);
  srect(bx - 1, by - 1, w + 6, 15, P.yellow); srect(bx, by, w + 4, 13, P.ink);
  txt(s.slice(0, n), bx + 2, by + 4, 1, P.white);
}
const paddleTip = (f: number) => polar(TH[f] + 0, 36);
const LABELS: Lab[] = [
  [92, S.wash, 'VÁLVULA', () => [36, 112], 8, 200],
  [104, S.wash, 'GAVETA DO SABÃO', () => [45, 97], 84, 70],
  [132, S.wash, 'TANQUE', () => [CX + 35, CY + 35], 120, 238],
  [170, S.motor, 'PÁ', () => paddleTip(curF), 8, 232],
  [176, S.motor, 'TAMBOR', () => [CX + 31, CY - 31], 124, 70],
  [330, S.drain, 'MOTOR', () => [70, 229], 8, 238],
  [338, S.drain, 'CORREIA', () => [42, 175], 6, 112],
  [346, S.drain, 'POLIA', () => [116, 130], 132, 70],
  [410, S.spin, 'BOMBA', () => [108, 236], 20, 238],
  [424, S.spin, 'MANGUEIRA', () => [150, 160], 112, 86],
  [526, 600, 'FUROS', () => polar(-0.8, 44), 130, 70],
  [566, S.slow, 'MOLA', () => [42, 118], 8, 70],
  [570, S.slow, 'AMORTECEDOR', () => [52, 236], 6, 226],
  [688, 724, '~400 G', () => clothPos(0, curF), 6, 226],
];
let curF = 0;

// ---------- frame ----------
export function drawFrame(c: CanvasRenderingContext2D, f: number) {
  ctx = c; curF = f; dither = 1;
  cam = camAt(f);
  CX = 90; CY = 172;
  const om = omegaAt(f);
  if (f >= S.spin && f < S.slow && om > 0.35) { CX += Math.round((hash(f) - 0.5) * 2 * ((om - 0.35) / 0.27)); CY += Math.round((hash(f + 9) - 0.5) * 2); }
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  for (let y = 4; y < H; y += 12) for (let x = 4 + ((y / 12) % 2) * 6; x < W; x += 12) { ctx.fillStyle = P.bg2; ctx.fillRect(x, y, 1, 1); }

  // world (clipped viewport)
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 62, W, 196); ctx.clip();
  if (f < S.fill) frontMachine(f, 0, '1200');
  else if (f < S.motor || (f >= S.drain && f < S.door)) {
    cabinet(f); springsDampers(f); inletAndDrain(f); tubAndDrum(f);
    if (f >= S.door - 40 && f < S.door) panelText('...', 112, 95, P.teal);
  } else if (f < S.drain) rearView(f);
  else frontMachine(f, f >= S.outro ? 1 : ease((f - S.door - 14) / 16), f % 20 < 12 || f >= S.outro ? 'END' : '');
  // slow motion drops -> melody
  if (f >= S.slow && f < S.done) {
    dropHits.forEach((h, k) => {
      const e = h - DROP_FLIGHT;
      if (f < e || f > h + 10) return;
      const target = -0.75 + ((k * 0.618) % 1) * 1.5;
      const step = TAU / 24, th = TH[e];
      const phi = th + Math.round((target - th) / step) * step;
      const p0 = polar(phi, 44), dir = [-Math.sin(phi), Math.cos(phi)], L = 16.5;
      if (f < h) {
        const t = (f - e) / DROP_FLIGHT;
        dither = 0.5;
        for (let g = 1; g <= 3; g++) { const tt = Math.max(0, t - g * 0.08); dot(p0[0] + dir[0] * L * tt, p0[1] + dir[1] * L * tt, P.waterL, 1); }
        dither = 1;
        const x = p0[0] + dir[0] * L * t, y = p0[1] + dir[1] * L * t;
        dot(x, y, P.ink, 2.6); dot(x, y, P.waterL, 1.6);
      } else {
        const dt = f - h, hp = [p0[0] + dir[0] * L, p0[1] + dir[1] * L];
        for (let i = 0; i < 4; i++) {
          const a = phi + Math.PI + (i - 1.5) * 0.5;
          dot(hp[0] + Math.cos(a) * dt * 0.5, hp[1] + Math.sin(a) * dt * 0.5 + dt * dt * 0.02, P.white, 1);
        }
        const nx = Math.round(sx(hp[0])) + 4, ny = Math.round(sy(hp[1])) - 10 - dt * 2;
        dither = 1 - dt / 12;
        txt('♪', nx, ny, 1, P.yellow);
        dither = 1;
      }
    });
    if (f >= 724 && f < 764) {
      const x = 136.5, y0 = 150, y1 = 186;
      line(x, y0, x, y1, P.ink, 3); line(x, y0, x, y1, P.yellow, 1);
      poly([[x - 3, y1 - 3], [x + 3, y1 - 3], [x, y1 + 2]], P.yellow);
      const tx = Math.round(sx(x)) - 50, ty = Math.round(sy(y0)) - 2;
      srect(tx - 1, ty - 1, textWidth('INÉRCIA', 1) + 6, 15, P.yellow); srect(tx, ty, textWidth('INÉRCIA', 1) + 4, 13, P.ink);
      txt('INÉRCIA', tx + 2, ty + 4, 1, P.white);
    }
    // scanlines for the slow-mo look
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    for (let y = 62; y < 258; y += 2) ctx.fillRect(0, y, W, 1);
  }
  for (const l of LABELS) label(f, l);
  ctx.restore();

  // header / UI
  if (f < S.fill) {
    const d1 = Math.round(-40 * (1 - easeOut(f / 10))), d2 = Math.round(-40 * (1 - easeOut((f - 8) / 10)));
    if (f >= 18) badge('POR DENTRO', 6, 6, P.pink);
    if (f >= 22) { txt(fmt(Math.min(1200, Math.round((f - 22) * 110))), 174, 6, 2, P.yellow, {outline: P.ink, align: 'right'}); txt('RPM', 174, 22, 1, P.cream, {align: 'right'}); }
    txt('MÁQUINA', 90, 38 + d1, 4, P.cream, {shadow: P.orange, outline: P.ink, align: 'center'});
    if (f >= 8) txt('DE LAVAR', 90, 72 + d2, 3, P.yellow, {shadow: '#b8620f', outline: P.ink, align: 'center'});
  } else if (f < S.wash) header(f, S.fill, 'PASSO 1/5', 'A ÁGUA ENTRA', 'VÁLVULA + SABÃO');
  else if (f < S.motor) header(f, S.wash, 'PASSO 2/5', 'LAVAGEM', 'PÁS + TAMBOR');
  else if (f < S.drain) header(f, S.motor, 'PASSO 3/5', 'MOTOR', 'CORREIA + POLIAS');
  else if (f < S.spin) header(f, S.drain, 'PASSO 4/5', 'DRENAGEM', "BOMBA D'ÁGUA");
  else if (f < S.door) {
    header(f, S.spin, f >= S.slow && f < S.done ? 'SLOW MOTION' : 'PASSO 5/5', 'CENTRÍFUGA', f >= S.done ? 'DESACELERANDO...' : 'FORÇA CENTRÍFUGA');
    if (f >= S.slow && f < S.done && f % 30 < 20) srect(4, 4, 2, 2, P.red);
  } else if (f < S.outro) {
    const t = f - S.door;
    if (t >= 16) { const d = Math.round(-30 * (1 - easeOut((t - 16) / 8))); txt('PRONTO!', 90, 30 + d, 4, P.cream, {shadow: P.orange, outline: P.ink, align: 'center'}); }
  } else {
    const t = f - S.outro;
    txt('AGORA VOCÊ', 90, 22, 2, P.cream, {outline: P.ink, align: 'center'});
    const d = Math.round(-30 * (1 - easeOut(t / 10)));
    txt('SABE!', 90, 44 + d, 4, P.yellow, {shadow: P.orange, outline: P.ink, align: 'center'});
  }
  if (f >= S.fill && f < S.door) rpmCounter(f);
  caption(f);
  progress(f);

  // transitions (ordered-dither wipes) + fades
  let cover = 0, coverC = P.ink;
  for (const b of [S.fill, S.motor, S.drain, S.door]) cover = Math.max(cover, 1 - Math.abs(f - b) / 6);
  cover = Math.max(cover, 1 - f / 6, (f - (S.end - 24)) / 24);
  if (f >= S.slow && f < S.slow + 6) { cover = Math.max(cover, 1 - (f - S.slow) / 6) * 0.8; coverC = P.creamL; }
  if (cover > 0) {
    ctx.fillStyle = coverC;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bay(x, y) < cover) ctx.fillRect(x, y, 1, 1);
  }
}
