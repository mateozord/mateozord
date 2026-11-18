import {drawText, textWidth, TextOpts} from './font';
import {S, KPOP, BAGPOPS, DING, cutsAt, clamp, easeOut} from './timeline';
import type {MicroScene} from './scene';

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
  {f: S.door, n: 1, t: 'A PORTA', s: 'TELA QUE SEGURA ONDAS', facts: [[76, 'A JANELA TEM TELA DE METAL'], [156, 'FUROS SEGURAM AS ONDAS'], [236, 'MAS A LUZ PASSA POR ELES']]},
  {f: S.transf, n: 2, t: 'TRANSFORMADOR', s: 'MUITA TENSÃO!', facts: [[316, '220 V VIRAM 4.000 V'], [396, 'CAPACITOR GUARDA ENERGIA'], [476, 'NUNCA ABRA UM MICRO-ONDAS!']]},
  {f: S.mag, n: 3, t: 'MAGNETRON', s: 'O CORAÇÃO DO APARELHO', facts: [[556, 'ÍMÃS FAZEM ELÉTRONS GIRAR'], [636, 'O GIRO CRIA AS ONDAS'], [716, '2,45 BILHÕES DE VEZES/S']]},
  {f: S.wave, n: 4, t: 'AS ONDAS', s: 'BATENDO NA CAIXA', facts: [[796, 'UM TUBO LEVA AS ONDAS'], [876, 'ELAS BATEM NAS PAREDES'], [956, 'E FORMAM ONDAS PARADAS']]},
  {f: S.plate, n: 5, t: 'O PRATO GIRA', s: 'POR UM MOTIVO...', facts: [[1036, 'ISSO CRIA PONTOS QUENTES'], [1116, 'E PONTOS FRIOS!'], [1196, 'GIRANDO, TUDO ESQUENTA']]},
  {f: S.bag, n: 6, t: 'O SACO', s: 'NÃO É SÓ PAPEL', facts: [[1276, 'TEM UM SUSCEPTOR'], [1356, 'METAL FININHO QUE ESQUENTA'], [1436, 'E FRITA O MILHO NO ÓLEO']]},
  {f: S.kernel, n: 7, t: 'O MILHO', s: 'UMA PANELA DE PRESSÃO', facts: [[1516, 'O MILHO TEM 14% DE ÁGUA'], [1596, 'A ONDA SACODE A ÁGUA'], [1676, 'A ÁGUA VIRA VAPOR'], [1756, 'PRESSÃO: 9X A DO AR!']]},
  {f: S.popping, n: 8, t: 'POC POC POC', s: 'DENTRO DO SACO', facts: [[1836, 'O AMIDO VIRA ESPUMA'], [1916, 'E A PIPOCA VIRA DO AVESSO']]},
  {f: S.ding, n: 0, t: 'PRONTO!', s: 'PIM PIM PIM', facts: [[2006, 'POUCOS ESTALOS? PODE TIRAR!']]},
  {f: S.outro, n: 0, t: 'MITO?', s: 'DE DENTRO PRA FORA', facts: [[2076, 'AS ONDAS SÓ ENTRAM 1-2 CM'], [2156, 'O MEIO ESQUENTA DEPOIS'], [2236, 'QUAL MÁQUINA NO PRÓXIMO?']]},
];
type Lab = [number, number, string, string, 'L' | 'R', number];
// max 2 at a time, fixed slots: L/R at y 330 or 470 (never under the banner)
const LABS: Lab[] = [
  [110, 280, 'TELA DE METAL', 'door', 'L', 470], [190, 280, 'DISPLAY', 'display', 'R', 330],
  [330, 440, 'TRANSFORMADOR', 'transf', 'L', 330], [400, 530, 'CAPACITOR', 'cap', 'R', 470], [450, 530, 'DIODO', 'diode', 'L', 330],
  [580, 700, 'ÍMÃS', 'magnets', 'R', 330], [620, 770, 'CÁTODO', 'cathode', 'L', 470], [710, 770, 'ANTENA', 'antenna', 'R', 330],
  [810, 930, 'GUIA DE ONDA', 'guide', 'L', 330], [880, 1010, 'MICA', 'mica', 'R', 470], [940, 1010, 'ONDA PARADA', 'ribbon', 'L', 330],
  [1060, 1250, 'PONTO QUENTE', 'hotspot', 'L', 470], [1130, 1250, 'PRATO', 'plate', 'R', 330],
  [1290, 1420, 'SUSCEPTOR', 'susceptor', 'R', 470], [1350, 1490, 'ÓLEO + SAL', 'oil', 'L', 330], [1430, 1490, 'MILHO', 'kern', 'R', 470],
  [1530, 1670, 'CASCA', 'shell', 'R', 330], [1600, 1790, 'ÁGUA', 'water', 'L', 470], [1690, 1790, 'VAPOR', 'steam', 'R', 330],
  [1880, 1990, 'PIPOCA', 'popped', 'R', 330],
  [2090, 2290, '1-2 CM', 'edge', 'L', 470], [2170, 2290, 'MEIO FRIO', 'center', 'R', 330],
];
const METRIC = (f: number): [string, string, number, number] => {
  if (f < S.door) return ['SUPER LENTO', 'GRAUS', Math.round(25 + f * 4), 0.9];
  if (f < S.transf) return ['VEL. REAL', 'WATTS', 1000, 0.5];
  if (f < S.mag) return ['VEL. REAL', 'VOLTS', 4000, 0.9];
  if (f < S.plate) return ['SUPER LENTO', 'MHZ', 2450, 0.8];
  if (f < S.bag) return ['VEL. REAL', 'RPM', 6, 0.2];
  if (f < S.kernel) return ['VEL. REAL', 'GRAUS', Math.round(25 + 175 * clamp((f - S.bag - 100) / 140)), 0.3 + 0.5 * clamp((f - S.bag - 100) / 140)];
  if (f < S.popping) { const p = clamp((f - S.kernel) / 300); return ['SUPER LENTO', 'ATM', Math.max(1, Math.round(1 + 8 * p * p)), 0.1 + 0.85 * p]; }
  if (f < S.ding + 26) return ['10X LENTO', 'SEG', Math.max(0, 180 - Math.floor((f - 180) / 10)), 0.3];
  if (f < S.outro) return ['VEL. REAL', 'SEG', 0, 0.05];
  return ['SUPER LENTO', 'CM', 2, 0.15];
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
  const n = clamp(Math.floor((t - 6) * 1.1), 0, sec.s.length);
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
  const t = f - cur[0], txt = cur[1], n = clamp(Math.floor(t * 0.9), 0, txt.length);
  const w = tw(txt, 2) + 16, x = Math.round(190 - w / 2), y = 152 + Math.round(-10 * (1 - easeOut(t / 6)));
  R(x + 14, 144, 2, y - 144, C.ink); R(x + w - 16, 144, 2, y - 144, C.ink);
  R(x - 2, y - 2, w + 4, 26, C.ink); R(x, y, w, 22, C.cream);
  T(txt.slice(0, n), x + 8, y + 5, 2, C.blue, {bold: true});
}
function label(f: number, l: Lab, sc: MicroScene) {
  const [a, b, txt, name, side, y] = l;
  if (f < a || f >= b) return;
  const [px, py, ok] = sc.project(name);
  if (!ok) return;
  const n = clamp(Math.floor((f - a) * 1.0), 0, txt.length);
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

export function drawUI(c: CanvasRenderingContext2D, f: number, sc: MicroScene) {
  ctx = c;
  ctx.clearRect(0, 0, UW, UH);
  const g = ctx.createRadialGradient(180, 330, 160, 180, 330, 420);
  g.addColorStop(0, 'rgba(8,10,28,0)'); g.addColorStop(1, 'rgba(8,10,28,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, UW, UH);
  for (const l of LABS) label(f, l, sc);
  hud(f);
  if (f < S.door) { // 2-second hook
    const y1 = 100 + Math.round(-30 * (1 - easeOut(f / 6))), y2 = 142 + Math.round(30 * (1 - easeOut((f - 10) / 6)));
    R(0, 88, UW, 86, 'rgba(8,10,28,0.55)');
    T('COMO ELE ESQUENTA', 180, y1, 3, C.cream, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
    if (f >= 10) T('SEM FOGO?', 180, y2, 4, C.gold, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
  } else {
    let sec = SECS[0];
    for (const s of SECS) if (f >= s.f) sec = s;
    banner(f, sec);
    fact(f, sec);
  }
  KPOP.forEach((p) => pop(f, p, 'POC!', 180, 575));
  pop(f, 170, 'BIP!', 180, 575);
  BAGPOPS.forEach((p, i) => { if (i % 2 === 0) pop(f, p, 'POC!', 110 + ((i * 37) % 140), 575); });
  DING.forEach((d) => pop(f, d, 'PIM!', 180, 575));
  if (f >= S.kernel - 28 && f < S.kernel + 2) {
    const t = f - (S.kernel - 28), j = t < 6 ? Math.round(Math.sin(t * 2.5) * 2) : 0;
    R(0, 505, UW, 80, 'rgba(8,10,28,0.55)');
    T('AGORA O MAIS', 180 + j, 515, 3, C.cream, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
    T('INCRÍVEL...', 180 - j, 548, 3, C.gold, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
  }
  for (const c of cutsAt) if (f >= c && f < c + 5) { ctx.fillStyle = `rgba(255,246,226,${0.8 * (1 - (f - c) / 5)})`; ctx.fillRect(0, 0, UW, UH); }
  const fade = Math.max(0, (f - (S.end - 16)) / 16);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, UW, UH); }
}
