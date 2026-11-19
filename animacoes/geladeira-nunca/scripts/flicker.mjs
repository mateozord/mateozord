// Flicker check: node scripts/flicker.mjs out/geladeira-nunca.mp4
// Mean luma per frame (ffmpeg signalstats). Flags 1-frame spikes (frame differs from both neighbours, neighbours agree)
// and lists the biggest consecutive-frame jumps (should be the planned cuts only).
import {execFileSync} from 'node:child_process';

const out = execFileSync('ffmpeg', ['-v', 'error', '-i', process.argv[2], '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], {maxBuffer: 1 << 26}).toString();
const Y = [...out.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
const d = Y.map((v, i) => (i ? Math.abs(v - Y[i - 1]) : 0));
const spikes = [];
for (let i = 1; i < Y.length - 1; i++) if (d[i] > 6 && d[i + 1] > 6 && Math.abs(Y[i + 1] - Y[i - 1]) < 0.4 * Math.min(d[i], d[i + 1])) spikes.push(i);
const top = d.map((v, i) => [i, +v.toFixed(2)]).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log(JSON.stringify({frames: Y.length, minY: Math.min(...Y).toFixed(1), maxY: Math.max(...Y).toFixed(1), loopDiff: Math.abs(Y[0] - Y[Y.length - 1]).toFixed(2), spikes, topJumps: top}));
