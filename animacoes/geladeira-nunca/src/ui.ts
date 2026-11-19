import {drawText, textWidth, TextOpts} from '../../_shared/font';
import {S, SLOW, LABS, CLICKS, DOOR_SHUT, CRACK, TOTAL, type Lab, clamp, easeOut, heatAt} from './timeline';
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

// captions = narration text (max 26 chars, one every ~70-80 frames)
type Sec = {f: number; n: number; t: string; s: string; facts: [number, string][]};
const SECS: Sec[] = [
  {f: S.intro, n: 0, t: 'COMO ELA GELA', s: 'ELA NÃO CRIA FRIO', facts: [[64, 'ELA TIRA O CALOR DE DENTRO'], [136, 'E SOLTA PELA SERPENTINA']]},
  {f: S.e1, n: 1, t: 'COMIDA QUENTE', s: 'PANELA FERVENDO DENTRO', facts: [[204, 'O VAPOR ESQUENTA O AR'], [290, 'O TERMOSTATO RELIGA'], [364, 'O MOTOR FICA MAIS LIGADO'], [438, 'AMORNE, MAS NO MÁX. 2 H'], [500, 'POTES RASOS ESFRIAM RÁPIDO']]},
  {f: S.e2, n: 2, t: 'PORTA ABERTA', s: 'O AR QUENTE ENTRA', facts: [[564, 'O AR QUENTE E ÚMIDO ENTRA'], [650, 'A UMIDADE VIRA GELO'], [724, 'GELO ATRAPALHA O FRIO'], [792, 'O MOTOR TRABALHA MAIS'], [862, 'FECHE: A BORRACHA VEDA']]},
  {f: S.e3, n: 3, t: 'LOTAR TUDO', s: 'O AR FRIO NÃO PASSA', facts: [[924, 'PRATELEIRA ENTUPIDA'], [1006, 'O VENTILADOR SOPRA O FRIO'], [1076, 'SEM ESPAÇO O AR NÃO CORRE'], [1140, 'UNS CANTOS FICAM MORNOS'], [1200, 'DEIXE O AR PASSAR']]},
  {f: S.e4, n: 4, t: 'SEM VÃO ATRÁS', s: 'COLADA NA PAREDE', facts: [[1264, 'A SERPENTINA SOLTA CALOR'], [1350, 'COLADA, O CALOR FICA PRESO'], [1424, 'O MOTOR SE ESFORÇA MAIS'], [1500, 'DEIXE UM VÃO ATRÁS'], [1552, 'O MANUAL DIZ QUANTO']]},
  {f: S.e5, n: 5, t: 'VIDRO CHEIO', s: 'NO CONGELADOR', facts: [[1604, 'GARRAFA CHEIA E FECHADA'], [1680, 'A ÁGUA CRESCE AO CONGELAR'], [1730, 'UNS 9% A MAIS DE VOLUME'], [1790, 'E O VIDRO PODE RACHAR'], [1904, 'NÃO ENCHA ATÉ A BOCA'], [1954, 'VIDRO QUENTE PODE RACHAR']]},
];

