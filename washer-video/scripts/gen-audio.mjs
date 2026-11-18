// Procedural lo-fi soundtrack + machine foley, frame-locked to the animation.
// Same timing constants as src/timeline.ts (30 fps, 90 BPM => 20 frames per beat).
import {writeFileSync, mkdirSync} from 'node:fs';

const SR = 44100, FPS = 30, BEAT = 20, BAR = 80, TOTAL = 1200;
const S = {title: 0, fill: 80, wash: 240, motor: 480, side: 560, drain: 640, spin: 720, slow: 880, done: 1040, door: 1080, outro: 1120, end: 1200};
const WASH_SLOW = [320, 400];
const washKicks = [280, 320, 400, 440, 480];
const inWS = (f) => f >= WASH_SLOW[0] && f < WASH_SLOW[1];
const dropHits = [];
for (let f = S.slow + 18; f < S.done - 6; f += 10) dropHits.push(f);

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
for (let bar = 1; bar < S.done / BAR; bar++) {
  const f0 = bar * BAR, slow = (f0 >= S.slow && f0 < S.done) || inWS(f0);
  if (slow) continue;
  const wash = f0 >= S.wash && f0 < S.motor;
  for (let st = 0; st < 16; st++) {
    const f = f0 + st * sixteenth, sw = st % 2 ? swing : 0;
    if (st % 2 === 0 || bar >= 2) hat(f, st % 4 === 2 ? 0.11 : 0.06, sw);
  }
  if (bar === 1) { kick(drums, f0, 0.5); kick(drums, f0 + BEAT * 2, 0.45); snare(f0 + BEAT * 3, 0.18); continue; }
  if (!wash) { kick(drums, f0, 0.85); kick(drums, f0 + BEAT * 2, 0.8); kick(drums, f0 + BEAT * 2.5, 0.45); }
  if (wash && f0 === S.wash) kick(drums, f0, 0.7); // first downbeat: clothes start lifting
  snare(f0 + BEAT, 0.32); snare(f0 + BEAT * 3, 0.32);
}
// in the wash scene the kick drum IS the clothes landing in the water
for (const k of washKicks) thud(k, k === WASH_SLOW[1] ? 1.4 : k === S.motor ? 0.8 : 1);
// bar 10 (spin-down): drums then drop out on beat 3
{ const f0 = S.done; kick(drums, f0, 0.8); snare(f0 + BEAT, 0.3); }

// ---------- machine foley ----------
// title: door lock click
for (const f of [64, 70]) { const s0 = fs(f); for (let i = 0; i < 900; i++) add(mach, s0 + i, noise() * Math.exp(-i / 120) * 0.35); }
// fill: valve clunk + water hiss with gurgles
{ const s0 = fs(S.fill + 16); for (let i = 0; i < 2500; i++) add(mach, s0 + i, Math.sin(2 * Math.PI * 70 * i / SR) * Math.exp(-i / 500) * 0.5 + noise() * Math.exp(-i / 200) * 0.2); }
{ const a = fs(S.fill + 18), b = fs(S.fill + 150); let lp = 0, lp2 = 0;
  for (let i = a; i < b; i++) {
    const t = (i - a) / SR, env = Math.min(1, t / 0.15) * Math.min(1, (b - i) / (SR * 0.15));
    lp += 0.18 * (noise() - lp); lp2 += 0.05 * (lp - lp2);
    const gurg = 0.6 + 0.4 * Math.sin(2 * Math.PI * (5 + 3 * Math.sin(t * 2.1)) * t);
    mach[i] += (lp - lp2) * 0.55 * env * gurg;
  } }
// motor hum (wash, drain, spin), following the drum speed
function hum(f0, f1, fn, amp) {
  const a = fs(f0), b = fs(f1); let ph = 0;
  for (let i = a; i < b; i++) {
    const fr = fn((i / SR) * FPS); ph += (2 * Math.PI * fr) / SR;
    const env = Math.min(1, (i - a) / (SR * 0.1), (b - i) / (SR * 0.1));
    mach[i] += (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph) + 0.12 * Math.sin(5 * ph)) * amp * env;
  }
}
const washSpeed = (f) => Math.max(0, Math.min(1, (f - S.wash) / 8, Math.abs(f - WASH_SLOW[1]) / 8, (S.motor - f) / 8)) * (inWS(f) ? 0.5 : 1);
hum(S.wash, S.motor, (f) => 38 + 30 * washSpeed(f), 0.05);
hum(S.motor, S.drain, () => 62, 0.06);
hum(S.motor, S.drain, () => 640, 0.008); // belt whine
// water slosh between beats in the wash
for (let f = S.wash + 10; f < S.motor; f += 20) { if (inWS(f)) continue; const s0 = fs(f); let lp = 0; for (let i = 0; i < SR * 0.25; i++) { lp += 0.08 * (noise() - lp); add(mach, s0 + i, lp * Math.sin(Math.PI * i / (SR * 0.25)) * 0.5); } }
// drain pump buzz + bubbles that land on 16ths (pentatonic)
{ const a = fs(S.drain + 4), b = fs(S.drain + 74); let ph = 0;
  for (let i = a; i < b; i++) { ph += 2 * Math.PI * 100 / SR; const env = Math.min(1, (i - a) / 3000, (b - i) / 3000); mach[i] += Math.tanh(Math.sin(ph) * 3) * 0.035 * env; } }
{ const pent = [69, 72, 74, 76, 79, 81]; let k = 0;
  for (let f = S.drain + 10; f < S.drain + 72; f += 5) { if ((k * 7) % 3 !== 1) plink(f, pent[(k * 5) % pent.length] + 12, 0.07); k++; } }
