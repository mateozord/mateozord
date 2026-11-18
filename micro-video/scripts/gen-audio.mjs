// Procedural lo-fi soundtrack + machine foley, frame-locked to the animation.
// Same timing constants as src/timeline.ts (30 fps, 90 BPM => 20 frames per beat).
import {writeFileSync, mkdirSync} from 'node:fs';

const SR = 44100, FPS = 30, BEAT = 20, BAR = 80, TOTAL = 1580, O = 60;
const S = {hook: 0, door: 60, transf: 220, mag: 380, wave: 540, plate: 700, mol: 860, metal: 1100, pop: 1260, outro: 1420, end: 1580};
const POPS = [40, 1088], FORK = 1140, DING = [1380, 1390, 1400];

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
for (let bar = -1; bar < (TOTAL - O) / BAR; bar++) {
  const f = O + bar * BAR, ch = CHORDS[(bar + 4) % 4], r = ROOTS[(bar + 4) % 4];
  if (f >= S.outro + BAR) { rhodes(f, ch, 0.05, 2.6); rhodes(f + BEAT * 2.5, ch.slice(1), 0.03, 1.4); bass(f, r, 2.5, 0.22); continue; }
  rhodes(f, ch, 0.055);
  rhodes(f + BEAT * 2.5, ch.slice(1), 0.032, 1.3);
  if (bar >= 0) { bass(f, r, 1.2); bass(f + BEAT * 2, r, 0.5, 0.2); bass(f + BEAT * 2.5, r + 12, 0.3, 0.14); bass(f + BEAT * 3.5, r + 7, 0.25, 0.14); }
}
// ---------- drums (the beat drops right after the hook) ----------
const sixteenth = BEAT / 4, swing = 0.028;
for (let bar = 0; bar < (S.outro + BAR - O) / BAR; bar++) {
  const f0 = O + bar * BAR;
  const breakdown = f0 === S.mol - BAR; // half-time bar before "o segredo"
  for (let st = 0; st < 16; st++) if (!breakdown || st % 4 === 0) hat(f0 + st * sixteenth, st % 4 === 2 ? 0.11 : 0.06, st % 2 ? swing : 0);
  kick(drums, f0, 0.9);
  if (!breakdown) { kick(drums, f0 + BEAT * 2, 0.8); kick(drums, f0 + BEAT * 2.5, 0.45); snare(f0 + BEAT, 0.32); }
  snare(f0 + BEAT * 3, 0.32);
}
const crash = (f, a = 0.3) => { const s0 = fs(f); let hp = 0, prev = 0; for (let i = 0; i < SR * 1.2; i++) { const n = noise(); hp = 0.7 * (hp + n - prev); prev = n; add(drums, s0 + i, hp * a * Math.exp(-i / (SR * 0.35))); } };
crash(S.door); crash(S.mol, 0.35); crash(S.metal, 0.3);
// ---------- microwave foley ----------
function zap(f, m, amp) {
  const s0 = fs(f), fr = mtof(m);
  for (let i = 0; i < SR * 0.25; i++) {
    const t = i / SR; let v = 0;
    for (let k = 1; k <= 5; k++) v += Math.sin(2 * Math.PI * fr * k * t) / k;
    add(mach, s0 + i, (v * 0.5 * Math.exp(-t / 0.07) + (i < 120 ? noise() * 0.4 * (1 - i / 120) : 0)) * amp);
  }
}
const popSnd = (f, a) => { const s0 = fs(f); let lp = 0; for (let i = 0; i < 6000; i++) { lp += 0.5 * (noise() - lp); add(mach, s0 + i, (lp * 1.2 * Math.exp(-i / 250) + Math.sin(2 * Math.PI * (180 - i * 0.02) * i / SR) * 0.6 * Math.exp(-i / 900)) * a); } };
// hook: sizzle building, then the kernel POPs
{ const a = fs(0), b = fs(POPS[0]); let hp = 0, prev = 0; for (let i = a; i < b; i++) { const n = noise(); hp = 0.85 * (hp + n - prev); prev = n; mach[i] += hp * 0.06 * ((i - a) / (b - a)); } }
popSnd(POPS[0], 1.2);
// door click, keypad beeps on 16ths, START
{ const s0 = fs(70); for (let i = 0; i < 2500; i++) add(mach, s0 + i, noise() * 0.5 * Math.exp(-i / 200)); }
for (const [f, m] of [[150, 88], [155, 91], [160, 93], [170, 96]]) beep(f, m, 0.08, 0.05);
// running hum (120 Hz transformer buzz) + turntable motor + fan, while cooking
{ const a = fs(180), b = fs(1400); let ph = 0, lp = 0;
  for (let i = a; i < b; i++) { const f = (i / SR) * FPS; ph += 2 * Math.PI * 120 / SR; lp += 0.04 * (noise() - lp);
    const loud = f >= S.transf && f < S.mag ? 0.07 : f >= S.mol && f < S.metal ? 0.012 : 0.03;
    mach[i] += (Math.tanh(Math.sin(ph) * 3) * loud + lp * 0.25) * Math.min(1, (i - a) / 4000, (b - i) / 4000); } }
