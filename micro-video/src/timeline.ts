// Shared timing. Keep in sync with scripts/gen-audio.mjs. Music bars start at frame 60 (after the 2s hook).
export const FPS = 30, BEAT = 20, BAR = 80, TOTAL = 2300, O = 60;
export const S = {hook: 0, door: 60, transf: 300, mag: 540, wave: 780, plate: 1020, bag: 1260, kernel: 1500, popping: 1820, ding: 2000, outro: 2060, end: 2300};
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const KPOP = [40, 1800]; // the big kernel bursts (hook + end of the kernel section)
export const DING = [2026, 2036, 2046];
export const sixteenth = (f: number, from: number) => Math.floor((f - from) / 5);
export const cutsAt = [S.door, S.bag, S.kernel, S.popping, S.ding, S.outro];
// kernels popping inside the bag: quantized to 16th notes, busy in the middle
export const BAGPOPS: number[] = [];
for (let f = S.popping + 20, k = 0; f < S.ding - 16 && BAGPOPS.length < 18; f += 5, k++) {
  const dens = Math.sin((Math.PI * (f - S.popping)) / (S.ding - S.popping));
  if (((k * 7) % 10) / 10 < dens * 0.75) BAGPOPS.push(f);
}
