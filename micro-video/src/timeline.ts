// Shared timing. Keep in sync with scripts/gen-audio.mjs. Music bars start at frame 60 (after the 2s hook).
export const FPS = 30, BEAT = 20, BAR = 80, TOTAL = 1580, O = 60;
export const S = {hook: 0, door: 60, transf: 220, mag: 380, wave: 540, plate: 700, mol: 860, metal: 1100, pop: 1260, outro: 1420, end: 1580};
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const POPS = [40, 1088]; // the kernel bursts (hook + end of molecules)
export const FORK = 1140; // fork appears
export const DING = [1380, 1390, 1400];
export const sixteenth = (f: number, from: number) => Math.floor((f - from) / 5);
export const cutsAt = [S.door, S.mol, S.metal, S.outro]; // camera cuts between sets (flash)