// transformer crackle on 8ths
for (let f = S.transf + 10; f < S.mag; f += 10) { const s0 = fs(f); for (let i = 0; i < 400; i++) add(mach, s0 + i, noise() * 0.2 * Math.exp(-i / 60)); }
// magnetron: electrons spinning = arpeggio on 16ths + high whine
for (let f = S.mag, k = 0; f < S.wave; f += 5, k++) { const ch = CHORDS[(Math.floor((f - O) / BAR) + 4) % 4].slice(1); zap(f, ch[k % ch.length] + 24, 0.035); }
{ const a = fs(S.mag), b = fs(S.wave); let ph = 0; for (let i = a; i < b; i++) { ph += 2 * Math.PI * 2450 / SR; mach[i] += Math.sin(ph) * 0.006 * Math.min(1, (i - a) / 8000, (b - i) / 8000); } }
// waveguide: a "whoom" per launched wave (8ths), pentatonic
for (let f = S.wave, k = 0; f < S.plate; f += 10, k++) plink(f, [69, 72, 74, 76, 79, 81][(k * 5) % 6], 0.08);
// hot spots: sizzle pulses on beats
for (let f = S.plate; f < S.mol - BAR; f += BEAT) { const s0 = fs(f); let hp = 0, prev = 0; for (let i = 0; i < SR * 0.3; i++) { const n = noise(); hp = 0.9 * (hp + n - prev); prev = n; add(mach, s0 + i, hp * 0.08 * Math.exp(-i / (SR * 0.1))); } }
sweep(mach, S.mol - 28, S.mol, 120, 1400, 0.22, 0.6);
// molecules: each flip (8th) is a note; heat sizzle grows; steam hiss; POP
{ const mel = [76, 74, 72, 69, 72, 74, 76, 79, 81, 79, 76, 74]; for (let f = S.mol, k = 0; f < POPS[1] - 4; f += 10, k++) plink(f, mel[k % mel.length], 0.13); }
{ const a = fs(S.mol), b = fs(POPS[1]); let hp = 0, prev = 0; for (let i = a; i < b; i++) { const n = noise(); hp = 0.85 * (hp + n - prev); prev = n; mach[i] += hp * 0.05 * ((i - a) / (b - a)) ** 2; } }
{ const a = fs(1040), b = fs(POPS[1]); let lp = 0; for (let i = a; i < b; i++) { lp += 0.4 * (noise() - lp); mach[i] += lp * 0.08 * ((i - a) / (b - a)); } }
popSnd(POPS[1], 1.3);
// fork sparks: zaps on 16ths (same pattern as the visuals)
for (let f = FORK + 20, k = 4; f < S.pop - 10; f += 5, k++) if (k % 3 !== 0) { const s0 = fs(f); let hp = 0, prev = 0; for (let i = 0; i < 1800; i++) { const n = noise(); hp = 0.5 * (hp + n - prev); prev = n; add(mach, s0 + i, (hp * 0.35 + Math.sin(2 * Math.PI * 3200 * i / SR) * 0.08) * Math.exp(-i / 300)); } }
// popcorn popping: quantized to 16ths, getting busier, then slowing
for (let f = S.pop, k = 0; f < 1372; f += 5, k++) { const dens = Math.sin(Math.PI * (f - S.pop) / 112); if (((k * 7) % 10) / 10 < dens * 0.85) popSnd(f, 0.25 + 0.2 * ((k * 3) % 4) / 4); }
DING.forEach((f, i) => beep(f, i === 2 ? 93 : 88, i === 2 ? 0.4 : 0.15, 0.06));
// myth outro: soft wave whooshes
for (let f = S.outro + 20; f < S.end - 40; f += 40) sweep(mach, f, f + 16, 300, 900, 0.08, 0.3);

// ---------- vinyl crackle ----------
const crackle = new Float32Array(N);
{ let lp = 0; for (let i = 0; i < N; i++) { lp += 0.02 * (noise() - lp); crackle[i] = lp * 0.05 + (rnd() < 0.0006 ? noise() * 0.25 : 0); } }

// ---------- mix ----------
// music bus: lo-fi lowpass (dark), heavy filter + duck in slow motion
const musicBus = new Float32Array(N);
for (let i = 0; i < N; i++) musicBus[i] = music[i] + drums[i];
const slowAmt = (i) => { const f = (i / SR) * FPS; return clamp((S.door - f) / 4); }; // hook: muffled music, beat drops at the reveal
{ let y = 0; for (let i = 0; i < N; i++) { const s = slowAmt(i), fc = 5200 * (1 - s) + 320 * s, a = 1 - Math.exp(-2 * Math.PI * fc / SR); y += a * (musicBus[i] - y); musicBus[i] = y * (1 - 0.72 * s); } }
// simple echo on plinks
{ const d = Math.round(SR * (BEAT / FPS) * 0.75); for (let i = d; i < N; i++) plinks[i] += plinks[i - d] * 0.38; }
const out = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const f = (i / SR) * FPS;
  const master = Math.min(1, f / 1) * Math.min(1, (TOTAL - f) / 24);
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