// spin: rising whine + air, real speed
const spinNorm = (f) => {
  if (f < S.spin) return 0;
  if (f < S.slow) { const t = clamp((f - S.spin) / 130); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  if (f >= S.done && f < S.door) return Math.pow(clamp(1 - (f - S.done) / 38), 2);
  return 0;
};
for (const [f0, f1] of [[S.spin, S.slow], [S.done, S.door]]) {
  const a = fs(f0), b = fs(f1); let ph = 0, lp = 0;
  for (let i = a; i < b; i++) {
    const s = spinNorm((i / SR) * FPS), fr = 45 + 820 * s;
    ph += (2 * Math.PI * fr) / SR; lp += (0.02 + 0.2 * s) * (noise() - lp);
    const env = Math.min(1, (i - a) / 2000, (b - i) / 2000);
    mach[i] += ((Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3.01 * ph)) * (0.025 + 0.03 * s) + lp * 0.25 * s) * env;
  }
}
// rattle of droplets during the fast spin
for (let f = S.spin + 30; f < S.slow - 4; f++) if (rnd() < 0.5) { const s0 = fs(f) + Math.floor(rnd() * 1400); for (let i = 0; i < 200; i++) add(mach, s0 + i, noise() * Math.exp(-i / 40) * 0.05); }
// slow motion: whoosh down, deep rumble, slow-heartbeat thumps, droplet melody
sweep(mach, S.slow - 4, S.slow + 14, 900, 50, 0.35, 0.5);
{ const a = fs(S.slow), b = fs(S.done); let ph = 0, lp = 0;
  for (let i = a; i < b; i++) {
    const t = (i - a) / SR; ph += 2 * Math.PI * 34 / SR; lp += 0.01 * (noise() - lp);
    const env = Math.min(1, t / 0.4, (b - i) / (SR * 0.2));
    const swoosh = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 2.2);
    mach[i] += (Math.sin(ph) * 0.09 + lp * 1.6 * swoosh) * env;
  } }
for (let f = S.slow; f < S.done; f += BEAT) kick(mach, f, 0.6, 32, 70, 0.4);
{ const mel = [76, 74, 72, 69, 72, 74, 76, 79, 81, 79, 76, 74, 72, 74, 69];
  dropHits.forEach((f, k) => plink(f, mel[k % mel.length], 0.2)); }
sweep(mach, S.done - 12, S.done + 1, 60, 900, 0.3, 0.4);
// wash slow motion: whoosh down, underwater rumble, slow heartbeat, riser into the big splash
sweep(mach, WASH_SLOW[0] - 4, WASH_SLOW[0] + 14, 800, 55, 0.3, 0.5);
{ const a = fs(WASH_SLOW[0]), b = fs(WASH_SLOW[1]); let lp = 0, ph = 0;
  for (let i = a; i < b; i++) { const t = (i - a) / SR; lp += 0.006 * (noise() - lp); ph += 2 * Math.PI * 40 / SR;
    mach[i] += (lp * 2.2 * (0.6 + 0.4 * Math.sin(2 * Math.PI * t / 1.3)) + Math.sin(ph) * 0.05) * Math.min(1, t / 0.3, (b - i) / (SR * 0.1)); } }
for (let f = WASH_SLOW[0]; f < WASH_SLOW[1]; f += BEAT) kick(mach, f, 0.5, 30, 65, 0.4);
sweep(mach, WASH_SLOW[1] - 14, WASH_SLOW[1], 60, 700, 0.25, 0.5);
// end-of-cycle beeps + door unlock
beep(S.door + 2, 81); beep(S.door + 12, 81); beep(S.door + 22, 88, 0.45);
{ const s0 = fs(S.door + 30); for (let i = 0; i < 1500; i++) add(mach, s0 + i, noise() * Math.exp(-i / 150) * 0.4); }

// ---------- vinyl crackle ----------
const crackle = new Float32Array(N);
{ let lp = 0; for (let i = 0; i < N; i++) { lp += 0.02 * (noise() - lp); crackle[i] = lp * 0.05 + (rnd() < 0.0006 ? noise() * 0.25 : 0); } }

// ---------- mix ----------
// music bus: lo-fi lowpass (dark), heavy filter + duck in slow motion
const musicBus = new Float32Array(N);
for (let i = 0; i < N; i++) musicBus[i] = music[i] + drums[i];
const slowAmt = (i) => { const f = (i / SR) * FPS, w = (a, b) => clamp(Math.min((f - a + 4) / 10, (b - f) / 8)); return Math.max(w(S.slow, S.done), w(WASH_SLOW[0], WASH_SLOW[1])); };
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