function hud(f: number) {
  const slow = f >= SLOW[0] + 4 && f < SLOW[3] - 4, label = slow ? 'CÂMERA LENTA' : 'VEL. REAL';
  const w = tw(label, 2) + 14;
  line(9, 46, 8 + w / 2, 32, C.creamD); line(8 + w, 46, 8 + w / 2, 32, C.creamD); R(7 + w / 2, 30, 3, 3, C.creamD);
  R(6, 44, w + 4, 26, C.ink); R(8, 46, w, 22, slow ? C.red : C.blue); R(8, 46, w, 2, C.blueL);
  T(label, 15, 53, 2, C.white, {bold: true});
  // right: error counter (hidden in the hook)
  const n = f < S.intro || f >= S.end ? -1 : f < S.e1 ? 0 : f < S.e2 ? 1 : f < S.e3 ? 2 : f < S.e4 ? 3 : f < S.e5 ? 4 : 5;
  const ow = 96, ox = 354 - ow, oy = 46;
  if (n >= 0) {
    R(ox - 2, oy - 2, ow + 4, 28, C.ink); R(ox, oy, ow, 24, C.gold);
    T('ERRO', ox + 4, oy + 6, 2, C.ink, {bold: true});
    R(ox + 54, oy + 3, 38, 18, C.navy); T(n + '/5', ox + 57, oy + 6, 2, C.cream, {bold: true});
  }
  // middle: heat gauge (qualitative, no numbers)
  const gx = Math.round((8 + w + ox) / 2), gy = 64, gr = 24, frac = clamp(heatAt(f));
  for (const [r, c] of [[gr + 2, C.ink], [gr, C.cream]] as [number, string][])
    for (let yy = gy - r; yy <= gy; yy++) { const h = Math.sqrt(Math.max(0, r * r - (gy - yy) * (gy - yy))); R(gx - h, yy, 2 * h, 1, c); }
  R(gx - gr - 4, gy, 2 * gr + 8, 5, C.ink); R(gx - gr - 3, gy + 1, 2 * gr + 6, 3, C.gold);
  for (let k = 0; k <= 8; k++) { const a = Math.PI - (k / 8) * Math.PI; line(gx + Math.cos(a) * (gr - 7), gy - Math.sin(a) * (gr - 7), gx + Math.cos(a) * (gr - 2), gy - Math.sin(a) * (gr - 2), k < 3 ? C.blue : k > 5 ? C.red : C.ink); }
  T('CALOR', gx, gy + 6, 2, C.cream, {bold: true, align: 'center', outline: C.ink});
  const a = Math.PI - (frac + Math.sin(f * 0.7) * 0.015) * Math.PI;
  line(gx, gy, gx + Math.cos(a) * (gr - 5), gy - Math.sin(a) * (gr - 5), C.red, 2);
  R(gx - 2, gy - 3, 5, 5, C.ink);
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
  const t = f - cur[0], txt = cur[1], n = clamp(Math.floor(t * 2.5) + 1, 0, txt.length);
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
  const n = clamp(Math.floor((f - a) * 3) + 1, 0, txt.length);
  if (n < 1) return;
  const w = tw(txt.slice(0, n), 2) + 14;
  const x = side === 'L' ? 8 : 352 - w, ax = side === 'L' ? x + w : x, ay = y + 11;
  line(ax, ay, px, py, C.ink, 3); line(ax, ay, px, py, C.cream, 1);
  R(px - 3, py - 3, 7, 7, C.ink); R(px - 1, py - 1, 3, 3, C.cream);
  R(x - 2, y - 2, w + 4, 26, C.ink); R(x, y, w, 22, C.cream); R(x, y, 4, 22, C.red);
  T(txt.slice(0, n), x + 8, y + 5, 2, C.ink, {bold: true});
}
function pop(f: number, at: number, word: string, len = 14) {
  const t = f - at;
  if (t < 0 || t >= len) return;
  const j = t < 6 ? Math.round(Math.sin(t * 2.3) * 2) : 0;
  T(word, 180 + j, 575 - Math.round((t / len) * 8), 3, C.red, {bold: true, outline: C.cream, shadow: C.ink, align: 'center'});
}
// static two-line title box (hook / end). Fully drawn from frame 0 so the loop point matches.
function title(l1: string, s1: number, c1: string, l2: string, s2: number) {
  R(0, 88, UW, 92, 'rgba(8,10,28,0.6)');
  T(l1, 180, 96, s1, c1, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
  T(l2, 180, 140, s2, C.gold, {bold: true, outline: C.ink, shadow: C.red, align: 'center'});
}

export function drawUI(c: CanvasRenderingContext2D, frame: number, sc: MicroScene) {
  ctx = c;
  // last 20 frames redraw the hook UI so the final frame matches frame 0 (loop)
  const f = frame >= TOTAL - 20 ? 0 : frame;
  ctx.clearRect(0, 0, UW, UH);
  const g = ctx.createRadialGradient(180, 330, 160, 180, 330, 420);
  g.addColorStop(0, 'rgba(8,10,28,0)'); g.addColorStop(1, 'rgba(8,10,28,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, UW, UH);
  for (const l of LABS) label(f, l, sc);
  hud(f);
  if (f < S.intro) title('NUNCA', 5, C.red, 'FAÇA ISSO', 3);
  else if (f >= S.end) title('QUAL VOCÊ', 4, C.cream, 'JÁ FEZ?', 4);
  else {
    let sec = SECS[0];
    for (const s of SECS) if (f >= s.f) sec = s;
    banner(f, sec);
    fact(f, sec);
  }
  CLICKS.forEach((p) => pop(f, p, 'CLIC!'));
  pop(f, DOOR_SHUT, 'TUM!');
  pop(f, CRACK, 'CREC!', 60);
  pop(f, S.e3 + 4, 'AGORA PIORA...', 50);
  pop(f, S.e5 + 4, 'O PIOR NO FIM', 46);
}
