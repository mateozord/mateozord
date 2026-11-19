// Soundtrack: lo-fi music (Rhodes, bass, drums, vinyl) + machine foley. 90 BPM: beat=20f, eighth=10f,
// so every cut in timeline.shots (all multiples of 10) lands on an eighth-note grid line. Loops: music wraps at N.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const TL = JSON.parse(readFileSync(new URL('../src/timeline.json', import.meta.url), 'utf8'));
const SR = 44100, FPS = TL.fps, TOTAL = TL.total, S = TL.sections, SLOW = TL.slow;
const N = Math.round((TOTAL / FPS) * SR);
const mach = new Float32Array(N);
const fs = (f) => Math.round((f / FPS) * SR);
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, f) => { const t = clamp((f - a) / (b - a)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const add = (i, v) => { if (i >= 0 && i < N) mach[i] += v; };
const motor = (f) => Math.max(...TL.motor.map(([a, b]) => Math.min(smooth(a, a + 10, f), 1 - smooth(b, b + 10, f))));

function thud(f, amp = 1, lo = 45, hi = 120) {
  const s0 = fs(f); let ph = 0;
  for (let i = 0; i < SR * 0.4; i++) { const t = i / SR; ph += (2 * Math.PI * (lo + (hi - lo) * Math.exp(-t * 28))) / SR; add(s0 + i, Math.sin(ph) * Math.exp(-t / 0.2) * amp); }
}
const click = (f, a = 0.4) => { const s0 = fs(f); for (let i = 0; i < 1500; i++) add(s0 + i, (noise() * 0.6 + Math.sin(2 * Math.PI * 2400 * i / SR)) * a * Math.exp(-i / 120)); };
const hiss = (f0, f1, amp, k = 0.9) => { let hp = 0, prev = 0; for (let i = fs(f0); i < Math.min(N, fs(f1)); i++) { const n = noise(); hp = k * (hp + n - prev); prev = n; mach[i] += hp * amp * Math.min(1, (i - fs(f0)) / 4000, (fs(f1) - i) / 4000); } };
const tock = (f, a = 0.25) => { const s0 = fs(f); for (let i = 0; i < SR * 0.08; i++) { const t = i / SR; add(s0 + i, Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t / 0.02) * a); } };
const tink = (f, hz, a = 0.08) => { const s0 = fs(f); for (let i = 0; i < SR * 0.5; i++) { const t = i / SR; add(s0 + i, Math.sin(2 * Math.PI * hz * t) * Math.exp(-t / 0.12) * a); } };
const crunch = (f, dur, amp, lp = 0.3) => { let y = 0; for (let i = fs(f); i < Math.min(N, fs(f + dur)); i++) { y += lp * ((rnd() < 0.04 ? noise() * 4 : noise() * 0.3) - y); mach[i] += y * amp * (1 - (i - fs(f)) / fs(dur)); } };

// boiling pot (hook, error 1 until the pot leaves, end)
for (const [a, b, amp] of [[0, 200, 0.05], [200, 450, 0.03], [S.end, TOTAL, 0.05]]) {
  hiss(a, b, amp);
  for (let f = a; f < b; f += 3 + rnd() * 5) tock(f, 0.03 + rnd() * 0.03);
}
// compressor hum (50 Hz, follows the motor) + start thumps
{ let ph = 0; for (let i = 0; i < N; i++) { const f = (i / SR) * FPS; ph += 2 * Math.PI * 50 / SR; mach[i] += Math.tanh(Math.sin(ph) * 2.5) * 0.03 * motor(f) * (f >= S.e5 && f < S.end ? 0.2 : 1); } }
for (const c of TL.clicks) click(c, 0.4);
thud(290, 0.6); thud(600, 0.6);
// door: unseal sweep on open, rubber thud on close
hiss(566, 590, 0.06, 0.6); thud(TL.doorShut, 0.9, 40, 100);
// boxes landing on shelves (error 3)
for (let i = 0; i < 10; i++) tock(931 + i * 5, 0.25);
// wall arrives (error 4)
thud(1320, 0.7, 35, 80);
// ice ticks, then the crack (slow motion: low, stretched crunch) and shards
crunch(1690, 6, 0.4, 0.5); crunch(1745, 6, 0.4, 0.5);
crunch(TL.crack, 50, 0.9, 0.08); thud(TL.crack, 0.6, 30, 70);
for (let k = 0; k < 8; k++) tink(1850 + k * 6, 2200 + k * 310, 0.06);
// vinyl crackle bed
{ let lp = 0; for (let i = 0; i < N; i++) { lp += 0.02 * (noise() - lp); mach[i] += lp * 0.04 + (rnd() < 0.0005 ? noise() * 0.15 : 0); } }
// slow motion: muffle everything
{ let y = 0; for (let i = 0; i < N; i++) { const f = (i / SR) * FPS, s = Math.min(smooth(SLOW[0], SLOW[1], f), 1 - smooth(SLOW[2], SLOW[3], f)); const fc = 6000 * (1 - s) + 500 * s, a = 1 - Math.exp(-2 * Math.PI * fc / SR); y += a * (mach[i] - y); mach[i] = y; } }


// ---------- music (wraps around N so the end tails into the start) ----------
const harm = new Float32Array(N), drum = new Float32Array(N);
const wrap = (b, i, v) => { b[((i % N) + N) % N] += v; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const lvl = (f) => f < 60 ? 0 : f < S.e1 ? 1 : f < S.e3 ? 2 : f < S.e4 ? 3 : f < S.e5 ? 4 : f < 1772 ? 5 : f < 1898 ? 0 : 1;
function kick(f, amp = 0.8) { const s0 = fs(f); let ph = 0; for (let i = 0; i < SR * 0.35; i++) { const t = i / SR; ph += 2 * Math.PI * (42 + 90 * Math.exp(-t * 30)) / SR; wrap(drum, s0 + i, Math.sin(ph) * Math.exp(-t / 0.12) * amp); } }
function snare(f, amp = 0.3) { const s0 = fs(f); let y = 0; for (let i = 0; i < SR * 0.18; i++) { const t = i / SR; y += 0.6 * (noise() - y); wrap(drum, s0 + i, (y * 0.9 + Math.sin(2 * Math.PI * 190 * t) * 0.4) * Math.exp(-t / 0.05) * amp); } }
function hat(f, amp = 0.06) { const s0 = fs(f); let hp = 0, pv = 0; for (let i = 0; i < SR * 0.05; i++) { const n = noise(); hp = 0.85 * (hp + n - pv); pv = n; wrap(drum, s0 + i, hp * Math.exp(-i / (SR * 0.012)) * amp); } }
function rhodes(f, notes, amp = 0.05, len = 2.4) { const s0 = fs(f); notes.forEach((m, k) => { const w = hz(m) * 2 * Math.PI / SR, dt = 1 + (k - 1.5) * 0.0007; for (let i = 0; i < SR * len; i++) { const t = i / SR; const e = Math.min(1, t / 0.006) * Math.exp(-t / (len * 0.45)); wrap(harm, s0 + i, (Math.sin(w * dt * i) + 0.35 * Math.sin(w * dt * i * 2) * Math.exp(-t * 4) + 0.2 * Math.sin(w * i * 4.01) * Math.exp(-t * 14)) * e * amp / notes.length * 2.2); } }); }
function bass(f, m, durF, amp = 0.26) { const s0 = fs(f), n = fs(durF), w = hz(m) * 2 * Math.PI / SR; for (let i = 0; i < n + 800; i++) { const e = Math.min(1, i / 200) * Math.min(1, (n + 800 - i) / 800) * Math.exp(-i / SR * 1.2); wrap(harm, s0 + i, (Math.sin(w * i) + 0.25 * Math.sin(2 * w * i)) * e * amp); } }
function plink(f, m, amp = 0.05) { const s0 = fs(f), w = hz(m) * 2 * Math.PI / SR; for (let i = 0; i < SR * 0.35; i++) wrap(harm, s0 + i, Math.sin(w * i) * Math.exp(-i / (SR * 0.07)) * amp); }

// Am9 | Fmaj7 | Dm9 | E7 (tension). bass root + rhodes voicing
const PROG = [[45, [60, 64, 67, 71]], [41, [57, 60, 64, 69]], [38, [60, 64, 65, 69]], [40, [59, 62, 68, 64]]];
for (let b = 0; b < 26; b++) {
  const f0 = b * 80, L = lvl(f0);
  if (f0 >= S.end) break;
  if (f0 >= 1772 && f0 < 1898) continue; // slow-mo: pad only
  const [r, ch] = PROG[b % 4];
  // e4 (1260-1600): pedal A + b9 clash, rising tension
  const tense = f0 >= S.e4 && f0 < 1772;
  const root = tense ? 33 : r, voic = tense ? [...ch.slice(0, 3), 70] : ch;
  const amp = f0 < 60 ? 0.07 : 0.055;
  rhodes(f0, voic, amp); rhodes(f0 + 50, voic.slice(1), amp * 0.55, 1.3);
  if (L >= 3) rhodes(f0 + 30, voic.slice(2), amp * 0.4, 0.9);
  bass(f0, root, 45); bass(f0 + 50, root, 25, 0.2); if (L >= 3) bass(f0 + 60, root + 12, 15, 0.14);
  if (L < 1 && f0 >= 60) continue;
}
// drums (grid 10f). impact kick at frame 0, groove from the reveal at 60
kick(0, 1.0); wrap(drum, 0, 0);
for (let f = 60; f < S.end; f += 10) {
  const L = lvl(f); if (L === 0) continue;
  const k = f % 80, quiet = f >= 1898 ? 0.5 : 1;
  const kicks = L >= 3 ? [0, 30, 50] : [0, 50];
  if (kicks.includes(k)) kick(f, (L >= 3 ? 0.8 : 0.65) * quiet);
  if (L >= 2 && (k === 20 || k === 60) && f < 1700) snare(f, (0.2 + 0.05 * L) * quiet);
  hat(f, (k % 20 === 0 ? 0.07 : 0.04) * quiet * (L >= 3 ? 1.3 : 1));
}
// riser + snare roll into the slow motion (1700-1772): 10f -> 5f
for (let f = 1700; f < 1772; f += f < 1740 ? 10 : 5) snare(f, 0.1 + 0.3 * (f - 1700) / 72);
{ let y = 0; for (let i = fs(1500); i < fs(1772); i++) { const t = (i - fs(1500)) / fs(272); y += (0.02 + 0.5 * t * t) * (noise() - y); harm[i] += y * 0.18 * t * t; } }
// error 3 hit ("AGORA PIORA") and final error hit
kick(920, 1.0); snare(920, 0.4); kick(1600, 1.0); snare(1600, 0.4); kick(1772, 0.9);
// cut accents: soft plink on every cut (same pentatonic as the chord), bigger on section starts
const PENT = [69, 72, 74, 76, 79, 81];
TL.shots.forEach(([f], idx) => { if (f === 0 || (f >= 1772 && f < 1898)) return; plink(f, PENT[idx % 6] + (f >= S.e4 ? -12 : 0), Object.values(S).includes(f) ? 0.09 : 0.045); });
// slow motion (1772-1898): tape-stop pad, breathes out at the CREC, shards ring over it
{ let ph = [0, 0, 0]; const base = [hz(45), hz(57), hz(64)];
  for (let i = fs(1772); i < fs(1898); i++) { const f = (i / SR) * FPS, u = (f - 1772) / 126, sp = 1 - 0.35 * u;
    const g = Math.min(smooth(1772, 1790, f), 1 - smooth(1880, 1898, f)) * (1 - 0.9 * Math.min(smooth(1797, 1801, f), 1 - smooth(1812, 1850, f)));
    let v = 0; for (let k = 0; k < 3; k++) { ph[k] += 2 * Math.PI * base[k] * sp / SR; v += Math.sin(ph[k]) * (k ? 0.05 : 0.14); } harm[i] += v * g; } }
// music lowpass: muffled hook (until the reveal) and muffled final (loops into the hook), dark in slow motion
{ let y = 0; const fcAt = (f) => { let fc = 7000;
    if (f < 66) fc = 450 + 6550 * smooth(52, 66, f); else if (f >= 2000) fc = 7000 - 5800 * smooth(2000, 2020, f);
    const s = Math.min(smooth(SLOW[0], SLOW[1], f), 1 - smooth(SLOW[2], SLOW[3], f)); return fc * (1 - s) + 600 * s; };
  for (let k = 0; k < 2; k++) for (let i = 0; i < N; i++) { const a = 1 - Math.exp(-2 * Math.PI * fcAt((i / SR) * FPS) / SR); y += a * (harm[i] - y); if (k) harm[i] = y; } }
// final bar: Am9 held muffled so it continues into frame 0 (wrap)
rhodes(2000, PROG[0][1], 0.06, 3.2); bass(2000, 45, 100);

const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
let peak = 0, sq = 0;
const GAIN = 0.85;
for (let i = 0; i < N; i++) {
  const v = Math.tanh((mach[i] + harm[i] + drum[i]) * 1.1) * GAIN; peak = Math.max(peak, Math.abs(v)); sq += v * v;
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(v * 32767), 46 + i * 4);
}
mkdirSync(new URL('../public/', import.meta.url), {recursive: true});
writeFileSync(new URL('../public/soundtrack.wav', import.meta.url), buf);
console.log('soundtrack.wav', (N / SR).toFixed(2) + 's', 'peak dBFS', (20 * Math.log10(peak)).toFixed(2), 'rms dBFS', (10 * Math.log10(sq / N)).toFixed(2));
