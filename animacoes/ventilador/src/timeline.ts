// Shared timing. Keep in sync with scripts/gen-audio.mjs.
export const FPS = 30, BEAT = 20, BAR = 80, TOTAL = 1200;
export const S = {title: 0, blades: 80, motor: 240, field: 400, speeds: 560, osc: 720, slow: 880, back: 1040, outro: 1120, end: 1200};
export const REAL = 1200 / 60 / FPS; // revolutions per frame at real speed (1200 RPM)
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const ex = (a: number, b: number, t: number) => a * Math.pow(b / a, ease(t));
export function factorAt(f: number) { // slow-motion factor (1 = real speed)
  if (f < S.blades) return 1;
  if (f < S.motor) return f < 150 ? ex(1, 16, (f - 80) / 18) : ex(16, 64, (f - 150) / 16);
  if (f < S.field) return 64;
  if (f < S.speeds) return REAL * 40; // rotor: exactly 1 turn per 2 beats -> 1 coil per 16th note
  if (f < S.slow) return 16;
  if (f < S.back) return ex(16, 256, (f - S.slow) / 16);
  if (f < S.outro) return ex(256, 1, (f - S.back) / 24);
  return 1;
}
export const BUTTONS = [564, 604, 644];
export function rpmRealAt(f: number) {
  if (f < S.speeds || f >= S.osc) return 1200;
  let r = 1200, prev = 1200;
  BUTTONS.forEach((b, i) => { if (f >= b) { prev = r; r = [800, 1000, 1200][i]; } });
  const last = [...BUTTONS].reverse().find((b) => f >= b);
  if (last === undefined) return 1200;
  return prev + (r - prev) * ease((f - last) / 12);
}
export const revAt = (f: number) => rpmRealAt(f) / 1800 / factorAt(f); // rev per frame as displayed
export const ringHits: number[] = [];
for (let f = S.slow + 10; f < S.back - 8; f += 10) ringHits.push(f);
export const coilIndex = (f: number) => Math.floor((f - S.field) / 5) % 8;
