import * as THREE from 'three';
import {S, POPS, FORK, clamp, ease, sixteenth} from './timeline';
import {drawText} from './font';

export const RW = 270, RH = 480;
THREE.ColorManagement.enabled = false;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const K = 20, M = 40; // x offsets of the macro sets (kernel, myth block)

// camera groups (no interpolation across groups = hard cut)
type Key = number[]; // [frame, px, py, pz, tx, ty, tz, fov]
const GROUPS: Key[][] = [
  [[0, K + 0.5, 1.3, 3.6, K, 1, 0, 36], [60, K + 0.3, 1.15, 2.9, K, 1, 0, 34]],
  [[60, 3.5, 2.6, 8.5, -0.1, 1.1, 0, 36], [130, 1.6, 1.6, 4.5, -0.5, 1.15, 1.1, 30], [220, 1.7, 1.3, 3.0, 1.05, 0.6, 0.1, 30], [300, 1.25, 0.95, 2.6, 1.05, 0.55, -0.1, 30],
    [380, 1.3, 2.5, 2.0, 1.05, 1.45, -0.3, 28], [460, 1.0, 2.4, 1.7, 1.05, 1.45, -0.3, 26], [540, 1.2, 2.0, 2.6, 0.75, 1.55, -0.3, 30], [620, 1.2, 2.4, 4.6, 0.0, 1.2, -0.2, 34],
    [700, 0.2, 2.9, 5.0, -0.45, 0.8, 0, 36], [780, -0.4, 3.4, 3.6, -0.45, 0.5, 0, 34], [860, -0.45, 2.0, 3.2, -0.45, 0.8, 0.2, 30]],
  [[860, K + 0.6, 1.4, 3.6, K, 1, 0, 36], [960, K + 0.25, 1.1, 2.1, K, 1, 0.2, 30], [1060, K + 0.4, 1.3, 2.6, K, 1, 0, 34], [1100, K + 0.8, 1.6, 4.2, K, 1, 0, 38]],
  [[1100, 0.6, 1.6, 3.6, -0.15, 0.6, 0.3, 32], [1180, -0.2, 1.4, 3.0, -0.15, 0.55, 0.3, 28], [1260, 2.6, 1.9, 7.0, 0, 1.1, 0, 36], [1340, 2.2, 1.6, 5.0, 1.1, 1.3, 1.1, 30], [1420, 3.0, 2.2, 8.0, 0, 1.1, 0, 36]],
  [[1420, M + 1.8, 1.8, 4.4, M, 0.9, 0, 36], [1580, M - 0.8, 1.8, 4.6, M, 0.9, 0, 36]],
];
function camAt(f: number) {
  let g = GROUPS[0];
  for (const gr of GROUPS) if (f >= gr[0][0]) g = gr;
  let i = 0;
  while (i < g.length - 2 && f >= g[i + 1][0]) i++;
  const k0 = g[Math.max(0, i - 1)], k1 = g[i], k2 = g[Math.min(i + 1, g.length - 1)], k3 = g[Math.min(g.length - 1, i + 2)];
  const t = k2[0] === k1[0] ? 0 : clamp((f - k1[0]) / (k2[0] - k1[0]));
  const out: number[] = [];
  for (let j = 1; j < 8; j++) {
    const p0 = k0[j], p1 = k1[j], p2 = k2[j], p3 = k3[j];
    out.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t));
  }
  return out;
}
const win = (f: number, a: number, b: number, r = 20) => Math.min(ease((f - a) / r), 1 - ease((f - b) / r));
export const runningAt = (f: number) => f >= 180 && f < 1400;

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
const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.minFilter = t.magFilter = THREE.NearestFilter; return t;
};

