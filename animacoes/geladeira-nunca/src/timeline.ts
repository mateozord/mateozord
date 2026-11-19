// Shared timing. Cut list + machine sound events live in timeline.json (also read by scripts/gen-audio.mjs).
import T from './timeline.json';

export const FPS = T.fps, TOTAL = T.total;
export const S = T.sections;
export const SHOTS = T.shots as [number, string, string][];
export const SFX = T.sfx as [number, number, string][];
export const SLOW = T.slow;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (t: number) => { t = clamp(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const smooth = (a: number, b: number, f: number) => ease((f - a) / (b - a));
export const shotAt = (f: number) => { let i = 0; while (i < SHOTS.length - 1 && f >= SHOTS[i + 1][0]) i++; return i; };

// slow motion of the glass cracking: 1x -> 0.2x -> 1x, eased
export const speed = (f: number) => 1 - 0.8 * Math.min(smooth(SLOW[0], SLOW[1], f), 1 - smooth(SLOW[2], SLOW[3], f));
const ST: number[] = [0];
for (let f = 1; f <= TOTAL + 1; f++) ST.push(ST[f - 1] + speed(f - 1));
export const sceneTime = (f: number) => ST[clamp(Math.floor(f), 0, TOTAL)];
// loop-safe rate: r * sceneTime(TOTAL) becomes a whole number, so cyclic particles end where they began
export const lr = (r: number) => Math.max(1, Math.round(r * ST[TOTAL])) / ST[TOTAL];
// integrate a per-frame rate; scaled so the total is a whole number of periods (loop matches frame 0)
export function integ(rate: (f: number) => number, period: number) {
  const a = [0];
  for (let f = 1; f <= TOTAL; f++) a.push(a[f - 1] + rate(f - 1));
  const k = (Math.max(1, Math.round(a[TOTAL] / period)) * period) / a[TOTAL];
  return a.map((v) => v * k);
}

export const CRACK = T.crack; // glass cracks (inside the slow motion)
export const CLICKS = T.clicks; // thermostat clicks
export const DOOR_SHUT = T.doorShut;
const MOTOR = T.motor;
export const motorLevel = (f: number) => Math.max(...MOTOR.map(([a, b]) => Math.min(smooth(a, a + 10, f), 1 - smooth(b, b + 10, f))));
// heat load (condenser glow + gauge). Jumps only on cuts (59->60, 1999->2000).
const HEAT: number[][] = [[0, 1], [59, 1], [60, 0.4], [290, 0.4], [400, 1], [540, 0.4], [600, 0.4], [800, 0.8], [920, 0.5], [1100, 0.8], [1250, 0.5], [1300, 0.5], [1440, 1], [1560, 0.5], [1999, 0.5], [2000, 1], [TOTAL, 1]];
export const heatAt = (f: number) => { let i = 0; while (i < HEAT.length - 2 && f >= HEAT[i + 1][0]) i++; const [a, va] = HEAT[i], [b, vb] = HEAT[i + 1]; return va + (vb - va) * smooth(a, b, f); };
export const potScale = (f: number) => (f < 440 ? 1 : f < 2000 ? 1 - smooth(440, 464, f) : 1);
export const shallowScale = (f: number) => (f >= 448 && f < 2000 ? smooth(450, 474, f) : 0);
export const doorOpen = (f: number) => (f >= 560 && f < 920 ? smooth(566, 600, f) * (1 - smooth(858, DOOR_SHUT, f)) : 0);
export const frostAt = (f: number) => smooth(630, 790, f) * (1 - smooth(1190, 1250, f));
export const blockAt = (f: number) => smooth(930, 975, f) * (1 - smooth(1185, 1225, f));
export const wallNear = (f: number) => smooth(1268, 1320, f) * (1 - smooth(1505, 1545, f));
export const wallVisible = (f: number) => f >= 1260 && f < 1550;
// freezing: water -> ice and expands up the neck, then the glass cracks (in scene time)
export const freezeAt = (f: number) => smooth(1640, 1760, f);
// labels: [from, to, text, point, side, y]. The part with the same name pulses (colour highlight) while its label is up.
// max 2 at a time, fixed slots y=330 / y=470.
export type Lab = [number, number, string, string, 'L' | 'R', number];
export const LABS: Lab[] = [
  [64, 108, 'COMPRESSOR', 'compressor', 'L', 470], [74, 108, 'PISTÃO', 'piston', 'R', 330],
  [114, 158, 'SERPENTINA', 'grid', 'L', 330], [124, 158, 'GÁS QUENTE', 'hotGas', 'R', 470],
  [164, 198, 'EVAPORADOR', 'evap', 'L', 470], [172, 198, 'GÁS FRIO', 'coldGas', 'R', 330],
  [206, 258, 'PANELA QUENTE', 'pot', 'L', 470], [222, 258, 'VAPOR', 'steam', 'R', 330],
  [264, 318, 'TERMOSTATO', 'thermo', 'R', 470],
  [324, 378, 'COMPRESSOR', 'compressor', 'L', 470], [334, 378, 'PISTÃO', 'piston', 'R', 330],
  [384, 438, 'SERPENTINA', 'grid', 'L', 330],
  [474, 498, 'POTES RASOS', 'shallow', 'R', 470],
  [506, 558, 'COMPRESSOR', 'compressor', 'L', 470],
  [598, 618, 'AR QUENTE', 'warmIn', 'R', 330],
  [624, 678, 'AR QUENTE', 'warmIn', 'R', 330], [636, 678, 'AR FRIO SAI', 'coldOut', 'L', 470],
  [684, 738, 'EVAPORADOR', 'evap', 'L', 470], [700, 738, 'GELO', 'frost', 'R', 330],
  [744, 798, 'VENTILADOR', 'fan', 'L', 470],
  [804, 858, 'COMPRESSOR', 'compressor', 'L', 470], [814, 858, 'PISTÃO', 'piston', 'R', 330],
  [864, 918, 'BORRACHA', 'gasket', 'R', 470],
  [944, 978, 'CAIXAS', 'boxes', 'L', 470],
  [986, 1048, 'VENTILADOR', 'fan', 'L', 470],
  [1058, 1118, 'AR PARADO', 'airStuck', 'R', 330],
  [1126, 1178, 'CANTO MORNO', 'hotspot', 'L', 470],
  [1204, 1258, 'AR CIRCULA', 'airFlow', 'R', 330],
  [1290, 1318, 'PAREDE', 'wall', 'R', 330],
  [1326, 1378, 'SERPENTINA', 'grid', 'L', 470],
  [1386, 1438, 'CALOR PRESO', 'trapped', 'R', 330],
  [1446, 1498, 'COMPRESSOR', 'compressor', 'L', 470], [1456, 1498, 'PISTÃO', 'piston', 'R', 330],
  [1516, 1548, 'VÃO', 'gap', 'R', 330],
  [1606, 1658, 'GARRAFA DE VIDRO', 'bottle', 'L', 470], [1620, 1658, 'TAMPA', 'cap', 'R', 330],
  [1666, 1718, 'GELO', 'ice', 'R', 470],
  [1726, 1778, 'GARGALO', 'neck', 'L', 330],
  [1804, 1838, 'RACHADURA', 'crack', 'R', 470],
  [1850, 1898, 'CACOS', 'shards', 'L', 330],
];
export const crackAt =(f: number) => clamp((sceneTime(f) - sceneTime(CRACK)) / 14);
