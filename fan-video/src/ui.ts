import {drawText, textWidth, TextOpts} from './font';
import {S, BUTTONS, clamp, easeOut, factorAt, rpmRealAt} from './timeline';
import type {FanScene} from './scene';

export const UW = 360, UH = 640;
const C = {ink: '#11142a', cream: '#fbefd5', creamD: '#d9c39a', red: '#d8333f', blue: '#2a5bd7', blueL: '#9cc0ff', gold: '#e0a83a', navy: '#151a3a', dim: '#33407a', white: '#ffffff'};
let ctx: CanvasRenderingContext2D;
const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const T = (s: string, x: number, y: number, sc: number, c: string, o: TextOpts = {}) => drawText(ctx, s, Math.round(x), Math.round(y), sc, c, o);
const tw = (s: string, sc: number) => textWidth(s.toUpperCase(), sc) + Math.ceil(sc / 2);
function line(x0: number, y0: number, x1: number, y1: number, c: string, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, o = Math.floor((w - 1) / 2);
  let err = dx + dy;
  ctx.fillStyle = c;
  for (let g = 0; g < 3000; g++) {
    ctx.fillRect(x0 - o, y0 - o, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

type Sec = {f: number; n: number; t: string; s: string; facts: [number, string][]};
const SECS: Sec[] = [
  {f: S.title, n: 0, t: 'VENTILADOR', s: 'POR DENTRO', facts: []},
  {f: S.blades, n: 1, t: 'AS PÁS', s: 'EMPURRAM O AR', facts: [[100, 'PÁ INCLINADA = HÉLICE'], [170, '1 VOLTA = 3 EMPURRÕES']]},
  {f: S.motor, n: 2, t: 'QUEM GIRA?', s: 'UM MOTOR ELÉTRICO', facts: [[262, 'MOTOR DE INDUÇÃO'], [320, 'O EIXO LEVA ATÉ AS PÁS']]},
  {f: S.field, n: 3, t: 'COMO ELE GIRA?', s: 'CAMPO MAGNÉTICO', facts: [[420, 'BOBINAS LIGAM EM RODA'], [480, 'E O ROTOR VAI ATRÁS']]},
  {f: S.speeds, n: 4, t: 'VELOCIDADES', s: 'BOTÕES 1, 2 E 3', facts: [[584, 'MAIS CORRENTE = MAIS RPM']]},
  {f: S.osc, n: 5, t: 'OSCILAÇÃO', s: 'A CABEÇA VAI E VOLTA', facts: [[742, 'SEM-FIM GIRA A COROA'], [800, 'BIELA EMPURRA A CABEÇA']]},
  {f: S.slow, n: 6, t: 'CÂMERA LENTA', s: 'O AR SENDO EMPURRADO', facts: [[920, 'CADA PÁ GERA UMA ONDA'], [980, 'ALTA PRESSÃO NA FRENTE']]},
  {f: S.back, n: 0, t: 'PRONTO!', s: 'VENTO FRESQUINHO', facts: []},
  {f: S.outro, n: 0, t: 'AGORA VOCÊ', s: 'SABE COMO FUNCIONA!', facts: []},
];
type Lab = [number, number, string, string, 'L' | 'R', number];
const LABS: Lab[] = [
  [104, S.motor, 'PÁ INCLINADA', 'blade', 'L', 470], [186, S.motor, 'AR', 'air', 'R', 300], [200, S.motor, 'GRADE', 'grille', 'R', 530],
  [272, S.field, 'ROTOR', 'rotor', 'R', 300], [284, S.field, 'BOBINAS', 'coil', 'L', 390], [300, S.field, 'EIXO', 'shaft', 'R', 480],
  [418, S.speeds, 'BOBINA LIGADA', 'coil', 'L', 300], [450, S.speeds, 'ROTOR', 'rotor', 'R', 430], [500, S.speeds, 'CAPACITOR', 'capacitor', 'L', 530],
  [590, S.osc, 'BOTÕES', 'buttons', 'L', 300],
  [748, S.slow, 'ROSCA SEM-FIM', 'worm', 'L', 300], [770, S.slow, 'COROA', 'gear', 'R', 390], [804, S.slow, 'BIELA', 'rod', 'R', 490],
  [930, S.back, 'BAIXA PRESSÃO', 'low', 'L', 260], [985, S.back, 'ALTA PRESSÃO', 'high', 'R', 500],
];

function hud(f: number) {
  const fac = factorAt(f), real = rpmRealAt(f);
  const label = fac < 1.5 ? 'VEL. REAL' : `${Math.round(fac)}X LENTO`;
  const w = tw(label, 2) + 14;
  line(9, 46, 8 + w / 2, 32, C.creamD); line(8 + w, 46, 8 + w / 2, 32, C.creamD); R(7 + w / 2, 30, 3, 3, C.creamD);
  R(6, 44, w + 4, 26, C.ink); R(8, 46, w, 22, C.blue); R(8, 46, w, 2, C.blueL);
  T(label, 15, 53, 2, C.white, {bold: true});
  const gx = 222, gy = 72, gr = 26;
  for (const [r, c] of [[gr + 2, C.ink], [gr, C.cream]] as [number, string][])
    for (let yy = gy - r; yy <= gy; yy++) { const h = Math.sqrt(Math.max(0, r * r - (gy - yy) * (gy - yy))); R(gx - h, yy, 2 * h, 1, c); }
  R(gx - gr - 4, gy, 2 * gr + 8, 5, C.ink); R(gx - gr - 3, gy + 1, 2 * gr + 6, 3, C.gold);
  for (let k = 0; k <= 8; k++) { const a = Math.PI - (k / 8) * Math.PI; line(gx + Math.cos(a) * (gr - 7), gy - Math.sin(a) * (gr - 7), gx + Math.cos(a) * (gr - 2), gy - Math.sin(a) * (gr - 2), C.ink); }
  R(gx + gr - 9, gy - 8, 4, 4, C.red);
  const frac = clamp(1 + Math.log(real / 1200 / fac) / Math.log(256));
  const a = Math.PI - frac * Math.PI;
  line(gx, gy, gx + Math.cos(a) * (gr - 5), gy - Math.sin(a) * (gr - 5), C.red, 2);
  R(gx - 2, gy - 3, 5, 5, C.ink);
  const val = Math.min(9999, Math.round(real / fac)), digits = String(val).padStart(4, '0'), lead = 4 - String(val).length;
  const ox = 262, oy = 46;
  R(ox - 2, oy - 2, 96, 28, C.ink); R(ox, oy, 92, 24, C.gold);
  T('RPM', ox + 4, oy + 6, 2, C.ink, {bold: true});
  for (let i = 0; i < 4; i++) { const cx = ox + 42 + i * 12; R(cx, oy + 3, 11, 18, C.navy); T(digits[i], cx + 2, oy + 6, 2, i < lead ? C.dim : C.cream); }
}
function banner(f: number, sec: Sec) {
  const t = f - sec.f;
  const y0 = 86 + Math.round(-90 * (1 - easeOut(t / 10))) + (t >= 10 && t < 16 ? Math.round(Math.sin(((t - 10) / 6) * Math.PI) * 3) : 0);
  const x0 = 30, w = 320, h = 58;
  R(x0 - 2, y0 - 2, w + 4, h + 4, C.ink); R(x0, y0, w, h, C.gold); R(x0 + 3, y0 + 3, w - 6, h - 6, C.cream);
  for (const sx of [x0 + 5, x0 + w - 15]) {
    R(sx - 1, y0 + 4, 12, h - 8, C.ink);
    for (let yy = y0 + 5; yy < y0 + h - 5; yy++) for (let xx = 0; xx < 10; xx++) {
      const band = (((Math.floor((xx + yy + f * 0.5) / 4) % 3) + 3) % 3);
      R(sx + xx, yy, 1, 1, band === 0 ? C.red : band === 1 ? C.white : C.blue);
    }
  }
  T(sec.t, x0 + w / 2, y0 + 12, 3, C.ink, {bold: true, align: 'center'});
  const n = clamp(Math.floor((t - 6) * 1.6), 0, sec.s.length);
  T(sec.s.slice(0, n), x0 + w / 2 - tw(sec.s, 2) / 2, y0 + 38, 2, C.red, {bold: true});
  if (sec.n > 0) {
    const cx = x0 + 2, cy = y0 + 4;
    for (const [r, c] of [[16, C.ink], [14, C.gold], [11, C.red]] as [number, string][])
      for (let yy = -r; yy <= r; yy++) { const hh = Math.sqrt(r * r - yy * yy); R(cx - hh, cy + yy, 2 * hh, 1, c); }
    T(String(sec.n), cx + 1, cy - 10, 3, C.cream, {bold: true, align: 'center', outline: C.ink});
  }
}
function fact(f: number, sec: Sec) {
  let cur: [number, string] | null = null;
  for (const q of sec.facts) if (f >= q[0]) cur = q;
  if (!cur) return;
  const t = f - cur[0], txt = cur[1], n = clamp(Math.floor(t * 1.5), 0, txt.length);
  const w = tw(txt, 2) + 16, x = Math.round(190 - w / 2), y = 152 + Math.round(-10 * (1 - easeOut(t / 6)));
  R(x + 14, 144, 2, y - 144, C.ink); R(x + w - 16, 144, 2, y - 144, C.ink);
  R(x - 2, y - 2, w + 4, 26, C.ink); R(x, y, w, 22, C.cream);
  T(txt.slice(0, n), x + 8, y + 5, 2, C.blue, {bold: true});
}
function label(f: number, l: Lab, sc: FanScene) {
  const [a, b, txt, name, side, y] = l;
  if (f < a || f >= b) return;
  const [px, py, ok] = sc.project(name);
  if (!ok) return;
  const n = clamp(Math.floor((f - a) * 1.5), 0, txt.length);
  if (n < 1) return;
  const w = tw(txt.slice(0, n), 2) + 14;
  const x = side === 'L' ? 8 : 352 - w, ax = side === 'L' ? x + w : x, ay = y + 11;
  line(ax, ay, px, py, C.ink, 3); line(ax, ay, px, py, C.cream, 1);
  R(px - 3, py - 3, 7, 7, C.ink); R(px - 1, py - 1, 3, 3, C.cream);
  R(x - 2, y - 2, w + 4, 26, C.ink); R(x, y, w, 22, C.cream); R(x, y, 4, 22, C.red);
  T(txt.slice(0, n), x + 8, y + 5, 2, C.ink, {bold: true});
}
function pop(f: number, at: number, word: string, x: number, y: number) {
  const t = f - at;
  if (t < 0 || t >= 14) return;
  const j = t < 6 ? Math.round(Math.sin(t * 2.3) * 2) : 0;
  T(word, x + j, y - Math.round(t * 0.6), 3, C.red, {bold: true, outline: C.cream, shadow: C.ink, align: 'center'});
}

export function drawUI(c: CanvasRenderingContext2D, f: number, sc: FanScene) {
  ctx = c;
  ctx.clearRect(0, 0, UW, UH);
  const g = ctx.createRadialGradient(180, 330, 160, 180, 330, 420);
  g.addColorStop(0, 'rgba(8,10,28,0)'); g.addColorStop(1, 'rgba(8,10,28,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, UW, UH);
  for (const l of LABS) label(f, l, sc);
  let sec = SECS[0];
  for (const s of SECS) if (f >= s.f) sec = s;
  hud(f);
  banner(f, sec);
  fact(f, sec);
  const [bx, by] = sc.project('buttons');
  BUTTONS.forEach((b) => pop(f, b, 'CLIQUE!', clamp(bx, 70, 290), Math.max(200, by - 70)));
  for (let b = S.field + 20; b < S.speeds; b += 40) pop(f, b, 'ZZT!', 280, 230);
  pop(f, S.back, 'VUUSH!', 180, 230);
  const fade = Math.max(0, 1 - f / 8, (f - (S.end - 20)) / 20);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, UW, UH); }
}
