import {drawText, textWidth, TextOpts} from '../../_shared/font';
import {S, CLACK, SINK, clamp, easeOut, sixteenth} from './timeline';
import type {PS5Scene} from './scene';

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
  {f: S.disc, n: 1, t: 'O DISCO', s: 'ENTRA E COMEÇA A GIRAR', facts: [[80, 'ROLETES PUXAM O DISCO'], [140, 'UM MOTOR FAZ ELE GIRAR'], [186, 'O RÓTULO FICA PRA BAIXO']]},
  {f: S.laser, n: 2, t: 'O LASER', s: 'LÊ OS DADOS DO DISCO', facts: [[236, 'LASER AZUL DE 405 NM'], [282, 'FUROS MENORES QUE 1 MÍCRON'], [330, 'FURO = 1 / LISO = 0']]},
  {f: S.install, n: 3, t: 'INSTALAÇÃO', s: 'COPIA TUDO PRO SSD', facts: [[396, '12 CHIPS: 825 GB'], [444, '5,5 GB POR SEGUNDO'], [492, '100X MAIS RÁPIDO QUE HD']]},
  {f: S.decomp, n: 4, t: 'DESCOMPRIME', s: 'CHIP SÓ PRA ISSO', facts: [[556, 'O JOGO VEM ESPREMIDO'], [606, 'PEQUENO VIRA GRANDE'], [656, 'SEM GASTAR A CPU']]},
  {f: S.ram, n: 5, t: 'MEMÓRIA RAM', s: '16 GB SUPER RÁPIDA', facts: [[716, '8 CHIPS DE 2 GB'], [766, '448 GB POR SEGUNDO'], [816, 'MAPA, CARROS E PESSOAS']]},
  {f: S.cpu, n: 6, t: 'CPU', s: 'O CÉREBRO DO JOGO', facts: [[876, '8 NÚCLEOS TRABALHANDO'], [922, '3,5 BILHÕES DE CICLOS/S'], [972, 'TRÂNSITO, FÍSICA, POLÍCIA']]},
  {f: S.gpu, n: 7, t: 'GPU', s: 'DESENHA A CIDADE', facts: [[1036, '36 UNIDADES DE CÁLCULO'], [1082, '10 TRILHÕES DE CONTAS/S'], [1130, '60 QUADROS POR SEGUNDO']]},
  {f: S.cool, n: 8, t: 'REFRIGERAÇÃO', s: 'SEGURA O CALOR', facts: [[1196, 'O CHIP ESQUENTA MUITO!'], [1236, 'METAL LÍQUIDO NO CHIP'], [1300, 'DISSIPADOR + VENTOINHA']]},
  {f: S.tv, n: 9, t: 'NA SUA TV', s: 'PELO CABO HDMI', facts: [[1356, 'ATÉ 4K NA SUA TV'], [1410, '1 QUADRO A CADA 16 MS'], [1460, 'E VOCÊ TÁ NA CIDADE!']]},
  {f: S.outro, n: 0, t: 'TUDO ISSO', s: 'EM MILISSEGUNDOS!', facts: [[1516, 'DISCO > SSD > RAM'], [1556, 'CPU + GPU > TV'], [1596, 'QUAL MÁQUINA NO PRÓXIMO?']]},
];
type Lab = [number, number, string, string, 'L' | 'R', number];
const LABS: Lab[] = [
  [84, 140, 'ROLETES', 'rollers', 'R', 300], [144, S.laser, 'MOTOR DO DISCO', 'spindle', 'L', 470], [196, S.laser, 'DISCO', 'disc', 'R', 300],
  [244, S.install, 'LENTE', 'laser', 'R', 300], [300, S.install, 'ROSCA DO TRILHO', 'worm', 'L', 470],
  [400, S.decomp, 'CHIPS FLASH', 'ssd', 'L', 300], [470, S.decomp, 'CONTROLADOR', 'ctrl', 'R', 470],
  [560, S.ram, 'DESCOMPRESSOR', 'decomp', 'L', 300],
  [720, S.cpu, 'CHIPS GDDR6', 'ram', 'L', 300], [770, S.cpu, 'PROCESSADOR', 'apu', 'R', 440],
  [880, S.gpu - 30, 'NÚCLEOS DA CPU', 'cpu', 'L', 300], [1040, S.cool, 'GPU', 'gpu', 'R', 440],
  [1240, SINK - 10, 'METAL LÍQUIDO', 'liquid', 'L', 470], [SINK + 4, S.tv, 'DISSIPADOR', 'sink', 'R', 300], [1318, S.tv, 'VENTOINHA', 'fan', 'L', 470],
  [1362, S.outro, 'HDMI', 'hdmi', 'R', 500],
];
const METRIC = (f: number): [string, string, number, number] => { // badge, unit, value, gauge 0..1
  if (f < S.disc) return ['1000X LENTO', 'MB/S', 100, 0.1];
  if (f < S.install) return ['100X LENTO', 'MB/S', 100, 0.1];
  if (f < S.decomp) return ['10X LENTO', 'MB/S', 5500, 0.55];
  if (f < S.ram) return ['10X LENTO', 'MB/S', 9000, 0.7];
  if (f < S.cpu) return ['100X LENTO', 'GB/S', 448, 0.8];
  if (f < S.gpu) return ['1000X LENTO', 'MHZ', 3500, 0.85];
  if (f < S.cool) return ['1000X LENTO', 'MHZ', 2230, 0.9];
  if (f < S.tv) return ['10X LENTO', 'WATTS', 200, 0.6];
  if (f < S.outro) return ['1000X LENTO', 'FPS', 60, 0.95];
  return ['VEL. REAL', 'FPS', 60, 0.95];
};

