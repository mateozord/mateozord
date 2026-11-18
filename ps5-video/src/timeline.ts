// Shared timing. Keep in sync with scripts/gen-audio.mjs. Music bars start at frame 60 (after the 2s hook).
export const FPS = 30, BEAT = 20, BAR = 80, TOTAL = 1660, O = 60;
export const S = {hook: 0, disc: 60, laser: 220, install: 380, decomp: 540, ram: 700, cpu: 860, gpu: 1020, cool: 1180, tv: 1340, outro: 1500, end: 1660};
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const CLACK = 40; // disc fully inserted
export const SINK = 1300; // heatsink lands
export const LIQUID = 1236; // liquid metal applied
export const sixteenth = (f: number, from: number) => Math.floor((f - from) / 5);