export class MicroScene {
  renderer: THREE.WebGLRenderer;
  rt: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, RW / RH, 0.1, 60);
  postScene = new THREE.Scene();
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  clipFront = new THREE.Plane(new THREE.Vector3(0, 0, -1), 10);
  clipMag = new THREE.Plane(new THREE.Vector3(0, 0, -1), 10);
  clipKernel = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.05);
  grad: THREE.DataTexture;
  plate = new THREE.Group();
  bag!: THREE.Mesh;
  fork = new THREE.Group();
  fan = new THREE.Group();
  electrons!: THREE.InstancedMesh;
  cathode!: THREE.Mesh;
  waves!: THREE.InstancedMesh;
  hot!: THREE.Mesh;
  hotCanvas = document.createElement('canvas');
  hotTex: THREE.CanvasTexture;
  disp!: THREE.Mesh;
  dispCanvas = document.createElement('canvas');
  dispTex: THREE.CanvasTexture;
  lamp!: THREE.PointLight;
  bulb!: THREE.Mesh;
  kernel = new THREE.Group();
  endo!: THREE.Mesh;
  popcorn = new THREE.Group();
  hulls!: THREE.InstancedMesh;
  molO!: THREE.InstancedMesh;
  molH!: THREE.InstancedMesh;
  molSeed: number[][] = [];
  field!: THREE.InstancedMesh;
  steam!: THREE.InstancedMesh;
  sparks!: THREE.InstancedMesh;
  block!: THREE.Mesh;
  blockCanvas = document.createElement('canvas');
  blockTex: THREE.CanvasTexture;
  rays!: THREE.InstancedMesh;
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
    const mk = (cv: HTMLCanvasElement, w: number, h: number) => { cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.minFilter = t.magFilter = THREE.NearestFilter; return t; };
    this.hotTex = mk(this.hotCanvas, 64, 64);
    this.dispTex = mk(this.dispCanvas, 48, 16);
    this.blockTex = mk(this.blockCanvas, 96, 64);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: POST_VS, fragmentShader: POST_FS,
      uniforms: {tColor: {value: this.rt.texture}, tDepth: {value: this.rt.depthTexture}, res: {value: new THREE.Vector2(RW, RH)}, cNear: {value: 0.1}, cFar: {value: 60}},
    })));
    this.build();
  }
  mat(c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) { return new THREE.MeshToonMaterial({color: c, gradientMap: this.grad, ...o}); }
  box(s: number[], p: number[], m: THREE.Material, parent: THREE.Object3D = this.scene) {
    const x = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), m); x.position.set(p[0], p[1], p[2]); parent.add(x); return x;
  }
  cyl(r: number, h: number, p: number[], m: THREE.Material, axis: 'x' | 'y' | 'z', parent: THREE.Object3D = this.scene, seg = 20) {
    const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); x.position.set(p[0], p[1], p[2]);
    if (axis === 'x') x.rotation.z = Math.PI / 2; if (axis === 'z') x.rotation.x = Math.PI / 2;
    parent.add(x); return x;
  }
  point(name: string, p: number[], parent: THREE.Object3D = this.scene) { const o = new THREE.Object3D(); o.position.set(p[0], p[1], p[2]); parent.add(o); this.pts[name] = o; }

  build() {
    const sc = this.scene, Z = Math.PI / 2;
    sc.background = new THREE.Color('#1a1f3d');
    sc.fog = new THREE.Fog('#1a1f3d', 10, 24);
    sc.add(new THREE.AmbientLight('#8890c0', 0.6));
    const key = new THREE.DirectionalLight('#fff3dc', 1.3); key.position.set(4, 6, 5); sc.add(key);
    const rim = new THREE.DirectionalLight('#7fa0ff', 0.6); rim.position.set(-4, 3, -4); sc.add(rim);
    const cf = (c: string, side: THREE.Side = THREE.DoubleSide) => this.mat(c, {clippingPlanes: [this.clipFront], side});
    for (const x of [0, K, M]) { const fl = new THREE.Mesh(new THREE.CircleGeometry(12, 40), this.mat('#151a36')); fl.rotation.x = -Z; fl.position.x = x; sc.add(fl); }
    // ---- microwave body ----
    this.box([3.2, 1.8, 2.2], [0, 1.1, 0], cf('#e8e9f0'));
    this.box([2.1, 1.5, 2.0], [-0.45, 1.1, 0], cf('#b9bfdc', THREE.BackSide));
    this.box([0.04, 1.6, 2.1], [0.6, 1.1, 0], cf('#9aa0c8'));
    for (const [x, z] of [[-1.4, 0.9], [1.4, 0.9], [-1.4, -0.9], [1.4, -0.9]]) this.cyl(0.08, 0.2, [x, 0.1, z], this.mat('#2b2e44'), 'y');
    for (let i = 0; i < 8; i++) this.box([0.7, 0.02, 0.04], [1.1, 1.4 + i * 0.05, -1.11], cf('#2b2e44')); // rear vent
    // door: frame + window with metal mesh + handle
    const mesh = canvasTex(64, 48, (c) => { c.fillStyle = '#1c2140'; c.fillRect(0, 0, 64, 48); c.fillStyle = '#4a527e'; for (let y = 1; y < 48; y += 3) for (let x = (y % 2) + 1; x < 64; x += 3) c.fillRect(x, y, 1, 1); });
    this.box([2.15, 1.7, 0.08], [-0.45, 1.1, 1.14], cf('#2b2e44'));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.05), new THREE.MeshBasicMaterial({map: mesh, clippingPlanes: [this.clipFront]})); win.position.set(-0.55, 1.12, 1.185); sc.add(win);
    this.box([0.08, 1.2, 0.08], [0.45, 1.1, 1.24], cf('#c9d0f4'));
    this.point('door', [-0.9, 1.4, 1.19]);
    // control panel: display + keypad
    this.box([0.95, 1.7, 0.06], [1.1, 1.1, 1.13], cf('#1c1f33'));
    this.disp = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.24), new THREE.MeshBasicMaterial({map: this.dispTex, clippingPlanes: [this.clipFront]})); this.disp.position.set(1.1, 1.72, 1.165); sc.add(this.disp);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) this.box([0.18, 0.12, 0.04], [0.88 + c * 0.22, 1.42 - r * 0.17, 1.17], cf(r === 3 && c === 2 ? '#3ec9a7' : '#4a527e'));
    this.point('keypad', [1.32, 0.91, 1.19]); this.point('display', [1.1, 1.72, 1.17]);
    // cavity lamp
    this.bulb = this.cyl(0.07, 0.04, [-0.45, 1.84, 0.3], this.mat('#fff3c0', {emissive: new THREE.Color('#000000')}), 'y');
    this.lamp = new THREE.PointLight('#ffdc9a', 0, 4); this.lamp.position.set(-0.45, 1.7, 0.4); sc.add(this.lamp);
    // turntable + plate + popcorn bag + fork
    this.cyl(0.55, 0.03, [-0.45, 0.37, 0], this.mat('#4a527e'), 'y', sc, 24);
    this.plate.position.set(-0.45, 0.42, 0); sc.add(this.plate);
    this.cyl(0.78, 0.04, [0, 0, 0], this.mat('#bfe4ff', {transparent: true, opacity: 0.85}), 'y', this.plate, 40);
    const bagTex = canvasTex(64, 32, (c) => {
      for (let x = 0; x < 64; x += 8) { c.fillStyle = (x / 8) % 2 ? '#ffffff' : '#e8333f'; c.fillRect(x, 0, 8, 32); }
      c.fillStyle = '#fff6e2'; c.fillRect(6, 9, 52, 14);
      drawText(c, 'PIPOCA', 32, 12, 1, '#e8333f', {align: 'center', bold: true});
    });
    this.bag = this.box([0.75, 0.14, 0.5], [0.1, 0.09, 0.05], this.mat('#ffffff', {map: bagTex}), this.plate);
    this.point('bag', [0.1, 0.18, 0.05], this.plate);
    this.fork.position.set(-0.4, 0.04, 0.35); this.fork.rotation.y = 0.5; this.plate.add(this.fork);
    const steel = this.mat('#e8ecff');
    this.box([0.04, 0.02, 0.4], [0, 0, 0.1], steel, this.fork);
    for (let i = 0; i < 4; i++) this.box([0.012, 0.015, 0.16], [-0.03 + i * 0.02, 0, -0.17], steel, this.fork);
    this.point('fork', [0, 0.02, -0.25], this.fork);
    // hot-spot overlay on the cavity floor
    this.hot = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.9), new THREE.MeshBasicMaterial({map: this.hotTex, transparent: true, depthWrite: false}));
    this.hot.rotation.x = -Z; this.hot.position.set(-0.45, 0.47, 0); sc.add(this.hot);
    // ---- transformer, capacitor, diode, fan ----
    const cm = (c: string) => this.mat(c, {clippingPlanes: [this.clipFront]});
    for (let i = 0; i < 10; i++) this.box([0.5, 0.36, 0.022], [1.05, 0.55, 0.0 + i * 0.024], this.mat(i % 2 ? '#8e9ad8' : '#6b74a8'));
    for (const x of [0.9, 1.2]) this.box([0.16, 0.24, 0.36], [x, 0.55, 0.11], this.mat('#e0803a'));
    this.point('transf', [1.05, 0.72, 0.3]);
    this.cyl(0.11, 0.42, [1.15, 0.45, -0.6], this.mat('#c9d0f4'), 'x');
    this.point('cap', [1.15, 0.56, -0.6]);
    this.cyl(0.03, 0.14, [0.85, 0.75, -0.35], this.mat('#11121c'), 'x');
    this.point('diode', [0.85, 0.78, -0.35]);
    this.fan.position.set(1.05, 1.4, -0.9); this.scene.add(this.fan);
    this.cyl(0.32, 0.03, [0, 0, 0], this.mat('#2b2e44'), 'z', this.fan, 24);
    for (let k = 0; k < 7; k++) { const g = new THREE.Group(); g.rotation.z = (k / 7) * Math.PI * 2; const b = this.box([0.08, 0.22, 0.02], [0, 0.15, 0.03], this.mat('#8e9ad8'), g); b.rotation.y = 0.4; this.fan.add(g); }
    // ---- magnetron (cut open in its own section) ----
    const mg = new THREE.Group(); mg.position.set(1.05, 1.45, -0.3); sc.add(mg);
    const cmM = (c: string) => this.mat(c, {clippingPlanes: [this.clipMag], side: THREE.DoubleSide});
    for (let i = 0; i < 7; i++) this.box([0.62, 0.025, 0.62], [0, -0.16 + i * 0.055, 0], cmM('#c9d0f4'), mg); // cooling fins
    this.cyl(0.22, 0.42, [0, 0, 0], cmM('#e0a83a'), 'y', mg, 24); // anode block (copper)
    for (const y of [-0.27, 0.27]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 24), cmM('#4a527e')); r.rotation.x = Z; r.position.y = y; mg.add(r); }
    for (let k = 0; k < 8; k++) { const g = new THREE.Group(); g.rotation.y = (k / 8) * Math.PI * 2; this.box([0.1, 0.4, 0.025], [0.15, 0, 0], cmM('#ff9a5c'), g); mg.add(g); }
    this.cathode = this.cyl(0.025, 0.44, [0, 0, 0], this.mat('#ffb36b', {emissive: new THREE.Color('#000000')}), 'y', mg, 10);
    this.cyl(0.03, 0.25, [-0.38, 0.12, 0], this.mat('#e8ecff'), 'x', mg, 10); // antenna into the waveguide
    this.electrons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshBasicMaterial({color: '#7fe6ff'}), 48); mg.add(this.electrons);
    this.point('magnets', [0, 0.3, 0.12], mg); this.point('cathode', [0, 0.05, 0], mg); this.point('mag', [0.2, 0.2, 0.25], mg); this.point('antenna', [-0.42, 0.12, 0], mg);
    // waveguide + mica window
    this.box([0.3, 0.42, 0.6], [0.76, 1.55, -0.3], cm('#9aa0c8'));
    this.box([0.01, 0.36, 0.5], [0.585, 1.55, -0.3], this.mat('#d9c39a'));
    this.point('guide', [0.76, 1.78, -0.1]); this.point('mica', [0.58, 1.55, -0.05]);
    // microwaves: glowing bars
    this.waves = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.36, 0.5), new THREE.MeshBasicMaterial({color: '#7fe6ff', transparent: true, opacity: 0.75, depthWrite: false}), 12);
    sc.add(this.waves);
    // sparks (fork)
    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshBasicMaterial({color: '#bff4ff'}), 60); sc.add(this.sparks);
    // ---- macro set 1: popcorn kernel with water molecules ----
    this.kernel.position.set(K, 1, 0); sc.add(this.kernel);
    const ck = (c: string) => this.mat(c, {clippingPlanes: [this.clipKernel], side: THREE.DoubleSide});
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), ck('#d98a2b')); shell.scale.set(0.95, 1.15, 0.85); this.kernel.add(shell);
    this.endo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 40, 28), ck('#f6e7b8')); this.endo.scale.set(0.95, 1.15, 0.85); this.kernel.add(this.endo);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 16), ck('#a8601a')); tip.position.y = -1.15; tip.rotation.x = Math.PI; this.kernel.add(tip);
    this.point('shell', [0.7, 0.75, 0.0], this.kernel); this.point('water', [-0.25, 0.1, 0.2], this.kernel);
    this.molO = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), this.mat('#ff4a5a'), 34);
    this.molH = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), this.mat('#ffffff'), 68);
    this.kernel.add(this.molO, this.molH);
    let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 34; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.72; this.molSeed.push([Math.cos(a) * r * 0.95, Math.sin(a) * r * 1.15, 0.12 + rnd() * 0.12, rnd() * Math.PI * 2]); }
    this.field = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 2.6, 0.03), new THREE.MeshBasicMaterial({color: '#7fe6ff', transparent: true, opacity: 0.6, depthWrite: false}), 6);
    this.kernel.add(this.field);
    this.steam = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.8}), 24); this.kernel.add(this.steam);
    this.popcorn.position.set(K, 1, 0); sc.add(this.popcorn);
    for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, b = rnd() * Math.PI - Z, r = 0.45 + rnd() * 0.45; const s = new THREE.Mesh(new THREE.SphereGeometry(0.42 + rnd() * 0.25, 14, 10), this.mat(i % 5 ? '#fff6e2' : '#f6e0a8')); s.position.set(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r * 0.7); this.popcorn.add(s); }
    this.hulls = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.04, 0.12), this.mat('#c97a22'), 14); this.hulls.position.set(K, 1, 0); sc.add(this.hulls);
    // ---- macro set 2: myth block (microwaves only go ~1-2 cm deep) ----
    this.block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.3), [this.mat('#c96a3a'), this.mat('#c96a3a'), this.mat('#d98a4a'), this.mat('#a85a30'), new THREE.MeshBasicMaterial({map: this.blockTex}), this.mat('#c96a3a')]);
    this.block.position.set(M, 0.95, 0); sc.add(this.block);
    this.cyl(1.6, 0.06, [M, 0.27, 0], this.mat('#e8e9f0'), 'y', sc, 40);
    this.rays = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.03, 0.03), new THREE.MeshBasicMaterial({color: '#7fe6ff'}), 18); sc.add(this.rays);
    this.point('edge', [M - 1.0, 1.4, 0.66]); this.point('center', [M, 0.95, 0.66]);
  }

  drawDisplay(f: number) {
    const c = this.dispCanvas.getContext('2d')!;
    c.fillStyle = '#0a1a14'; c.fillRect(0, 0, 48, 16);
    let txt = '';
    if (f < 150) txt = '12:00';
    else if (f < 180) txt = f % 10 < 6 ? '1:30' : '';
    else if (f < 1360) { const s = Math.max(0, 90 - Math.floor((f - 180) / 13)); txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    else if (f < 1380) txt = `0:0${Math.max(0, 3 - Math.floor((f - 1360) / 7))}`;
    else txt = f % 12 < 8 ? 'END' : '';
    drawText(c, txt, 24, 5, 1, '#5dffb0', {align: 'center'});
    this.dispTex.needsUpdate = true;
  }
  drawHot(f: number, a: number) {
    const c = this.hotCanvas.getContext('2d')!;
    c.clearRect(0, 0, 64, 64);
    if (a <= 0) { this.hotTex.needsUpdate = true; return; }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = 8 + i * 16, y = 8 + j * 16, p = 0.6 + 0.4 * Math.sin(f * 0.31 + (i + j) * 1.7);
      for (let r = 7; r > 0; r--) { c.fillStyle = `rgba(255,${Math.round(60 + r * 18)},40,${(a * p * (8 - r)) / 18})`; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    }
    this.hotTex.needsUpdate = true;
  }
  drawBlock(f: number) {
    const c = this.blockCanvas.getContext('2d')!, d = 3 + 9 * ease((f - S.outro - 20) / 60), heat = clamp((f - S.outro - 80) / 60);
    c.fillStyle = '#3a6ad0'; c.fillRect(0, 0, 96, 64);
    const ring = (o: number, col: string) => { c.fillStyle = col; c.fillRect(o, o, 96 - 2 * o, 64 - 2 * o); };
    ring(0, '#ff4a3a'); ring(Math.round(d * 0.5), '#ff8a3d'); ring(Math.round(d), '#ffd23f'); ring(Math.round(d + 4), heat > 0 ? `rgb(${Math.round(58 + 180 * heat)},${Math.round(106 + 40 * heat)},${Math.round(208 - 120 * heat)})` : '#3a6ad0');
    this.blockTex.needsUpdate = true;
  }

  update(f: number) {
    const [px, py, pz, tx, ty, tz, fov] = camAt(f);
    this.camera.position.set(px, py, pz); this.camera.lookAt(tx, ty, tz); this.camera.fov = fov; this.camera.updateProjectionMatrix();
    this.clipFront.constant = 10 - 9.05 * win(f, 190, 1290, 26);
    this.clipMag.constant = 10 - 10.3 * win(f, 396, 548, 18);
    const run = runningAt(f);
    (this.bulb.material as THREE.MeshToonMaterial).emissive.setRGB(run ? 1 : 0, run ? 0.85 : 0, run ? 0.5 : 0);
    this.lamp.intensity = run ? 1.2 : 0;
    this.plate.rotation.y = -Math.max(0, f - 180) * 0.02 * (f < 1400 ? 1 : 0) - (f >= 1400 ? (1400 - 180) * 0.02 : 0);
    this.fan.rotation.z = run ? f * 0.5 : 0;
    this.drawDisplay(f);
    this.drawHot(f, win(f, S.plate, S.mol, 16) + 0.4 * win(f, S.wave + 60, S.plate, 16));
    // bag inflates while popping
    const inflate = ease((f - S.pop) / 110);
    const bump = f >= S.pop && f < S.pop + 120 ? Math.exp(-((f - S.pop) % 10) / 3) * 0.06 : 0;
    this.bag.scale.set(1 + 0.05 * inflate, 1 + 2.2 * inflate + bump * 4, 1 + 0.15 * inflate);
    this.bag.position.y = 0.09 + 0.15 * inflate;
    this.fork.visible = f >= FORK && f < S.pop;
    // magnetron electrons: 4 rotating spokes
    const d = new THREE.Object3D();
    const showE = f >= S.mag + 10 && f < S.wave + 20;
    for (let i = 0; i < 48; i++) {
      const spoke = i % 4, r = 0.035 + Math.floor(i / 4) * 0.011, a = (spoke / 4) * Math.PI * 2 + f * 0.12 + r * 9;
      d.position.set(Math.cos(a) * r, -0.12 + (i % 3) * 0.12, Math.sin(a) * r);
      d.scale.setScalar(showE ? 1 : 0.0001); d.updateMatrix(); this.electrons.setMatrixAt(i, d.matrix);
    }
    this.electrons.instanceMatrix.needsUpdate = true;
    const glow = f >= S.mag && f < S.wave + 20 ? 1 : run ? 0.3 : 0;
    (this.cathode.material as THREE.MeshToonMaterial).emissive.setRGB(glow, glow * 0.5, glow * 0.15);
    // microwaves: launched every 8th note, guide (x 0.95->0.6) then bounce around the cavity
    const wOn = win(f, S.mag + 120, S.mol, 16);
    for (let i = 0; i < 12; i++) {
      const age = ((f - S.mag) - i * 10) % 120, t = age / 120;
      let x: number, y = 1.55, z = -0.3, sy = 1, sz = 1, ry = 0;
      if (t < 0.15) { x = 0.92 - (t / 0.15) * 0.32; }
      else { const u = (t - 0.15) / 0.85, tri = 1 - Math.abs(((u * 2) % 2) - 1); x = 0.55 - tri * 1.95; y = 1.55 - u * 0.9; z = -0.3 + Math.sin(u * 6 + i) * 0.5; sy = 1.6; sz = 2.6; ry = 0; }
      d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.set(1, sy, sz);
      if (wOn <= 0 || age < 0) d.scale.setScalar(0.0001);
      d.updateMatrix(); this.waves.setMatrixAt(i, d.matrix);
    }
    this.waves.instanceMatrix.needsUpdate = true;
    (this.waves.material as THREE.MeshBasicMaterial).opacity = 0.75 * wOn;
    // fork sparks on 16th notes
    const sparkOn = f >= FORK + 20 && f < S.pop - 10;
    const fp = new THREE.Vector3(); this.pts.fork.getWorldPosition(fp);
    for (let i = 0; i < 60; i++) {
      const k = sixteenth(f, FORK), chain = i % 12, burst = Math.floor(i / 12), age = (f - FORK) % 5;
      let s = 0.0001;
      if (sparkOn && age < 3 && (k + burst) % 3 !== 0) {
        const a = burst * 1.3 + k * 0.7, h = (n: number) => Math.sin(n * 91.7 + k * 13.1) * 0.5;
        d.position.set(fp.x + Math.cos(a) * chain * 0.03 + h(i) * 0.03, fp.y + chain * 0.025, fp.z + Math.sin(a) * chain * 0.03 + h(i + 7) * 0.03);
        s = 1.2 - chain * 0.06;
      }
      d.scale.setScalar(s); d.rotation.set(0, 0, 0); d.updateMatrix(); this.sparks.setMatrixAt(i, d.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    // ---- kernel set ----
    const popped = POPS.find((p) => f >= p && f < p + 40);
    const molWin = f < S.door || (f >= S.mol && f < S.metal);
    this.kernel.visible = popped === undefined && molWin;
    this.popcorn.visible = popped !== undefined;
    this.hulls.visible = popped !== undefined;
    if (popped !== undefined) {
      const t = f - popped, s = t < 6 ? (t / 6) * 1.25 : 1.25 - 0.25 * ease((t - 6) / 8);
      this.popcorn.scale.setScalar(Math.max(0.05, s));
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        d.position.set(Math.cos(a) * (0.6 + t * 0.12), Math.sin(a * 1.7) * 0.5 + t * 0.05 - t * t * 0.004, Math.sin(a) * (0.4 + t * 0.08));
        d.rotation.set(t * 0.3 + i, t * 0.2, i); d.scale.setScalar(1); d.updateMatrix(); this.hulls.setMatrixAt(i, d.matrix);
      }
      this.hulls.instanceMatrix.needsUpdate = true;
    }
    const temp = f < S.door ? f / 40 : clamp((f - S.mol) / 220);
    (this.endo.material as THREE.MeshToonMaterial).color.setRGB(0.96, 0.9 - 0.25 * temp, 0.72 - 0.45 * temp);
    // field flips every 8th note; molecules follow quickly + thermal jitter
    const flips = Math.floor((f - (f < S.door ? 0 : S.mol)) / 10), within = ((f - (f < S.door ? 0 : S.mol)) % 10) / 10;
    const dir = (flips % 2 ? 1 : -1) * (1 - 2 * ease(Math.min(1, within * 1.6)) * 0) ;
    const target = dir > 0 ? 0 : Math.PI, prev = dir > 0 ? Math.PI : 0;
    const ang = prev + (target - prev) * ease(Math.min(1, within * 1.8));
    this.molSeed.forEach(([x, y, z, ph], i) => {
      const jit = 0.15 + temp * 0.6, a = ang + Math.sin(f * 0.9 + ph * 5) * jit, jx = Math.sin(f * 1.3 + ph) * 0.02 * temp;
      d.rotation.set(0, 0, 0); d.scale.setScalar(1);
      d.position.set(x + jx, y + Math.cos(f * 1.1 + ph) * 0.02 * temp, z); d.updateMatrix(); this.molO.setMatrixAt(i, d.matrix);
      for (let h = 0; h < 2; h++) {
        const ha = a + (h ? 0.91 : -0.91);
        d.position.set(x + jx + Math.cos(ha) * 0.09, y + Math.sin(ha) * 0.09, z); d.updateMatrix(); this.molH.setMatrixAt(i * 2 + h, d.matrix);
      }
    });
    this.molO.instanceMatrix.needsUpdate = true; this.molH.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 6; i++) {
      const xx = -1.2 + ((((f * 0.05 * dir) + i * 0.45) % 2.7) + 2.7) % 2.7;
      d.position.set(xx, 0, 0.3); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); this.field.setMatrixAt(i, d.matrix);
    }
    this.field.instanceMatrix.needsUpdate = true;
    const steamOn = f >= 1040 && f < S.metal;
    for (let i = 0; i < 24; i++) {
      const age = ((f - 1040) + i * 7) % 40;
      d.position.set(Math.sin(i * 2.1) * 0.5, -0.4 + age * 0.03, 0.3 + (i % 3) * 0.05); d.scale.setScalar(steamOn ? 0.6 + age * 0.03 : 0.0001); d.updateMatrix(); this.steam.setMatrixAt(i, d.matrix);
    }
    this.steam.instanceMatrix.needsUpdate = true;
    // ---- myth set ----
    this.drawBlock(f);
    for (let i = 0; i < 18; i++) {
      const side = i % 3, lane = Math.floor(i / 3), t = (((f - S.outro) * 0.025 + lane * 0.17) % 1 + 1) % 1, depth = 0.25 * t;
      if (side === 0) d.position.set(M - 1.5 + depth * 2.0, 0.6 + lane * 0.12, 0.7);
      else if (side === 1) d.position.set(M + 1.5 - depth * 2.0, 0.6 + lane * 0.12, 0.7);
      else d.position.set(M - 0.8 + lane * 0.3, 1.9 - depth * 1.5, 0.7);
      d.rotation.set(0, 0, side === 2 ? Math.PI / 2 : 0); d.scale.setScalar(f >= S.outro ? 1 - t * 0.6 : 0.0001); d.updateMatrix(); this.rays.setMatrixAt(i, d.matrix);
    }
    this.rays.instanceMatrix.needsUpdate = true;
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
export {V};
