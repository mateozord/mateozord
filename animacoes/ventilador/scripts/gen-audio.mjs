// Procedural lo-fi soundtrack + machine foley, frame-locked to the animation.
// Same timing constants as src/timeline.ts (30 fps, 90 BPM => 20 frames per beat).
import {writeFileSync, mkdirSync} from 'node:fs';

const SR = 44100, FPS = 30, BEAT = 20, BAR = 80, TOTAL = 1200;
const S = {title: 0, blades: 80, motor: 240, field: 400, speeds: 560, osc: 720, slow: 880, back: 1040, outro: 1120, end: 1200};
const REAL = 1200 / 60 / FPS;
const BUTTONS = [564, 604, 644];
const ringHits = [];
for (let f = S.slow + 10; f < S.back - 8; f += 10) ringHits.push(f);
const ez = (t) => { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const ex = (a, b, t) => a * Math.pow(b / a, ez(t));
function factorAt(f) {
  if (f < S.blades) return 1;
  if (f < S.motor) return f < 150 ? ex(1, 16, (f - 80) / 18) : ex(16, 64, (f - 150) / 16);
  if (f < S.field) return 64;
  if (f < S.speeds) return REAL * 40;
  if (f < S.slow) return 16;
  if (f < S.back) return ex(16, 256, (f - S.slow) / 16);
  if (f < S.outro) return ex(256, 1, (f - S.back) / 24);
  return 1;
}
function rpmRealAt(f) {
  if (f < S.speeds || f >= S.osc) return 1200;
  let r = 1200, prev = 1200, last;
  BUTTONS.forEach((b, i) => { if (f >= b) { prev = r; r = [800, 1000, 1200][i]; last = b; } });
  return last === undefined ? 1200 : prev + (r - prev) * ez((f - last) / 12);
}
const revAt = (f) => rpmRealAt(f) / 1800 / factorAt(f);

const N = Math.round((TOTAL / FPS) * SR);
const music = new Float32Array(N), drums = new Float32Array(N), mach = new Float32Array(N), plinks = new Float32Array(N);
const fs = (f) => Math.round((f / FPS) * SR); // frame -> sample
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const add = (buf, i, v) => { if (i >= 0 && i < N) buf[i] += v; };

// ---------- instruments ----------
function kick(buf, f, amp = 0.9, lo = 45, hi = 130, dec = 0.22) {
  const s0 = fs(f); let ph = 0;
  for (let i = 0; i < SR * 0.45; i++) {
    const t = i / SR, fr = lo + (hi - lo) * Math.exp(-t * 28);
    ph += (2 * Math.PI * fr) / SR;
    add(buf, s0 + i, Math.sin(ph) * Math.exp(-t / dec) * amp + (i < 60 ? noise() * 0.3 * amp * (1 - i / 60) : 0));
  }
}
function thud(f, amp = 1) { // clothes hitting water: low thump + splash
  kick(drums, f, amp * 0.95, 42, 110, 0.26);
  const s0 = fs(f); let lp = 0, lp2 = 0;
  for (let i = 0; i < SR * 0.35; i++) {
    const t = i / SR; lp += 0.25 * (noise() - lp); lp2 += 0.5 * (lp - lp2);
    add(mach, s0 + i, (lp - lp2 * 0.6) * Math.exp(-t / 0.09) * amp * 0.9);
  }
}
function snare(f, amp = 0.35) {
  const s0 = fs(f); let lp = 0, hp = 0, prev = 0;
  for (let i = 0; i < SR * 0.25; i++) {
    const t = i / SR, n = noise(); hp = 0.85 * (hp + n - prev); prev = n; lp += 0.35 * (hp - lp);
    add(drums, s0 + i, (lp * Math.exp(-t / 0.07) + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t / 0.04) * 0.5) * amp);
  }
}
function hat(f, amp = 0.09, swing = 0) {
  const s0 = fs(f) + Math.round(swing * SR); let hp = 0, prev = 0;
  for (let i = 0; i < SR * 0.06; i++) {
    const t = i / SR, n = noise(); hp = 0.6 * (hp + n - prev); prev = n;
    add(drums, s0 + i, hp * Math.exp(-t / 0.018) * amp);
  }
}
function rhodes(f, notes, amp = 0.055, len = 2.6) {
  const s0 = fs(f);
  for (const m of notes) {
    const fr = mtof(m) * (1 + (rnd() - 0.5) * 0.002);
    for (let i = 0; i < SR * len; i++) {
      const t = i / SR, env = Math.min(1, t / 0.006) * Math.exp(-t / 1.1) * (t > len - 0.2 ? (len - t) / 0.2 : 1);
      const mod = Math.sin(2 * Math.PI * fr * 2 * t) * 0.9 * Math.exp(-t / 0.25);
      const trem = 1 + 0.18 * Math.sin(2 * Math.PI * 4.2 * t);
      add(music, s0 + i, Math.sin(2 * Math.PI * fr * t + mod) * env * trem * amp);
    }
  }
}
function bass(f, m, dur, amp = 0.28) {
  const s0 = fs(f), fr = mtof(m);
  for (let i = 0; i < SR * dur; i++) {
    const t = i / SR, env = Math.min(1, t / 0.01) * Math.exp(-t / 0.5) * Math.min(1, (dur - t) / 0.05);
    add(music, s0 + i, Math.tanh(Math.sin(2 * Math.PI * fr * t) * 1.6) * env * amp);
  }
}
function plink(f, m, amp = 0.22) { // water-drop marimba note
  const s0 = fs(f), fr = mtof(m);
  for (let i = 0; i < SR * 0.9; i++) {
    const t = i / SR, gl = fr * (1 + 0.06 * Math.exp(-t * 60));
    const v = Math.sin(2 * Math.PI * gl * t) * Math.exp(-t / 0.28) + 0.35 * Math.sin(2 * Math.PI * gl * 2.76 * t) * Math.exp(-t / 0.06);
    add(plinks, s0 + i, v * amp * Math.min(1, t / 0.002));
  }
}
function sweep(buf, f0, f1, hz0, hz1, amp, noiseAmt = 0.3) {
  const a = fs(f0), b = fs(f1); let ph = 0, lp = 0;
  for (let i = a; i < b; i++) {
    const t = (i - a) / (b - a), fr = hz0 * Math.pow(hz1 / hz0, t);
    ph += (2 * Math.PI * fr) / SR; lp += 0.1 * (noise() - lp);
    const env = Math.sin(Math.PI * t);
    add(buf, i, (Math.sin(ph) * 0.6 + lp * noiseAmt * 3) * env * amp);
  }
}
function beep(f, m, dur = 0.22, amp = 0.12) {
  const s0 = fs(f), fr = mtof(m);
  for (let i = 0; i < SR * dur; i++) { const t = i / SR; add(mach, s0 + i, (Math.sin(2 * Math.PI * fr * t) > 0 ? 1 : -1) * amp * Math.min(1, t / 0.005, (dur - t) / 0.02)); }
}