function hud(f: number) {
  const [label, unit, val, frac] = METRIC(f);
  const w = tw(label, 2) + 14;
  line(9, 46, 8 + w / 2, 32, C.creamD); line(8 + w, 46, 8 + w / 2, 32, C.creamD); R(7 + w / 2, 30, 3, 3, C.creamD);
  R(6, 44, w + 4, 26, C.ink); R(8, 46, w, 22, C.blue); R(8, 46, w, 2, C.blueL);
  T(label, 15, 53, 2, C.white, {bold: true});
  const uw = tw(unit, 2), ow = uw + 8 + 50, ox = 354 - ow, oy = 46;
  const gx = Math.round((8 + w + ox) / 2), gy = 72, gr = 24;
  for (const [r, c] of [[gr + 2, C.ink], [gr, C.cream]] as [number, string][])
    for (let yy = gy - r; yy <= gy; yy++) { const h = Math.sqrt(Math.max(0, r * r - (gy - yy) * (gy - yy))); R(gx - h, yy, 2 * h, 1, c); }
  R(gx - gr - 4, gy, 2 * gr + 8, 5, C.ink); R(gx - gr - 3, gy + 1, 2 * gr + 6, 3, C.gold);
  for (let k = 0; k <= 8; k++) { const a = Math.PI - (k / 8) * Math.PI; line(gx + Math.cos(a) * (gr - 7), gy - Math.sin(a) * (gr - 7), gx + Math.cos(a) * (gr - 2), gy - Math.sin(a) * (gr - 2), C.ink); }
  R(gx + gr - 9, gy - 8, 4, 4, C.red);
  const a = Math.PI - (frac + Math.sin(f * 0.7) * 0.015) * Math.PI;
  line(gx, gy, gx + Math.cos(a) * (gr - 5), gy - Math.sin(a) * (gr - 5), C.red, 2);
  R(gx - 2, gy - 3, 5, 5, C.ink);
  const digits = String(val).padStart(4, '0'), lead = 4 - String(val).length;
  R(ox - 2, oy - 2, ow + 4, 28, C.ink); R(ox, oy, ow, 24, C.gold);
  T(unit, ox + 4, oy + 6, 2, C.ink, {bold: true});
  for (let i = 0; i < 4; i++) { const cx = ox + uw + 8 + i * 12; R(cx, oy + 3, 11, 18, C.navy); T(digits[i], cx + 2, oy + 6, 2, i < lead ? C.dim : C.cream); }
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
function label(f: number, l: Lab, sc: PS5Scene) {
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

export function drawUI(c: CanvasRenderingContext2D, f: number, sc: PS5Scene) {
  ctx = c;
  ctx.clearRect(0, 0, UW, UH);
  const g = ctx.createRadialGradient(180, 330, 160, 180, 330, 420);
  g.addColorStop(0, 'rgba(8,10,28,0)'); g.addColorStop(1, 'rgba(8,10,28,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, UW, UH);
  for (const l of LABS) label(f, l, sc);
  hud(f);
  if (f < S.disc) { // 2-second hook
    const y1 = 100 + Math.round(-30 * (1 - easeOut(f / 6))), y2 = 142 + Math.round(30 * (1 - easeOut((f - 10) / 6)));
    T('O QUE O PS5 FAZ', 180, y1, 3, C.cream, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
    if (f >= 10) T('COM O GTA 6?', 180, y2, 4, C.gold, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
  } else {
    let sec = SECS[0];
    for (const s of SECS) if (f >= s.f) sec = s;
    banner(f, sec);
    fact(f, sec);
  }
  pop(f, CLACK, 'CLACK!', 180, 420);
  pop(f, SINK, 'CLUNK!', 180, 420);
  pop(f, S.tv, 'PLIM!', 180, 300);
  // laser reading: 1s and 0s fly out of the lens
  if (f >= S.laser + 40 && f < S.install) {
    const [lx, ly, ok] = sc.project('laser');
    const k = sixteenth(f, S.laser);
    if (ok) for (let j = 0; j < 6; j++) {
      const kk = k - j, age = f - (S.laser + kk * 5);
      if (kk < 8 || age < 0) continue;
      T((kk * 7 + (kk >> 1)) % 3 === 0 ? '0' : '1', lx + 10 + age * 2.2, ly - 18 - age * 1.4 + (kk % 3) * 8, 2, kk % 2 ? C.gold : C.cream, {bold: true, outline: C.ink});
    }
  }
  // re-hook before the best part
  if (f >= S.gpu - 26 && f < S.gpu + 4) {
    const t = f - (S.gpu - 26), j = t < 6 ? Math.round(Math.sin(t * 2.5) * 2) : 0;
    T('O MAIS INSANO', 180 + j, 380, 3, C.cream, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
    T('VEM AGORA...', 180 - j, 420, 3, C.gold, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
  }
  const fade = Math.max(0, (f - (S.end - 16)) / 16);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, UW, UH); }
}
