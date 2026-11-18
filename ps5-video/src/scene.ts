import * as THREE from 'three';
import {S, CLACK, SINK, LIQUID, clamp, ease, sixteenth} from './timeline';
import {drawText} from './font';

export const RW = 270, RH = 480;
THREE.ColorManagement.enabled = false;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Key = number[]; // [frame, px, py, pz, tx, ty, tz, fov]
const KEYS: Key[] = [
  [0, -3.3, 0.9, 3.1, 0, 0.68, 2.3, 34], [40, -2.6, 1.0, 3.2, 0, 0.7, 1.4, 34], [62, -0.8, 2.4, 4.8, 0, 1.2, 0.6, 36],
  [100, 3.4, 1.4, 2.6, 0, 0.8, 0.5, 34], [140, 3.0, 0.9, 1.3, 0, 0.65, 0.55, 34], [200, 2.2, 0.8, 2.2, 0, 0.65, 1.05, 30],
  [240, 0.65, 0.42, 1.65, 0.04, 0.38, 0.55, 26], [320, 0.75, 0.28, 1.45, 0.04, 0.3, 0.55, 26], [380, 2.6, 0.9, 0.2, 0, 0.9, 0.2, 32],
  [420, 2.2, 1.55, -0.7, 0, 1.42, -0.55, 30], [500, 2.2, 1.6, 0.6, 0, 1.42, 0.45, 30], [560, 2.0, 1.9, -1.2, 0, 1.78, -0.6, 30],
  [640, 1.7, 2.1, -0.3, 0, 1.78, -0.6, 28], [700, 2.6, 2.2, -0.6, 0, 1.95, -0.2, 32], [760, 2.8, 2.5, 0.9, 0, 2.35, 0.1, 32],
  [840, 2.0, 3.0, -0.2, 0, 2.6, 0.1, 30], [880, 1.6, 2.4, -0.3, 0, 2.36, -0.01, 24], [1000, 1.4, 2.2, 0.2, 0, 2.36, 0.0, 24],
  [1040, 1.5, 2.5, 0.5, 0, 2.4, 0.19, 24], [1160, 1.7, 2.2, 0.0, 0, 2.4, 0.19, 26], [1200, 2.8, 2.6, 1.4, 0, 2.4, 0.15, 32],
  [1280, 3.2, 3.0, 1.9, 0, 2.6, 0.3, 34], [1330, 2.6, 3.4, -0.6, 0, 3.1, -0.5, 34], [1370, 2.6, 3.0, 6.2, -2.4, 2.4, 1.8, 38],
  [1400, 2.3, 2.7, 8.4, -3.5, 2.5, 2.6, 40], [1500, 2.5, 2.8, 8.7, -3.4, 2.5, 2.5, 40], [1580, 6.5, 3.8, 7.5, -1.5, 1.9, 0.8, 40],
  [1660, 7.8, 4.4, 6.0, -1.2, 1.8, 0.6, 40],
];
function camAt(f: number) {
  let i = 0;
  while (i < KEYS.length - 2 && f >= KEYS[i + 1][0]) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const t = clamp((f - k1[0]) / (k2[0] - k1[0]));
  const out: number[] = [];
  for (let j = 1; j < 8; j++) {
    const p0 = k0[j], p1 = k1[j], p2 = k2[j], p3 = k3[j];
    out.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t));
  }
  return out;
}
const cutAt = (f: number) => Math.min(ease((f - 62) / 24), 1 - ease((f - 1540) / 40));

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FS = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float cNear; uniform float cFar; varying vec2 vUv;
float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * cNear * cFar) / (cFar + cNear - z * (cFar - cNear)); }
float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
void main(){
  vec2 px = 1.0 / res; vec3 c = texture2D(tColor, vUv).rgb; float d = lin(texture2D(tDepth, vUv).x);
  float e = 0.0;
  vec2 o[4]; o[0] = vec2(px.x, 0.0); o[1] = vec2(-px.x, 0.0); o[2] = vec2(0.0, px.y); o[3] = vec2(0.0, -px.y);
  for (int i = 0; i < 4; i++) { float dn = lin(texture2D(tDepth, vUv + o[i]).x); if (dn - d > 0.05 * d + 0.02) e = 1.0; }
  c = mix(c, vec3(0.045, 0.05, 0.12), e * 0.92);
  c = floor(c * 18.0 + bayer(gl_FragCoord.xy)) / 18.0;
  gl_FragColor = vec4(c, 1.0);
}`;

type Flow = {curve: THREE.CatmullRomCurve3; from: number; to: number; n: number; speed: number; color: string; s0: number; s1: number};
const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!; draw(c);
  const t = new THREE.CanvasTexture(cv); t.minFilter = t.magFilter = THREE.NearestFilter; return t;
};

export class PS5Scene {
  renderer: THREE.WebGLRenderer;
  rt: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, RW / RH, 0.1, 40);
  postScene = new THREE.Scene();
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 10);
  grad: THREE.DataTexture;
  disc = new THREE.Group();
  rollers: THREE.Object3D[] = [];
  sled = new THREE.Group();
  worm!: THREE.Mesh;
  lens!: THREE.Mesh;
  beam!: THREE.Mesh;
  fan = new THREE.Group();
  sink = new THREE.Group();
  liquid!: THREE.Mesh;
  die!: THREE.Mesh;
  ssd: THREE.Mesh[] = [];
  ram: THREE.Mesh[] = [];
  cpu: THREE.Mesh[] = [];
  gpu: THREE.Mesh[] = [];
  decomp!: THREE.Mesh;
  tvCanvas = document.createElement('canvas');
  tvTex: THREE.CanvasTexture;
  flows: Flow[] = [];
  bits!: THREE.InstancedMesh;
  pts: Record<string, THREE.Object3D> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true});
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RW, RH, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.rt = new THREE.WebGLRenderTarget(RW, RH, {minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(RW, RH)});
    this.grad = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 220, 220, 220, 255, 255, 255, 255, 255]), 4, 1);
    this.grad.minFilter = this.grad.magFilter = THREE.NearestFilter;
    this.grad.needsUpdate = true;
    this.tvCanvas.width = 192; this.tvCanvas.height = 108;
    this.tvTex = new THREE.CanvasTexture(this.tvCanvas);
    this.tvTex.minFilter = this.tvTex.magFilter = THREE.NearestFilter;
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: POST_VS, fragmentShader: POST_FS,
      uniforms: {tColor: {value: this.rt.texture}, tDepth: {value: this.rt.depthTexture}, res: {value: new THREE.Vector2(RW, RH)}, cNear: {value: 0.1}, cFar: {value: 40}},
    })));
    this.build();
  }
  mat(c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) { return new THREE.MeshToonMaterial({color: c, gradientMap: this.grad, ...o}); }
  glow(c: string, map?: THREE.Texture) { return this.mat(c, {emissive: new THREE.Color('#000000'), map}); }
  box(s: number[], p: number[], m: THREE.Material, parent: THREE.Object3D = this.scene) {
    const x = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), m); x.position.set(p[0], p[1], p[2]); parent.add(x); return x;
  }
  cyl(r: number, h: number, p: number[], m: THREE.Material, axis: 'x' | 'y' | 'z', parent: THREE.Object3D = this.scene, seg = 16) {
    const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); x.position.set(p[0], p[1], p[2]);
    if (axis === 'x') x.rotation.z = Math.PI / 2; if (axis === 'z') x.rotation.x = Math.PI / 2;
    parent.add(x); return x;
  }
  point(name: string, p: number[], parent: THREE.Object3D = this.scene) { const o = new THREE.Object3D(); o.position.set(p[0], p[1], p[2]); parent.add(o); this.pts[name] = o; }
  chipTex(text: string, bg = '#1d2030') {
    return canvasTex(48, 48, (c) => {
      c.fillStyle = bg; c.fillRect(0, 0, 48, 48);
      c.fillStyle = '#3a3f5c'; c.fillRect(2, 2, 44, 44); c.fillStyle = bg; c.fillRect(3, 3, 42, 42);
      drawText(c, text, 24, 14, 1, '#d9dcef', {align: 'center'});
      c.fillStyle = '#6b7099'; for (let y = 26; y < 40; y += 4) c.fillRect(8, y, 20 + ((y * 7) % 12), 1);
      c.fillStyle = '#9aa0c8'; c.fillRect(5, 40, 3, 3);
    });
  }

  build() {
    const sc = this.scene, Z = Math.PI / 2;
    sc.background = new THREE.Color('#1a1f3d');
    sc.fog = new THREE.Fog('#1a1f3d', 9, 22);
    sc.add(new THREE.AmbientLight('#8890c0', 0.6));
    const key = new THREE.DirectionalLight('#fff3dc', 1.4); key.position.set(4, 6, 3); sc.add(key);
    const rim = new THREE.DirectionalLight('#7fa0ff', 0.7); rim.position.set(-4, 3, -4); sc.add(rim);
    const fill = new THREE.DirectionalLight('#ffd9b0', 0.5); fill.position.set(-3, 2, 5); sc.add(fill);
    const clipM = (c: string) => this.mat(c, {clippingPlanes: [this.clip], side: THREE.DoubleSide});
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), this.mat('#151a36')); floor.rotation.x = -Z; sc.add(floor);
    // console shell (generic design) + core
    this.box([0.6, 3.4, 2.4], [0, 1.8, 0], clipM('#1c1f33'));
    const sh = new THREE.Shape();
    sh.moveTo(-1.3, 0.05); sh.lineTo(1.25, 0.05);
    sh.bezierCurveTo(1.3, 1.2, 1.25, 2.4, 1.5, 3.75);
    sh.bezierCurveTo(0.5, 3.6, -0.5, 3.6, -1.45, 3.8);
    sh.bezierCurveTo(-1.25, 2.4, -1.35, 1.2, -1.3, 0.05);
    const shellGeo = new THREE.ExtrudeGeometry(sh, {depth: 0.06, bevelEnabled: false, curveSegments: 20});
    for (const x of [0.36, -0.42]) { const m = new THREE.Mesh(shellGeo, clipM('#eef0fb')); m.rotation.y = Z; m.position.x = x; sc.add(m); }
    for (let i = 0; i < 9; i++) this.box([0.5, 0.02, 0.03], [0, 3.0 + i * 0.05, -1.21], clipM('#0b0c16')); // rear vent
    this.box([0.04, 0.95, 0.03], [0.0, 0.65, 1.21], this.mat('#05060c'));
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.08, 24), this.mat('#2b2e44')); stand.position.y = 0.04; sc.add(stand);
    // mainboard + traces + tiny parts
    this.box([0.03, 3.25, 2.2], [-0.12, 1.85, 0], this.mat('#1f6b4a'));
    for (let i = 0; i < 14; i++) this.box([0.005, 0.008, 1.9], [-0.1, 0.4 + i * 0.22, 0], this.mat('#2d8a60'));
    for (let i = 0; i < 9; i++) this.box([0.005, 2.9, 0.008], [-0.1, 1.9, -1.0 + i * 0.25], this.mat('#2a7d58'));
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const capG = new THREE.CylinderGeometry(0.022, 0.022, 0.05, 8); capG.rotateZ(Z);
    const caps = new THREE.InstancedMesh(capG, this.mat('#c9d0f4'), 60), res = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.02, 0.035), this.mat('#d9a35a'), 90);
    const d0 = new THREE.Object3D();
    const free = (y: number, z: number) => !((y > 1.9 && y < 2.85 && z > -0.45 && z < 0.65) || (y > 1.3 && y < 1.55) || (y > 1.65 && y < 1.92 && z < -0.4) || (y < 1.2 && z > -0.05) || (y > 2.85 && z < -0.25));
    for (let k = 0, placed = 0; placed < 60 && k < 2000; k++) { const y = 0.3 + rnd() * 3.1, z = -1.05 + rnd() * 2.1; if (!free(y, z)) continue; d0.position.set(-0.08, y, z); d0.updateMatrix(); caps.setMatrixAt(placed++, d0.matrix); }
    for (let k = 0, placed = 0; placed < 90 && k < 3000; k++) { const y = 0.3 + rnd() * 3.1, z = -1.05 + rnd() * 2.1; if (!free(y, z)) continue; d0.position.set(-0.098, y, z); d0.rotation.x = rnd() < 0.5 ? 0 : Z; d0.updateMatrix(); res.setMatrixAt(placed++, d0.matrix); }
    sc.add(caps, res);
    // power supply
    this.box([0.22, 0.65, 0.9], [0.02, 0.55, -0.68], this.glow('#3a3d55', this.chipTex('FONTE', '#2b2e44')));
    // disc drive: back plate, spindle motor, rollers, rails, worm screw, stepper, sled
    this.box([0.02, 1.0, 1.15], [-0.07, 0.65, 0.58], this.mat('#3a3d55'));
    this.cyl(0.1, 0.05, [-0.04, 0.65, 0.55], this.mat('#2b2e44'), 'x', sc, 20);
    this.disc.position.set(0, 0.65, 2.15);
    sc.add(this.disc);
    const label = canvasTex(128, 128, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 128);
      ['#2b1650', '#7a2a7a', '#e2556a', '#ff9a5c', '#ffd27a'].forEach((col, i) => g.addColorStop(i / 4, col));
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#ffe28a'; c.beginPath(); c.arc(64, 70, 22, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a1a4a'; for (let y = 62; y < 92; y += 5) c.fillRect(40, y, 48, 2);
      c.fillStyle = '#1b0f2e'; c.fillRect(0, 92, 128, 36);
      for (const [px, h] of [[18, 40], [104, 46], [86, 30]]) { c.fillRect(px, 92 - h, 3, h); for (let k = -1; k <= 1; k += 2) { c.fillRect(px + k * 9 - 6, 90 - h, 12, 2); c.fillRect(px + k * 5, 88 - h, 2, 4); } }
      drawText(c, 'GTA 6', 64, 18, 3, '#ffffff', {align: 'center', outline: '#1b0f2e', shadow: '#ff5fa2', bold: true});
      drawText(c, 'PS5', 64, 104, 1, '#ffd27a', {align: 'center'});
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(64, 64, 9, 0, Math.PI * 2); c.fill();
    });
    const dataSide = canvasTex(128, 128, (c) => {
      for (let a = 0; a < 64; a++) { c.fillStyle = `hsl(${(a * 23) % 360},70%,${74 + (a % 3) * 6}%)`; c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 64, (a / 64) * Math.PI * 2, ((a + 1) / 64) * Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(210,216,255,0.55)'; c.beginPath(); c.arc(64, 64, 64, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(80,90,150,0.35)'; for (let r = 16; r < 64; r += 3) { c.beginPath(); c.arc(64, 64, r, 0, Math.PI * 2); c.stroke(); }
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(64, 64, 9, 0, Math.PI * 2); c.fill();
    });
    const edge = this.cyl(0.45, 0.012, [0, 0, 0], this.mat('#c9d0f4'), 'x', this.disc, 64);
    edge.scale.set(1, 1, 1);
    const faceL = new THREE.Mesh(new THREE.CircleGeometry(0.445, 64), new THREE.MeshBasicMaterial({map: label, transparent: true, alphaTest: 0.5}));
    faceL.rotation.y = -Z; faceL.position.x = -0.007; this.disc.add(faceL);
    const faceD = new THREE.Mesh(new THREE.CircleGeometry(0.445, 64), new THREE.MeshBasicMaterial({map: dataSide, transparent: true, alphaTest: 0.5}));
    faceD.rotation.y = Z; faceD.position.x = 0.007; this.disc.add(faceD);
    this.cyl(0.06, 0.03, [0.012, 0, 0], this.mat('#eef0fb'), 'x', this.disc, 16); // clamp
    for (const x of [-0.035, 0.035]) { const r = this.cyl(0.025, 0.9, [x, 0.65, 1.12], this.mat('#2b2e44'), 'y'); this.rollers.push(r); }
    for (const z of [0.5, 0.6]) this.cyl(0.008, 0.48, [0.07, 0.38, z], this.mat('#e8ecff'), 'y');
    const hp: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) { const t = i / 80, a = t * Math.PI * 2 * 14; hp.push(V(0.07 + Math.cos(a) * 0.012, 0.14 + t * 0.48, 0.55 + Math.sin(a) * 0.012)); }
    this.worm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 200, 0.004, 4), this.mat('#ffd23f')); sc.add(this.worm);
    this.box([0.07, 0.07, 0.09], [0.07, 0.11, 0.55], this.mat('#59639a'));
    this.sled.position.set(0.075, 0.4, 0.55); sc.add(this.sled);
    this.box([0.035, 0.09, 0.16], [0, 0, 0], this.mat('#8e9ad8'), this.sled);
    this.lens = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), this.mat('#6fa8ff', {emissive: new THREE.Color('#000000')})); this.lens.position.set(-0.02, 0, 0); this.sled.add(this.lens);
    this.beam = this.box([0.05, 0.012, 0.012], [-0.045, 0, 0], new THREE.MeshBasicMaterial({color: '#8f7bff'}), this.sled);
    this.point('disc', [0.01, 0.98, 0.75]); this.point('laser', [-0.03, 0, 0], this.sled); this.point('rollers', [0.035, 0.95, 1.12]);
    this.point('spindle', [0.02, 0.65, 0.55]); this.point('worm', [0.07, 0.2, 0.55]);
    // SSD: 12 flash chips + controller
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) this.ssd.push(this.box([0.03, 0.11, 0.16], [-0.09, 1.36 + r * 0.13, -0.95 + i * 0.19], this.glow('#ffffff', this.chipTex('FLASH'))));
    this.box([0.03, 0.2, 0.2], [-0.09, 1.42, 0.25], this.glow('#ffffff', this.chipTex('SSD')));
    this.point('ssd', [-0.07, 1.49, -0.57]); this.point('ctrl', [-0.07, 1.42, 0.25]);
    this.decomp = this.box([0.06, 0.2, 0.28], [-0.08, 1.78, -0.6], this.glow('#e0a83a', this.chipTex('I/O', '#6a4a10')));
    this.point('decomp', [-0.05, 1.82, -0.6]);
    // APU: substrate, die with CPU / GPU tiles, tiny caps
    this.box([0.03, 0.62, 0.62], [-0.095, 2.35, 0.1], this.mat('#2d5e3f'));
    this.die = this.box([0.04, 0.4, 0.4], [-0.07, 2.35, 0.1], this.glow('#b8c0e8'));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) this.cpu.push(this.box([0.012, 0.07, 0.06], [-0.046, 2.48 - r * 0.085, -0.05 + c * 0.075], this.glow('#59639a')));
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) this.gpu.push(this.box([0.012, 0.045, 0.03], [-0.046, 2.52 - r * 0.052, 0.115 + c * 0.037], this.glow('#59639a')));
    for (let k = 0; k < 16; k++) this.box([0.01, 0.015, 0.015], [-0.078, 2.08 + (k % 2) * 0.54, -0.17 + Math.floor(k / 2) * 0.075], this.mat('#d9a35a'));
    this.point('cpu', [-0.04, 2.36, -0.01]); this.point('gpu', [-0.04, 2.39, 0.21]); this.point('apu', [-0.04, 2.62, 0.1]);
    this.liquid = this.box([0.008, 0.36, 0.36], [-0.045, 2.35, 0.1], this.mat('#f4f6ff')); this.liquid.scale.set(1, 0.001, 0.001);
    this.point('liquid', [-0.04, 2.3, 0.05]);
    for (const y of [1.9, 2.82]) for (const z of [-0.32, -0.08, 0.28, 0.52]) this.ram.push(this.box([0.03, 0.16, 0.14], [-0.09, y, z], this.glow('#ffffff', this.chipTex('GDDR6'))));
    this.point('ram', [-0.07, 1.9, -0.32]);
    // cooling: heatsink (base + heat pipes + fins), blower fan
    this.sink.position.x = 1.6; sc.add(this.sink);
    const cu = this.mat('#e0803a'), al = this.mat('#c9d0f4');
    this.box([0.05, 0.42, 0.42], [-0.02, 2.35, 0.1], cu, this.sink);
    for (let k = 0; k < 3; k++) {
      const z = 0.0 + k * 0.1;
      const c = new THREE.CatmullRomCurve3([V(0.0, 2.3, z), V(0.06, 2.55, z), V(0.06, 2.95, z + 0.2), V(0.02, 3.1, z + 0.5)]);
      this.sink.add(new THREE.Mesh(new THREE.TubeGeometry(c, 30, 0.018, 6), cu));
    }
    for (let i = 0; i < 16; i++) this.box([0.16, 0.32, 0.01], [0.04, 3.05, 0.35 + i * 0.03], al, this.sink);
    this.point('sink', [0.08, 2.95, 0.55], this.sink); this.point('fins', [0.1, 3.1, 0.55], this.sink);
    this.fan.position.set(-0.05, 3.15, -0.6); sc.add(this.fan);
    this.cyl(0.34, 0.03, [0, 0, 0], this.mat('#2b2e44'), 'x', this.fan, 28);
    for (let k = 0; k < 11; k++) { const g = new THREE.Group(); g.rotation.x = (k / 11) * Math.PI * 2; const b = this.box([0.05, 0.02, 0.2], [0.03, 0.03, 0.18], this.mat('#8e9ad8'), g); b.rotation.x = 0.35; this.fan.add(g); }
    this.cyl(0.08, 0.06, [0.03, 0, 0], this.mat('#eef0fb'), 'x', this.fan, 16);
    this.point('fan', [0.05, 3.3, -0.6]);
    // HDMI + cable + TV
    this.box([0.1, 0.1, 0.06], [0, 0.4, -1.23], this.mat('#05060c'));
    this.point('hdmi', [0, 0.45, -1.25]);
    const cable = new THREE.CatmullRomCurve3([V(0, 0.4, -1.27), V(-0.8, 0.05, -1.5), V(-2.6, 0.05, 0.6), V(-3.4, 0.05, 2.3), V(-3.5, 1.4, 2.6)]);
    sc.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 60, 0.03, 5), this.mat('#2b2e44')));
    const tv = new THREE.Group(); tv.position.set(-3.5, 2.6, 2.6); tv.rotation.y = Math.PI / 4; sc.add(tv);
    this.box([3.4, 2.0, 0.1], [0, 0, 0], this.mat('#11121c'), tv);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({map: this.tvTex}));
    screen.position.z = 0.06; tv.add(screen);
    this.box([0.1, 1.2, 0.1], [0, -1.6, -0.1], this.mat('#2b2e44'), tv);
    this.box([1.2, 0.05, 0.5], [0, -2.2, -0.1], this.mat('#2b2e44'), tv);
    // data + heat flows
    const C = (...p: number[][]) => new THREE.CatmullRomCurve3(p.map((q) => V(q[0], q[1], q[2])));
    this.flows = [
      {curve: C([0.05, 0.42, 0.55], [0.05, 1.0, 0.4], [-0.05, 1.42, -0.2], [-0.05, 1.42, -0.9]), from: S.laser + 30, to: S.decomp, n: 30, speed: 0.01, color: '#7f9bff', s0: 1, s1: 1},
      {curve: C([-0.05, 1.42, -0.3], [-0.02, 1.6, -0.4], [-0.04, 1.78, -0.6]), from: S.decomp, to: S.ram + 20, n: 22, speed: 0.016, color: '#3ec9a7', s0: 0.55, s1: 0.55},
      {curve: C([-0.04, 1.78, -0.6], [0.02, 1.9, -0.45], [-0.05, 1.9, -0.32]), from: S.decomp + 20, to: S.ram + 40, n: 18, speed: 0.02, color: '#ffd23f', s0: 1.5, s1: 1.5},
      ...[-0.32, -0.08, 0.28, 0.52].flatMap((z) => [1.9, 2.82].map((y) => ({curve: C([-0.05, y, z], [0.03, (y + 2.35) / 2, (z + 0.1) / 2], [-0.03, 2.35, 0.1]), from: S.ram + 30, to: S.cpu + 10, n: 6, speed: 0.03, color: '#ff8a3d', s0: 1, s1: 1}))),
      {curve: C([0.0, 2.35, 0.1], [0.08, 2.6, 0.1], [0.1, 2.95, 0.3], [0.1, 3.1, 0.55], [0.0, 3.2, -0.2], [0.0, 3.2, -1.3], [0.0, 3.3, -2.2]), from: SINK + 6, to: S.tv + 10, n: 34, speed: 0.012, color: '#ff4a3a', s0: 1.1, s1: 1.4},
      {curve: C([-0.03, 2.35, 0.1], [0.08, 1.4, -0.7], [0.03, 0.42, -1.27], [-0.8, 0.1, -1.5], [-2.6, 0.1, 0.6], [-3.4, 0.1, 2.3], [-3.5, 1.4, 2.6]), from: S.tv - 20, to: S.end, n: 40, speed: 0.012, color: '#ff5fa2', s0: 1.2, s1: 1.2},
    ];
    const N = this.flows.reduce((a, b) => a + b.n, 0);
    this.bits = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), new THREE.MeshBasicMaterial({color: '#ffffff'}), N);
    let i = 0;
    for (const fl of this.flows) for (let k = 0; k < fl.n; k++) this.bits.setColorAt(i++, new THREE.Color(fl.color));
    sc.add(this.bits);
  }

  drawTV(f: number, on: number) {
    const c = this.tvCanvas.getContext('2d')!, W = 192, H = 108;
    c.fillStyle = '#05060c'; c.fillRect(0, 0, W, H);
    if (on <= 0) { this.tvTex.needsUpdate = true; return; }
    ['#2b1650', '#5a1f6e', '#a8326e', '#e2556a', '#ff8a5c', '#ffc46b'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * 10, W, 10); });
    c.fillStyle = '#ffe28a'; c.beginPath(); c.arc(140, 52, 18, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2b1650'; for (let y = 44; y < 70; y += 5) c.fillRect(120, y, 40, 2);
    let seed = 3; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let x = 0; x < W; x += 8 + Math.floor(r() * 6)) {
      const h = 18 + r() * 40, w = 8 + Math.floor(r() * 8);
      c.fillStyle = '#1b1238'; c.fillRect(x, 78 - h, w, h);
      c.fillStyle = '#ffd27a'; for (let wy = 82 - h; wy < 74; wy += 5) for (let wx = x + 2; wx < x + w - 1; wx += 3) if (r() < 0.4) c.fillRect(wx, wy, 1, 2);
    }
    for (const px of [20, 70, 170]) { c.fillStyle = '#120a26'; c.fillRect(px, 50, 2, 30); c.fillRect(px - 7, 48, 16, 2); c.fillRect(px - 5, 46, 4, 2); c.fillRect(px + 3, 46, 4, 2); }
    c.fillStyle = '#26203f'; c.fillRect(0, 78, W, 30);
    c.fillStyle = '#ffd23f'; for (let x = (-f * 2) % 16; x < W; x += 16) c.fillRect(x, 92, 8, 1);
    const cx = ((f * 1.6) % (W + 40)) - 30;
    c.fillStyle = '#ff5fa2'; c.fillRect(cx, 84, 26, 6); c.fillRect(cx + 6, 80, 14, 4); c.fillStyle = '#9fe8ff'; c.fillRect(cx + 8, 81, 10, 3);
    c.fillStyle = '#ffe28a'; c.fillRect(cx + 26, 86, 3, 2);
    if (on < 1) { c.fillStyle = `rgba(255,255,255,${1 - on})`; c.fillRect(0, 0, W, H); }
    this.tvTex.needsUpdate = true;
  }

  update(f: number) {
    const [px, py, pz, tx, ty, tz, fov] = camAt(f);
    this.camera.position.set(px, py, pz); this.camera.lookAt(tx, ty, tz); this.camera.fov = fov; this.camera.updateProjectionMatrix();
    this.clip.constant = 1.0 - 0.88 * cutAt(f);
    // disc: waits, rollers pull it in, CLACK, spindle spins it up
    const ins = ease((f - 14) / (CLACK - 14));
    this.disc.position.z = 2.15 - 1.6 * ins;
    this.rollers.forEach((r, i) => { r.rotation.y = (i ? 1 : -1) * ins * 30; });
    const t = Math.max(0, f - CLACK), spin = t < 40 ? 0.004 * t * t : 6.4 + (t - 40) * 0.32;
    this.disc.rotation.x = -spin;
    const read = clamp((f - S.laser) / (S.install + 60 - S.laser));
    this.sled.position.y = 0.42 - read * 0.24;
    this.worm.rotation.y = 0;
    const on = f > CLACK + 30 && f < S.install + 80;
    const blink = sixteenth(f, S.laser) % 2 === 0 || (f % 5) < 3;
    this.beam.visible = on && blink;
    (this.lens.material as THREE.MeshToonMaterial).emissive.setRGB(on ? 0.3 : 0, on ? 0.4 : 0, on ? 1 : 0);
    this.fan.rotation.x = -f * (f < S.cool ? 0.12 : 0.4);
    // glows
    const em = (m: THREE.Mesh, r: number, g: number, b: number) => (m.material as THREE.MeshToonMaterial).emissive.setRGB(r, g, b);
    const fl = clamp((f - S.install - 10) / 120);
    this.ssd.forEach((m, i) => { const e = f >= S.install ? clamp(fl * 12 - i) * 0.6 : 0; em(m, 0.05 * e, 0.35 * e, 0.8 * e); });
    const pulse = f >= S.decomp && f < S.ram ? Math.exp(-((f - S.decomp) % 5) / 2) : 0;
    em(this.decomp, pulse * 0.9, pulse * 0.6, pulse * 0.1);
    const rf = clamp((f - S.ram - 20) / 110);
    this.ram.forEach((m, i) => { const e = clamp(rf * 8 - i) * (0.35 + 0.15 * Math.sin(f * 0.3 + i)); em(m, 0.9 * e, 0.45 * e, 0.1 * e); });
    const core = f >= S.cpu && f < S.gpu ? sixteenth(f, S.cpu) % 8 : -1;
    this.cpu.forEach((m, i) => { const age = core < 0 ? 99 : ((core - i + 8) % 8) * 5 + ((f - S.cpu) % 5); const e = Math.exp(-age / 7) + (f >= S.cpu && f < S.cool ? 0.15 : 0); em(m, 0.2 * e, 0.6 * e, 1.0 * e); });
    this.gpu.forEach((m, i) => {
      const r = Math.floor(i / 6), c = i % 6, wave = (f - S.gpu) / 3 - (r + c);
      const e = f >= S.gpu && f < S.cool + 40 ? clamp(1 - Math.abs((((wave % 12) + 12) % 12) - 1) / 2) + 0.15 : 0;
      em(m, 1.0 * e, 0.35 * e, 0.6 * e);
    });
    const heat = f >= S.cool && f < SINK + 20 ? (0.4 + 0.3 * Math.sin(f * 0.5)) * clamp((f - S.cool) / 20) * (1 - clamp((f - SINK) / 20)) : 0;
    em(this.die, heat, heat * 0.2, 0);
    const lq = ease((f - LIQUID) / 16);
    this.liquid.scale.set(1, Math.max(0.001, lq), Math.max(0.001, lq));
    this.liquid.visible = f >= LIQUID && f < S.outro;
    this.sink.position.x = f < S.cool ? 1.6 : 1.6 * (1 - ease((f - (SINK - 40)) / 40));
    this.sink.visible = f >= S.cool;
    this.drawTV(f, clamp((f - S.tv) / 10));
    const d = new THREE.Object3D();
    let i = 0;
    for (const fw of this.flows) {
      const act = Math.min(clamp((f - fw.from) / 10), clamp((fw.to - f) / 10));
      for (let k = 0; k < fw.n; k++) {
        const tt = (((k / fw.n + (f - fw.from) * fw.speed) % 1) + 1) % 1;
        fw.curve.getPoint(tt, d.position);
        d.scale.setScalar(act > 0 ? act * (fw.s0 + (fw.s1 - fw.s0) * tt) : 0.0001);
        d.rotation.set(f * 0.1 + k, f * 0.07, 0);
        d.updateMatrix();
        this.bits.setMatrixAt(i++, d.matrix);
      }
    }
    this.bits.instanceMatrix.needsUpdate = true;
  }

  project(name: string): [number, number, boolean] {
    const v = new THREE.Vector3();
    this.pts[name].getWorldPosition(v);
    v.project(this.camera);
    return [((v.x + 1) / 2) * 360, ((1 - v.y) / 2) * 640, v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2];
  }
  render(f: number) {
    this.update(f);
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