// ---------- music: Fmaj9 - Em7 - Dm9 - Am9 (lo-fi ii-V-ish loop in A minor) ----------
const CHORDS = [[53, 64, 67, 69, 72], [52, 62, 67, 71], [50, 60, 64, 65, 69], [45, 55, 59, 60, 64]];
const ROOTS = [41, 40, 38, 33];
for (let bar = 0; bar < TOTAL / BAR; bar++) {
  const f = bar * BAR, ch = CHORDS[bar % 4], r = ROOTS[bar % 4];
  if (bar === S.outro / BAR) { rhodes(f, ch, 0.05, 2.6); rhodes(f + BEAT * 2.5, ch.slice(1), 0.03, 1.4); bass(f, r, 2.5, 0.22); continue; }
  rhodes(f, ch, 0.055);
  rhodes(f + BEAT * 2.5, ch.slice(1), 0.032, 1.3);
  if (bar >= 1) { bass(f, r, 1.2); bass(f + BEAT * 2, r, 0.5, 0.2); bass(f + BEAT * 2.5, r + 12, 0.3, 0.14); bass(f + BEAT * 3.5, r + 7, 0.25, 0.14); }
}
// ---------- drums ----------
const sixteenth = BEAT / 4, swing = 0.028;
for (let bar = 1; bar < S.outro / BAR; bar++) {
  const f0 = bar * BAR;
  if (f0 >= S.slow && f0 < S.back) continue;
  for (let st = 0; st < 16; st++) { const f = f0 + st * sixteenth; if (st % 2 === 0 || bar >= 2) hat(f, st % 4 === 2 ? 0.11 : 0.06, st % 2 ? swing : 0); }
  if (bar === 1) { kick(drums, f0, 0.5); kick(drums, f0 + BEAT * 2, 0.45); snare(f0 + BEAT * 3, 0.18); continue; }
  kick(drums, f0, 0.85); kick(drums, f0 + BEAT * 2, 0.8); kick(drums, f0 + BEAT * 2.5, 0.45);
  snare(f0 + BEAT, 0.32); snare(f0 + BEAT * 3, 0.32);
}
// ---------- fan foley ----------
// airflow: noise that pulses once per blade pass (3 blades), following the on-screen speed
{ let ph = 0, lp = 0, lp2 = 0;
  for (let i = 0; i < N; i++) {
    const f = (i / SR) * FPS, s = revAt(f), norm = Math.min(1, s / REAL);
    ph += (2 * Math.PI * 3 * s * FPS) / SR;
    const am = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.cos(ph), 3);
    const a = 0.03 + 0.3 * Math.sqrt(norm);
    lp += a * (noise() - lp); lp2 += 0.25 * a * (lp - lp2);
    const inside = f >= S.motor + 10 && f < S.osc ? 0.45 : 1;
    mach[i] += (lp - lp2 * 0.5) * am * (0.16 + 0.4 * Math.sqrt(norm)) * inside;
  } }
