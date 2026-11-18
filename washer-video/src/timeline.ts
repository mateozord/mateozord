// Shared timing. Keep in sync with scripts/gen-audio.mjs (same constants).
export const FPS = 30;
export const BEAT = 20; // 90 BPM -> 20 frames per beat
export const BAR = 80;
export const TOTAL = 960;
export const S = {title: 0, fill: 80, wash: 160, motor: 320, drain: 400, spin: 480, slow: 640, done: 800, door: 840, outro: 880, end: 960};
// Clothes hit the water on beats 1 and 3 during the wash (= kick drum).
export const washKicks = [200, 240, 280, 320];
// Slow motion: a drop hits the tub every half beat (= melody note).
export const dropHits: number[] = [];
for (let f = S.slow + 18; f < S.done - 6; f += 10) dropHits.push(f);
export const DROP_FLIGHT = 8;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
