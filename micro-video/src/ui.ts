import {drawText, textWidth, TextOpts} from './font';
import {S, POPS, FORK, DING, cutsAt, clamp, easeOut} from './timeline';
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
  {f: S.door, n: 1, t: 'A PORTA', s: 'TEM UMA TELA DE METAL', facts: [[80, 'FURINHOS NA JANELA'], [124, 'SEGURAM AS MICRO-ONDAS'], [168, 'MAS DEIXAM A LUZ PASSAR']]},
  {f: S.transf, n: 2, t: 'TRANSFORMADOR', s: 'MUITA TENSÃO!', facts: [[236, '220 V VIRAM 4.000 V'], [286, 'CAPACITOR + DIODO AJUDAM'], [336, 'NUNCA ABRA UM MICRO-ONDAS!']]},
  {f: S.mag, n: 3, t: 'MAGNETRON', s: 'O CORAÇÃO DO APARELHO', facts: [[396, 'ÍMÃS FAZEM ELÉTRONS GIRAR'], [446, 'O GIRO CRIA AS ONDAS'], [496, '2,45 BILHÕES DE VEZES/S']]},
  {f: S.wave, n: 4, t: 'GUIA DE ONDA', s: 'UM TUBO DE METAL', facts: [[556, 'LEVA AS ONDAS PRA CAIXA'], [606, 'ELAS BATEM NAS PAREDES'], [656, 'E VOLTAM, SEM PARAR']]},
  {f: S.plate, n: 5, t: 'O PRATO GIRA', s: 'POR UM MOTIVO...', facts: [[716, 'ONDAS FAZEM PONTOS QUENTES'], [766, 'GIRANDO, A COMIDA PASSA'], [806, 'POR TODOS ELES!']]},
  {f: S.mol, n: 6, t: 'O SEGREDO', s: 'MOLÉCULAS DE ÁGUA', facts: [[876, 'A ÁGUA É UM ÍMÃZINHO'], [920, 'VIRA PRA LÁ E PRA CÁ'], [968, '2,45 BILHÕES DE VEZES/S'], [1012, 'ESSE ATRITO VIRA CALOR'], [1050, 'O VAPOR ESTOURA A PIPOCA!']]},
  {f: S.metal, n: 7, t: 'E O GARFO?', s: 'METAL NO MICRO-ONDAS', facts: [[1144, 'METAL REFLETE AS ONDAS'], [1190, 'AS PONTAS SOLTAM FAÍSCAS!'], [1230, 'NÃO FAÇA ISSO EM CASA']]},
  {f: S.pop, n: 8, t: 'PRONTO!', s: 'PIM PIM PIM', facts: [[1276, 'CADA ESTALO = 1 PIPOCA'], [1330, 'O PRATO NÃO ESQUENTA:'], [1366, 'ELE NÃO TEM ÁGUA!']]},
  {f: S.outro, n: 0, t: 'MITO?', s: 'DE DENTRO PRA FORA', facts: [[1440, 'AS ONDAS ENTRAM SÓ 1-2 CM'], [1490, 'O MEIO ESQUENTA DEPOIS'], [1536, 'QUAL MÁQUINA NO PRÓXIMO?']]},
];
type Lab = [number, number, string, string, 'L' | 'R', number];
const LABS: Lab[] = [
  [100, 190, 'TELA DE METAL', 'door', 'L', 300], [150, 200, 'PAINEL', 'keypad', 'R', 470],
  [240, S.mag, 'TRANSFORMADOR', 'transf', 'L', 300], [290, S.mag, 'CAPACITOR', 'cap', 'R', 470], [320, S.mag, 'DIODO', 'diode', 'L', 470],
  [400, S.wave, 'ÍMÃS', 'magnets', 'R', 300], [430, S.wave, 'CÁTODO', 'cathode', 'L', 430], [470, S.wave, 'ANTENA', 'antenna', 'R', 520],
  [560, S.plate, 'GUIA DE ONDA', 'guide', 'L', 300], [600, S.plate, 'MICA', 'mica', 'R', 470],
  [720, S.mol, 'PIPOCA', 'bag', 'R', 470],
  [880, S.metal, 'MOLÉCULAS', 'water', 'L', 300], [1044, S.metal, 'CASCA', 'shell', 'R', 470],
  [FORK + 6, S.pop, 'GARFO', 'fork', 'L', 300],
  [1340, S.outro, 'TIMER', 'display', 'L', 300],
  [1450, S.end, '1-2 CM', 'edge', 'L', 300], [1494, S.end, 'MEIO FRIO', 'center', 'R', 470],
];
const METRIC = (f: number): [string, string, number, number] => {
  if (f < S.door) return ['SUPER LENTO', 'GRAUS', Math.round(25 + f * 4), 0.9];
  if (f < S.transf) return ['VEL. REAL', 'WATTS', 1000, 0.5];
  if (f < S.mag) return ['VEL. REAL', 'VOLTS', 4000, 0.9];
  if (f < S.plate) return ['SUPER LENTO', 'MHZ', 2450, 0.8];
  if (f < S.mol) return ['VEL. REAL', 'RPM', 6, 0.2];
  if (f < S.metal) return ['SUPER LENTO', 'GRAUS', Math.round(25 + 155 * clamp((f - S.mol) / 220)), 0.2 + 0.7 * clamp((f - S.mol) / 220)];
  if (f < S.pop) return ['VEL. REAL', 'WATTS', 1000, 0.5];
  if (f < S.outro) return ['VEL. REAL', 'SEG', Math.max(0, 90 - Math.floor((f - 180) / 13)), 0.3];
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
function label(f: number, l: Lab, sc: MicroScene) {
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
    T('COMO ELE ESQUENTA', 180, y1, 3, C.cream, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
    if (f >= 10) T('SEM FOGO?', 180, y2, 4, C.gold, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
  } else {
    let sec = SECS[0];
    for (const s of SECS) if (f >= s.f) sec = s;
    banner(f, sec);
    fact(f, sec);
  }
  POPS.forEach((p) => pop(f, p, 'POC!', 180, 470));
  pop(f, 170, 'BIP!', 260, 380);
  for (let b = FORK + 20; b < S.pop - 10; b += 20) pop(f, b, 'ZZT!', 120 + ((b / 20) % 3) * 60, 230);
  DING.forEach((d) => pop(f, d, 'PIM!', 180, 260 + (d - DING[0]) * 2));
  if (f >= S.mol - 28 && f < S.mol + 2) {
    const t = f - (S.mol - 28), j = t < 6 ? Math.round(Math.sin(t * 2.5) * 2) : 0;
    T('AGORA O', 180 + j, 360, 3, C.cream, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
    T('SEGREDO...', 180 - j, 400, 4, C.gold, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
  }
  for (const c of cutsAt) if (f >= c && f < c + 5) { ctx.fillStyle = `rgba(255,246,226,${0.8 * (1 - (f - c) / 5)})`; ctx.fillRect(0, 0, UW, UH); }
  const fade = Math.max(0, (f - (S.end - 16)) / 16);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, UW, UH); }
}