// motor hum (100 Hz + harmonics); louder when we are inside the motor, follows the speed buttons
{ let ph = 0;
  for (let i = 0; i < N; i++) {
    const f = (i / SR) * FPS, fr = 70 + 30 * (rpmRealAt(f) / 1200);
    ph += (2 * Math.PI * fr) / SR;
    const amp = f >= S.motor && f < S.osc ? 0.05 : 0.015;
    mach[i] += (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph)) * amp * Math.min(1, f / 10);
  } }
// rotating magnetic field: each coil firing (16th notes) plays an arpeggio note + electric tick
function zap(f, m, amp) {
  const s0 = fs(f), fr = mtof(m);
  for (let i = 0; i < SR * 0.25; i++) {
    const t = i / SR; let v = 0;
    for (let k = 1; k <= 5; k++) v += Math.sin(2 * Math.PI * fr * k * t) / k;
    add(mach, s0 + i, (v * 0.5 * Math.exp(-t / 0.07) + (i < 120 ? noise() * 0.4 * (1 - i / 120) : 0)) * amp);
  }
}
for (let f = S.field, k = 0; f < S.speeds; f += 5, k++) {
  const ch = CHORDS[Math.floor(f / BAR) % 4].slice(1), m = ch[k % ch.length] + 12 * (Math.floor(k / ch.length) % 2);
  zap(f, m + 12, k % 4 === 0 ? 0.075 : 0.05);
}
// speed buttons: click + whir up
for (const b of BUTTONS) { const s0 = fs(b); for (let i = 0; i < 1800; i++) add(mach, s0 + i, (noise() * 0.5 + Math.sin(2 * Math.PI * 1800 * i / SR) * 0.3) * Math.exp(-i / 160)); }
// oscillation gearbox: ticking on 8th notes (two pitches)
for (let f = S.osc + 20, k = 0; f < S.slow - 10; f += 10, k++) {
  const s0 = fs(f), fr = k % 2 ? 1250 : 940;
  for (let i = 0; i < SR * 0.05; i++) add(mach, s0 + i, (Math.sin(2 * Math.PI * fr * i / SR) * 0.25 + noise() * 0.12) * Math.exp(-i / 260));
}
// slow motion: whoosh down, deep rumble, slow heartbeat, pressure rings = melody
sweep(mach, S.slow - 4, S.slow + 14, 900, 50, 0.35, 0.5);
{ const a = fs(S.slow), b = fs(S.back); let lp = 0, ph = 0;
  for (let i = a; i < b; i++) {
    const t = (i - a) / SR; ph += 2 * Math.PI * 34 / SR; lp += 0.01 * (noise() - lp);
    mach[i] += (Math.sin(ph) * 0.08 + lp * 1.5 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 2.2))) * Math.min(1, t / 0.4, (b - i) / (SR * 0.2));
  } }
