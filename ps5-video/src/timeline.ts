// Shared timing. Keep in sync with scripts/gen-audio.mjs. Music bars start at frame 60 (after the 2s hook).
export const FPS = 30, BEAT = 20, BAR = 80, TOTAL = 860, O = 60;
export const S = {hook: 0, disc: 60, install: 220, decomp: 300, ram: 460, chip: 540, gpu: 620, tv: 700, outro: 780, end: 860};
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const CLACK = 22; // disc fully inserted
export const sixteenth = (f: number, from: number) => Math.floor((f - from) / 5);
