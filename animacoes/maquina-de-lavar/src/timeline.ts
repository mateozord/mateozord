// Shared timing. Keep in sync with scripts/gen-audio.mjs (same constants).
export const FPS = 30;
export const BEAT = 20; // 90 BPM -> 20 frames per beat
export const BAR = 80;
export const TOTAL = 1200;
export const S = {title: 0, fill: 80, wash: 240, motor: 480, side: 560, drain: 640, spin: 720, slow: 880, done: 1040, door: 1080, outro: 1120, end: 1200};
export const WASH_SLOW = [320, 400] as const;
// wash cycles [start, landing, direction]; the landing is the kick drum. The 3rd cycle is in slow motion.
export const washCycles: [number, number, number][] = [[240, 280, 1], [280, 320, 1], [320, 400, 1], [400, 440, -1], [440, 480, -1]];
export const washKicks = washCycles.map((c) => c[1]);
// Slow motion: a drop hits the tub every half beat (= melody note).
export const dropHits: number[] = [];
for (let f = S.slow + 18; f < S.done - 6; f += 10) dropHits.push(f);
export const DROP_FLIGHT = 8;
export const inSlow = (f: number) => (f >= WASH_SLOW[0] && f < WASH_SLOW[1]) || (f >= S.slow && f < S.done);
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