for (let f = S.slow; f < S.back; f += BEAT) kick(mach, f, 0.55, 32, 70, 0.4);
{ const mel = [76, 74, 72, 69, 72, 74, 76, 79, 81, 79, 76, 74, 72, 74, 69];
  ringHits.forEach((f, k) => plink(f, mel[k % mel.length], 0.2)); }
sweep(mach, S.back - 12, S.back + 1, 60, 900, 0.3, 0.4);
{ const s0 = fs(S.back); let lp = 0; for (let i = 0; i < SR * 0.8; i++) { lp += 0.2 * (noise() - lp); add(mach, s0 + i, lp * 0.5 * Math.exp(-i / (SR * 0.25))); } }

// ---------- vinyl crackle ----------
const crackle = new Float32Array(N);
{ let lp = 0; for (let i = 0; i < N; i++) { lp += 0.02 * (noise() - lp); crackle[i] = lp * 0.05 + (rnd() < 0.0006 ? noise() * 0.25 : 0); } }

// ---------- mix ----------
// music bus: lo-fi lowpass (dark), heavy filter + duck in slow motion
const musicBus = new Float32Array(N);
for (let i = 0; i < N; i++) musicBus[i] = music[i] + drums[i];
const slowAmt = (i) => { const f = (i / SR) * FPS; return clamp(Math.min((f - S.slow + 4) / 10, (S.back - f) / 8)); };
{ let y = 0; for (let i = 0; i < N; i++) { const s = slowAmt(i), fc = 5200 * (1 - s) + 320 * s, a = 1 - Math.exp(-2 * Math.PI * fc / SR); y += a * (musicBus[i] - y); musicBus[i] = y * (1 - 0.72 * s); } }
// simple echo on plinks
{ const d = Math.round(SR * (BEAT / FPS) * 0.75); for (let i = d; i < N; i++) plinks[i] += plinks[i - d] * 0.38; }
const out = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const f = (i / SR) * FPS;
  const master = Math.min(1, f / 6) * Math.min(1, (TOTAL - f) / 30);
  const v = (musicBus[i] * 0.95 + mach[i] * 1.0 + plinks[i] + crackle[i]) * master;
  out[i] = Math.tanh(v * 1.1) * 0.9;
  peak = Math.max(peak, Math.abs(out[i]));
}
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
// light stereo width: plinks/crackle slightly offset
for (let i = 0; i < N; i++) {
  const w = (plinks[i] * 0.15 + crackle[i] * 0.3);
  const l = Math.max(-1, Math.min(1, out[i] + w * 0.3)), r = Math.max(-1, Math.min(1, out[i] - w * 0.3));
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
}
mkdirSync(new URL('../public/', import.meta.url), {recursive: true});
writeFileSync(new URL('../public/soundtrack.wav', import.meta.url), buf);
console.log('soundtrack.wav', (N / SR).toFixed(2) + 's', 'peak', peak.toFixed(3));
