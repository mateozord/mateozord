import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {S, KPOP, BAGPOPS, clamp, ease} from './timeline';
import {drawText} from './font';

export const RW = 270, RH = 480;
THREE.ColorManagement.enabled = false;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const K = 20, M = 40, B = 60; // macro sets: kernel, myth block, bag cross-section
const TAU = Math.PI * 2;

type Key = number[]; // [frame, px, py, pz, tx, ty, tz, fov]
const GROUPS: Key[][] = [
  [[0, K + 0.3, 1.25, 3.9, K, 1, 0, 36], [60, K + 0.2, 1.1, 3.2, K, 1, 0, 34]],
  [[60, 3.5, 2.6, 8.5, -0.1, 1.1, 0, 36], [150, 1.4, 1.5, 4.2, -0.5, 1.15, 1.1, 30], [240, 2.0, 1.6, 5.4, 0.2, 1.1, 0.6, 32],
    [300, 1.7, 1.3, 3.0, 1.05, 0.6, 0.1, 30], [420, 1.25, 0.95, 2.6, 1.05, 0.55, -0.1, 30], [520, 1.6, 1.15, 2.8, 1.05, 0.6, -0.3, 30],
    [560, 1.3, 1.8, 2.2, 1.05, 1.45, -0.3, 28], [680, 1.0, 1.75, 1.9, 1.05, 1.45, -0.3, 26], [770, 1.3, 1.8, 2.3, 0.85, 1.5, -0.3, 28],
    [820, 1.2, 1.8, 2.6, 0.75, 1.55, -0.3, 30], [900, 0.4, 1.6, 4.6, -0.45, 1.1, 0, 34], [1010, -0.2, 1.5, 4.4, -0.45, 1.1, 0, 34],
    [1060, 0.2, 2.9, 4.6, -0.45, 0.6, 0, 36], [1180, -0.4, 3.4, 3.4, -0.45, 0.5, 0, 34], [1260, -0.45, 2.0, 3.0, -0.45, 0.7, 0.1, 30]],
  [[1260, B + 0.3, 1.8, 5.6, B, 0.5, 0, 36], [1380, B - 0.6, 1.2, 3.8, B, 0.4, 0, 32], [1500, B + 0.5, 1.0, 3.4, B, 0.4, 0, 30]],
  [[1500, K + 0.6, 1.4, 3.8, K, 1, 0, 36], [1620, K + 0.25, 1.1, 2.2, K, 1, 0.15, 30], [1740, K + 0.4, 1.3, 2.7, K, 1, 0, 34], [1820, K + 0.5, 1.4, 3.8, K, 1, 0, 36]],
  [[1820, B + 0.4, 1.4, 5.0, B, 0.7, 0, 36], [2000, B - 0.4, 2.0, 6.2, B, 0.9, 0, 38]],
  [[2000, 2.2, 1.6, 5.0, 1.1, 1.3, 1.1, 30], [2060, 2.6, 1.9, 6.5, 0.6, 1.3, 0.6, 34]],
  [[2060, M + 1.8, 1.8, 4.4, M, 0.9, 0, 36], [2300, M - 0.8, 1.8, 4.6, M, 0.9, 0, 36]],
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
export const runningAt = (f: number) => f >= 180 && f < S.ding + 26;

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
  c = mix(c, vec3(0.045, 0.05, 0.12), e * 0.9);
  c = floor(c * 20.0 + bayer(gl_FragCoord.xy)) / 20.0;
  gl_FragColor = vec4(c, 1.0);
}`;
const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.minFilter = t.magFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
};
// a box that inflates like a pillow (popcorn bag)
class Pillow {
  geo: THREE.BufferGeometry; base: Float32Array; hw: number; hd: number;
  constructor(w: number, h: number, d: number) {
    this.geo = new THREE.BoxGeometry(w, h, d, 18, 4, 12);
    this.base = Float32Array.from(this.geo.attributes.position.array as Float32Array);
    this.hw = w / 2; this.hd = d / 2;
  }
  set(inflate: number, lift: number) {
    const p = this.geo.attributes.position.array as Float32Array;
    for (let i = 0; i < p.length; i += 3) {
      const x = this.base[i], y = this.base[i + 1], z = this.base[i + 2];
      const nx = x / this.hw, nz = z / this.hd, bulge = Math.max(0, (1 - nx * nx) * (1 - nz * nz));
      p[i] = x * (1 - 0.06 * inflate * (1 - Math.abs(nz)));
      p[i + 1] = y + Math.sign(y) * inflate * lift * Math.sqrt(bulge);
      p[i + 2] = z * (1 - 0.1 * inflate * (1 - Math.abs(nx)));
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

export class MicroScene {
  renderer: THREE.WebGLRenderer;
  rt: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, RW / RH, 0.1, 80);
  postScene = new THREE.Scene();
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  clipFront = new THREE.Plane(new THREE.Vector3(0, 0, -1), 10);
  clipMag = new THREE.Plane(new THREE.Vector3(0, 0, -1), 10);
  clipKernel = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
  clipBag = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
  grad: THREE.DataTexture;
  plate = new THREE.Group();
  bag!: Pillow;
  fan = new THREE.Group();
  electrons!: THREE.InstancedMesh;
  cathode!: THREE.Mesh;
  fronts!: THREE.InstancedMesh;
  ribbon!: THREE.InstancedMesh;
  hotCanvas = document.createElement('canvas');
  hotTex: THREE.CanvasTexture;
  dispCanvas = document.createElement('canvas');
  dispTex: THREE.CanvasTexture;
  lamp!: THREE.PointLight;
  bulb!: THREE.Mesh;
  kernel = new THREE.Group();
  endoCap!: THREE.Mesh;
  bigPop = new THREE.Group();
  hulls!: THREE.InstancedMesh;
  molO!: THREE.InstancedMesh;
  molH!: THREE.InstancedMesh;
  molSeed: number[][] = [];
  steam!: THREE.InstancedMesh;
  bagBig!: Pillow;
  susceptor!: THREE.Mesh;
  kernels: THREE.Group[] = [];
  pops: THREE.Group[] = [];
  kernelSeed: number[][] = [];
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
    this.grad = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 4, 1);
    this.grad.minFilter = this.grad.magFilter = THREE.NearestFilter;
    this.grad.needsUpdate = true;
    const mk = (cv: HTMLCanvasElement, w: number, h: number) => { cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.minFilter = t.magFilter = THREE.NearestFilter; return t; };
    this.hotTex = mk(this.hotCanvas, 64, 64);
    this.dispTex = mk(this.dispCanvas, 48, 16);
    this.blockTex = mk(this.blockCanvas, 96, 64);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: POST_VS, fragmentShader: POST_FS,
      uniforms: {tColor: {value: this.rt.texture}, tDepth: {value: this.rt.depthTexture}, res: {value: new THREE.Vector2(RW, RH)}, cNear: {value: 0.1}, cFar: {value: 80}},
    })));
    this.build();
  }
  mat(c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) { return new THREE.MeshToonMaterial({color: c, gradientMap: this.grad, ...o}); }
  rbox(s: number[], p: number[], m: THREE.Material | THREE.Material[], parent: THREE.Object3D = this.scene, r = 0.04) {
    const x = new THREE.Mesh(new RoundedBoxGeometry(s[0], s[1], s[2], 2, Math.min(r, Math.min(...s) / 2.2)), m); x.position.set(p[0], p[1], p[2]); parent.add(x); return x;
  }
  box(s: number[], p: number[], m: THREE.Material, parent: THREE.Object3D = this.scene) {
    const x = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), m); x.position.set(p[0], p[1], p[2]); parent.add(x); return x;
  }
  cyl(r: number, h: number, p: number[], m: THREE.Material, axis: 'x' | 'y' | 'z', parent: THREE.Object3D = this.scene, seg = 20) {
    const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); x.position.set(p[0], p[1], p[2]);
    if (axis === 'x') x.rotation.z = Math.PI / 2; if (axis === 'z') x.rotation.x = Math.PI / 2;
    parent.add(x); return x;
  }
  wire(pts: number[][], color: string, r = 0.012) {
    const c = new THREE.CatmullRomCurve3(pts.map((q) => V(q[0], q[1], q[2])));
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 40, r, 5), this.mat(color)); this.scene.add(m); return m;
  }
  point(name: string, p: number[], parent: THREE.Object3D = this.scene) { const o = new THREE.Object3D(); o.position.set(p[0], p[1], p[2]); parent.add(o); this.pts[name] = o; }
  kernelMesh(scale: number, parent: THREE.Object3D, m?: THREE.Material) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(scale, 14, 10), m ?? this.mat('#e8a032')); body.scale.set(1, 0.75, 1.15); g.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(scale * 0.55, scale * 0.8, 10), this.mat('#c97a22')); tip.rotation.x = -Math.PI / 2; tip.position.z = -scale * 1.2; g.add(tip);
    parent.add(g); return g;
  }
  popcornMesh(scale: number, parent: THREE.Object3D, seed: number) {
    const g = new THREE.Group();
    let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 8; i++) {
      const a = r() * TAU, b = r() * Math.PI - Math.PI / 2, d = scale * (0.4 + r() * 0.5);
      const m = new THREE.Mesh(new THREE.SphereGeometry(scale * (0.45 + r() * 0.3), 10, 8), this.mat(i % 4 ? '#fff6e2' : '#f6e0a8'));
      m.position.set(Math.cos(a) * Math.cos(b) * d, Math.sin(b) * d, Math.sin(a) * Math.cos(b) * d); g.add(m);
    }
    const h = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.5, scale * 0.12, scale * 0.4), this.mat('#c97a22')); h.position.set(0, -scale * 0.6, scale * 0.3); h.rotation.set(0.4, 0.3, 0); g.add(h);
    parent.add(g); return g;
  }

  build() {
    const sc = this.scene, Z = Math.PI / 2;
    sc.background = new THREE.Color('#1a1f3d');
    sc.fog = new THREE.Fog('#1a1f3d', 10, 24);
    sc.add(new THREE.AmbientLight('#8890c0', 0.6));
    const key = new THREE.DirectionalLight('#fff3dc', 1.3); key.position.set(4, 6, 5); sc.add(key);
    const rim = new THREE.DirectionalLight('#7fa0ff', 0.7); rim.position.set(-4, 3, -4); sc.add(rim);
    const cf = (c: string, side: THREE.Side = THREE.FrontSide) => this.mat(c, {clippingPlanes: [this.clipFront], side});
    for (const x of [0, K, M, B]) { const fl = new THREE.Mesh(new THREE.CircleGeometry(12, 40), this.mat('#151a36')); fl.rotation.x = -Z; fl.position.x = x; sc.add(fl); }
    // counter top under the microwave
    this.rbox([4.4, 0.12, 3.0], [0, -0.06, 0.1], this.mat('#3a3256'), sc, 0.05);
    // ---- microwave body (rounded shell, cut open from the front) ----
    this.rbox([3.2, 1.8, 2.2], [0, 1.1, 0], cf('#e8e9f0', THREE.DoubleSide), sc, 0.12);
    const cav = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 2.0), cf('#b9bfdc', THREE.BackSide)); cav.position.set(-0.45, 1.1, 0); sc.add(cav);
    for (let i = 0; i < 6; i++) this.box([0.3, 0.012, 0.04], [-1.0 + i * 0.22, 1.845, -0.4], this.mat('#4a527e')); // ceiling vents
    this.box([0.04, 1.6, 2.1], [0.6, 1.1, 0], cf('#9aa0c8', THREE.DoubleSide));
    for (const [x, z] of [[-1.35, 0.85], [1.35, 0.85], [-1.35, -0.85], [1.35, -0.85]]) this.cyl(0.09, 0.2, [x, 0.1, z], this.mat('#2b2e44'), 'y');
    for (let i = 0; i < 8; i++) this.box([0.7, 0.02, 0.03], [1.1, 1.4 + i * 0.05, -1.11], cf('#2b2e44'));
    // door: rounded frame, gasket, mesh window, handle on standoffs
    const meshTex = canvasTex(64, 48, (c) => { c.fillStyle = '#1c2140'; c.fillRect(0, 0, 64, 48); c.fillStyle = '#4a527e'; for (let y = 1; y < 48; y += 3) for (let x = (y % 2) + 1; x < 64; x += 3) c.fillRect(x, y, 1, 1); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(6, 0, 4, 48); c.fillRect(14, 0, 2, 48); });
    this.rbox([2.15, 1.7, 0.08], [-0.45, 1.1, 1.14], cf('#2b2e44'), sc, 0.06);
    this.rbox([1.65, 1.15, 0.03], [-0.55, 1.12, 1.18], cf('#11121c'), sc, 0.04);
    const winM = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.05), new THREE.MeshBasicMaterial({map: meshTex, clippingPlanes: [this.clipFront]})); winM.position.set(-0.55, 1.12, 1.197); sc.add(winM);
    this.rbox([0.07, 1.2, 0.07], [0.43, 1.1, 1.3], cf('#c9d0f4'), sc, 0.03);
    for (const y of [0.55, 1.65]) this.box([0.05, 0.05, 0.12], [0.43, y, 1.22], cf('#9aa0c8'));
    this.point('door', [-0.9, 1.4, 1.2]);
    // control panel
    this.rbox([0.95, 1.7, 0.06], [1.1, 1.1, 1.13], cf('#1c1f33'), sc, 0.03);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.24), new THREE.MeshBasicMaterial({map: this.dispTex, clippingPlanes: [this.clipFront]})); disp.position.set(1.1, 1.72, 1.165); sc.add(disp);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) this.rbox([0.18, 0.12, 0.04], [0.88 + c * 0.22, 1.42 - r * 0.17, 1.17], cf(r === 3 && c === 2 ? '#3ec9a7' : '#4a527e'), sc, 0.02);
    this.point('display', [1.1, 1.72, 1.17]);
    // lamp
    this.bulb = this.cyl(0.08, 0.03, [-0.45, 1.84, 0.3], this.mat('#fff3c0', {emissive: new THREE.Color('#000000')}), 'y');
    this.lamp = new THREE.PointLight('#ffdc9a', 0, 4); this.lamp.position.set(-0.45, 1.65, 0.4); sc.add(this.lamp);
    // turntable: roller ring with wheels, coupler, glass plate with rim
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 32), this.mat('#4a527e')); ring.rotation.x = Z; ring.position.set(-0.45, 0.39, 0); sc.add(ring);
    this.plate.position.set(-0.45, 0.43, 0); sc.add(this.plate);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; this.cyl(0.04, 0.03, [Math.cos(a) * 0.45, -0.03, Math.sin(a) * 0.45], this.mat('#2b2e44'), 'x', this.plate, 10); }
    this.cyl(0.07, 0.06, [0, -0.03, 0], this.mat('#2b2e44'), 'y', this.plate, 6);
    this.cyl(0.78, 0.03, [0, 0, 0], this.mat('#cfeaff', {transparent: true, opacity: 0.8}), 'y', this.plate, 48);
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.025, 6, 48), this.mat('#e8f6ff')); rimT.rotation.x = Z; rimT.position.y = 0.015; this.plate.add(rimT);
    this.point('plate', [0.7, 0.03, 0.3], this.plate);
    // popcorn bag (inflates)
    const bagTex = canvasTex(128, 64, (c) => {
      for (let x = 0; x < 128; x += 12) { c.fillStyle = (x / 12) % 2 ? '#ffffff' : '#e8333f'; c.fillRect(x, 0, 12, 64); }
      c.fillStyle = '#fff6e2'; c.fillRect(14, 18, 100, 28); c.fillStyle = '#e8333f'; c.fillRect(14, 18, 100, 2); c.fillRect(14, 44, 100, 2);
      drawText(c, 'PIPOCA', 64, 25, 2, '#e8333f', {align: 'center', bold: true});
    });
    this.bag = new Pillow(0.8, 0.06, 0.55);
    const bagM = new THREE.Mesh(this.bag.geo, this.mat('#ffffff', {map: bagTex})); bagM.position.set(0.05, 0.06, 0.05); this.plate.add(bagM);
    this.point('bag', [0.05, 0.12, 0.05], this.plate);
    // hot spots
    const hot = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.9), new THREE.MeshBasicMaterial({map: this.hotTex, transparent: true, depthWrite: false}));
    hot.rotation.x = -Z; hot.position.set(-0.45, 0.47, 0); sc.add(hot);
    this.point('hotspot', [-0.95, 0.47, 0.45]);
    // ---- transformer (laminated E-core + wound coils), capacitor, diode, wires, fan ----
    const coilTex = canvasTex(16, 32, (c) => { for (let y = 0; y < 32; y += 2) { c.fillStyle = y % 4 ? '#e0803a' : '#b85a22'; c.fillRect(0, y, 16, 2); } });
    for (let i = 0; i < 12; i++) this.box([0.5, 0.38, 0.02], [1.05, 0.55, -0.08 + i * 0.022], this.mat(i % 2 ? '#8e9ad8' : '#6b74a8'));
    for (const x of [0.9, 1.2]) this.rbox([0.16, 0.26, 0.4], [x, 0.55, 0.05], this.mat('#ffffff', {map: coilTex}), sc, 0.04);
    this.point('transf', [1.05, 0.75, 0.25]);
    this.cyl(0.11, 0.42, [1.15, 0.45, -0.62], this.mat('#c9d0f4'), 'x');
    for (const x of [0.92, 1.38]) this.cyl(0.03, 0.05, [x, 0.45, -0.62], this.mat('#4a527e'), 'x');
    this.point('cap', [1.15, 0.57, -0.62]);
    this.cyl(0.025, 0.14, [0.82, 0.8, -0.35], this.mat('#11121c'), 'x'); this.cyl(0.026, 0.02, [0.78, 0.8, -0.35], this.mat('#e8ecff'), 'x');
    this.point('diode', [0.82, 0.83, -0.35]);
    this.wire([[1.2, 0.7, 0.1], [1.3, 0.9, -0.2], [1.38, 0.5, -0.62]], '#e8333f');
    this.wire([[0.92, 0.45, -0.62], [0.85, 0.7, -0.5], [0.82, 0.8, -0.35]], '#11121c');
    this.wire([[0.75, 0.8, -0.35], [0.7, 1.05, -0.3], [0.9, 1.2, -0.3]], '#e8333f');
    this.fan.position.set(1.05, 1.4, -0.92); sc.add(this.fan);
    this.cyl(0.33, 0.03, [0, 0, 0], this.mat('#2b2e44'), 'z', this.fan, 24);
    for (let k = 0; k < 7; k++) { const g = new THREE.Group(); g.rotation.z = (k / 7) * TAU; const b = this.rbox([0.09, 0.22, 0.015], [0, 0.15, 0.03], this.mat('#8e9ad8'), g, 0.007); b.rotation.y = 0.4; this.fan.add(g); }
    // ---- magnetron ----
    const mg = new THREE.Group(); mg.position.set(1.05, 1.45, -0.3); sc.add(mg);
    const cm = (c: string) => this.mat(c, {clippingPlanes: [this.clipMag], side: THREE.DoubleSide});
    for (let i = 0; i < 7; i++) this.rbox([0.62, 0.022, 0.62], [0, -0.16 + i * 0.055, 0], cm('#c9d0f4'), mg, 0.01);
    this.cyl(0.21, 0.42, [0, 0, 0], cm('#e0a83a'), 'y', mg, 28);
    for (const y of [-0.27, 0.27]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 10, 28), cm('#4a527e')); r.rotation.x = Z; r.position.y = y; mg.add(r); }
    for (let k = 0; k < 8; k++) { const g = new THREE.Group(); g.rotation.y = (k / 8) * TAU; this.box([0.09, 0.38, 0.022], [0.15, 0, 0], this.mat('#ff9a5c'), g); mg.add(g); }
    this.cathode = this.cyl(0.022, 0.44, [0, 0, 0], this.mat('#ffb36b', {emissive: new THREE.Color('#000000')}), 'y', mg, 10);
    this.cyl(0.03, 0.25, [-0.36, 0.12, 0], this.mat('#e8ecff'), 'x', mg, 10);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), this.mat('#e8ecff')); dome.position.set(-0.5, 0.12, 0); mg.add(dome);
    this.electrons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.013, 6, 4), new THREE.MeshBasicMaterial({color: '#7fe6ff'}), 60); mg.add(this.electrons);
    this.point('magnets', [0.12, 0.3, 0.12], mg); this.point('cathode', [0, 0.1, 0], mg); this.point('antenna', [-0.48, 0.14, 0], mg);
    // waveguide + mica
    this.rbox([0.3, 0.42, 0.6], [0.76, 1.55, -0.3], this.mat('#9aa0c8', {clippingPlanes: [this.clipFront]}), sc, 0.03);
    this.box([0.01, 0.36, 0.5], [0.585, 1.55, -0.3], this.mat('#d9c39a'));
    this.point('guide', [0.8, 1.76, -0.05]); this.point('mica', [0.58, 1.55, -0.1]);
    // microwaves: wave fronts + a standing-wave ribbon (nodes = cold, antinodes = hot)
    this.fronts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 1.0, 1.4), new THREE.MeshBasicMaterial({color: '#7fe6ff', transparent: true, opacity: 0.35, depthWrite: false}), 8); sc.add(this.fronts);
    this.ribbon = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({color: '#bff4ff'}), 70); sc.add(this.ribbon);
    this.point('ribbon', [-0.75, 1.3, 0]);
    // ---- macro: big kernel with a clean cut face ----
    this.kernel.position.set(K, 1, 0); sc.add(this.kernel);
    const ck = (c: string) => this.mat(c, {clippingPlanes: [this.clipKernel], side: THREE.DoubleSide});
    const SX = 0.95, SY = 1.15;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), ck('#d98a2b')); shell.scale.set(SX, SY, 0.85); this.kernel.add(shell);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 20), ck('#a8601a')); tip.position.y = -1.18; tip.rotation.x = Math.PI; this.kernel.add(tip);
    const capShell = new THREE.Mesh(new THREE.CircleGeometry(1, 48), this.mat('#e8952e')); capShell.scale.set(SX, SY, 1); capShell.position.z = 0.001; this.kernel.add(capShell);
    const starch = canvasTex(64, 64, (c) => { c.fillStyle = '#f6e7b8'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < 64; x += 6) { c.fillStyle = '#e9d59c'; c.fillRect(x, y, 5, 5); c.fillStyle = '#fff4cf'; c.fillRect(x, y, 2, 2); } });
    this.endoCap = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), this.mat('#ffffff', {map: starch})); this.endoCap.scale.set(SX, SY, 1); this.endoCap.position.z = 0.003; this.kernel.add(this.endoCap);
    const germ = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), this.mat('#f2c84b')); germ.scale.set(0.8, 1.4, 1); germ.position.set(0.15, -0.55, 0.005); this.kernel.add(germ);
    this.point('shell', [0.82, 0.55, 0.0], this.kernel); this.point('water', [-0.3, 0.2, 0.15], this.kernel); this.point('steam', [0.1, 0.1, 0.2], this.kernel);
    this.molO = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), this.mat('#ff4a5a'), 30);
    this.molH = new THREE.InstancedMesh(new THREE.SphereGeometry(0.038, 8, 6), this.mat('#ffffff'), 60);
    this.kernel.add(this.molO, this.molH);
    let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 30; i++) { const a = rnd() * TAU, r = 0.15 + Math.sqrt(rnd()) * 0.6; this.molSeed.push([Math.cos(a) * r * SX, Math.sin(a) * r * SY + 0.1, 0.1, rnd() * TAU]); }
    this.steam = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.65}), 14); this.kernel.add(this.steam);
    this.bigPop.position.set(K, 1, 0); sc.add(this.bigPop);
    for (let i = 0; i < 18; i++) { const a = rnd() * TAU, b = rnd() * Math.PI - Z, r = 0.45 + rnd() * 0.45; const s = new THREE.Mesh(new THREE.SphereGeometry(0.4 + rnd() * 0.25, 16, 12), this.mat(i % 5 ? '#fff6e2' : '#f6e0a8')); s.position.set(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r * 0.7); this.bigPop.add(s); }
    this.hulls = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.035, 0.14), this.mat('#c97a22'), 14); this.hulls.position.set(K, 1, 0); sc.add(this.hulls);
    // ---- macro: popcorn bag cross-section ----
    const bagG = new THREE.Group(); bagG.position.set(B, 0.3, 0); sc.add(bagG);
    const bagSide = canvasTex(64, 64, (c) => { for (let x = 0; x < 64; x += 8) { c.fillStyle = (x / 8) % 2 ? '#ffffff' : '#e8333f'; c.fillRect(x, 0, 8, 64); } });
    this.bagBig = new Pillow(3.0, 0.4, 2.0);
    const bigM = new THREE.Mesh(this.bagBig.geo, this.mat('#ffffff', {map: bagSide, clippingPlanes: [this.clipBag], side: THREE.DoubleSide})); bagG.add(bigM);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.02), this.mat('#f2e2c0')); inner.position.set(0, -0.19, 0); bagG.add(inner);
    this.susceptor = this.rbox([1.7, 0.02, 1.3], [0, -0.18, -0.2], this.mat('#9aa6c8', {emissive: new THREE.Color('#000000')}), bagG, 0.01);
    const oil = this.rbox([1.6, 0.07, 1.2], [0, -0.13, -0.2], this.mat('#ffd23f', {transparent: true, opacity: 0.55}), bagG, 0.03);
    oil.renderOrder = 2;
    for (let i = 0; i < 22; i++) this.box([0.025, 0.025, 0.025], [-0.7 + rnd() * 1.4, -0.09, -0.75 + rnd() * 1.1], this.mat('#ffffff'), bagG);
    for (let i = 0; i < 18; i++) {
      const x = -0.65 + (i % 6) * 0.26 + (rnd() - 0.5) * 0.06, z = -0.65 + Math.floor(i / 6) * 0.26 + (rnd() - 0.5) * 0.06;
      const k = this.kernelMesh(0.075, bagG); k.position.set(x, -0.07, z); k.rotation.y = rnd() * TAU;
      const p = this.popcornMesh(0.17, bagG, 100 + i); p.visible = false;
      this.kernels.push(k); this.pops.push(p); this.kernelSeed.push([x, z, rnd(), rnd()]);
    }
    this.point('susceptor', [0.6, -0.18, 0.1], bagG); this.point('oil', [-0.4, -0.12, 0.0], bagG); this.point('kern', [-0.39, -0.05, -0.39], bagG); this.point('popped', [0.1, 0.4, -0.2], bagG);
    // ---- macro: myth block ----
    this.block = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.3, 1.3, 2, 0.08), [this.mat('#c96a3a'), this.mat('#c96a3a'), this.mat('#d98a4a'), this.mat('#a85a30'), new THREE.MeshBasicMaterial({map: this.blockTex}), this.mat('#c96a3a')]);
    this.block.position.set(M, 0.95, 0); sc.add(this.block);
    this.cyl(1.6, 0.06, [M, 0.27, 0], this.mat('#e8e9f0'), 'y', sc, 48);
    this.rays = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.03, 0.03), new THREE.MeshBasicMaterial({color: '#7fe6ff'}), 18); sc.add(this.rays);
    this.point('edge', [M - 0.95, 1.45, 0.66]); this.point('center', [M, 0.95, 0.66]);
  }

  drawDisplay(f: number) {
    const c = this.dispCanvas.getContext('2d')!;
    c.fillStyle = '#0a1a14'; c.fillRect(0, 0, 48, 16);
    let txt = '';
    if (f < 150) txt = '12:00';
    else if (f < 180) txt = f % 10 < 6 ? '3:00' : '';
    else if (f < S.ding) { const s = Math.max(1, 180 - Math.floor((f - 180) / 10)); txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    else if (f < S.ding + 26) txt = `0:0${Math.max(0, 3 - Math.floor((f - S.ding) / 8))}`;
    else txt = f % 12 < 8 ? 'END' : '';
    drawText(c, txt, 24, 5, 1, '#5dffb0', {align: 'center'});
    this.dispTex.needsUpdate = true;
  }
  drawHot(f: number, a: number) {
    const c = this.hotCanvas.getContext('2d')!;
    c.clearRect(0, 0, 64, 64);
    if (a > 0) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = 8 + i * 16, y = 8 + j * 16, p = 0.65 + 0.35 * Math.sin(f * 0.31 + (i + j) * 1.7);
      for (let r = 7; r > 0; r--) { c.fillStyle = `rgba(255,${Math.round(60 + r * 18)},40,${(a * p * (8 - r)) / 18})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    }
    this.hotTex.needsUpdate = true;
  }
  drawBlock(f: number) {
    const c = this.blockCanvas.getContext('2d')!, d = 3 + 9 * ease((f - S.outro - 30) / 70), heat = clamp((f - S.outro - 150) / 70);
    c.fillStyle = '#3a6ad0'; c.fillRect(0, 0, 96, 64);
    const ring = (o: number, col: string) => { c.fillStyle = col; c.fillRect(o, o, 96 - 2 * o, 64 - 2 * o); };
    ring(0, '#ff4a3a'); ring(Math.round(d * 0.5), '#ff8a3d'); ring(Math.round(d), '#ffd23f');
    ring(Math.round(d + 4), `rgb(${Math.round(58 + 180 * heat)},${Math.round(106 + 40 * heat)},${Math.round(208 - 120 * heat)})`);
    this.blockTex.needsUpdate = true;
  }

  update(f: number) {
    const [px, py, pz, tx, ty, tz, fov] = camAt(f);
    this.camera.position.set(px, py, pz); this.camera.lookAt(tx, ty, tz); this.camera.fov = fov; this.camera.updateProjectionMatrix();
    this.clipFront.constant = 10 - 9.05 * win(f, 276, 1300, 26);
    this.clipMag.constant = 10 - 10.3 * win(f, 556, 790, 18);
    const run = runningAt(f);
    (this.bulb.material as THREE.MeshToonMaterial).emissive.setRGB(run ? 1 : 0, run ? 0.85 : 0, run ? 0.5 : 0);
    this.lamp.intensity = run ? 1.3 : 0;
    this.plate.rotation.y = -clamp(f - 180, 0, S.ding + 26 - 180) * 0.018;
    this.fan.rotation.z = run ? f * 0.5 : 0;
    this.drawDisplay(f);
    this.drawHot(f, win(f, S.plate, S.bag, 16) + 0.5 * win(f, S.wave + 140, S.plate, 16));
    this.bag.set(f >= S.ding - 10 ? 1 : 0, 0.22);
    const d = new THREE.Object3D();
    // magnetron electrons: 4 rotating curved spokes
    const showE = f >= S.mag + 20 && f < S.wave + 20;
    for (let i = 0; i < 60; i++) {
      const spoke = i % 4, r = 0.03 + Math.floor(i / 4) * 0.0075, a = (spoke / 4) * TAU + f * 0.1 + r * 10;
      d.position.set(Math.cos(a) * r, 0.0, Math.sin(a) * r); d.rotation.set(0, 0, 0);
      d.scale.setScalar(showE ? 1 : 0.0001); d.updateMatrix(); this.electrons.setMatrixAt(i, d.matrix);
    }
    this.electrons.instanceMatrix.needsUpdate = true;
    const glow = f >= S.mag && f < S.wave + 20 ? 1 : run ? 0.3 : 0;
    (this.cathode.material as THREE.MeshToonMaterial).emissive.setRGB(glow, glow * 0.5, glow * 0.15);
    // wave fronts: leave the mica window (x 0.55) and travel to the far wall (x -1.45), every 8th note
    const wOn = win(f, S.wave, S.bag, 20);
    for (let i = 0; i < 8; i++) {
      const age = (f - S.wave - i * 10 + 800) % 80, t = age / 80;
      d.position.set(0.55 - t * 1.95, 1.15, 0); d.rotation.set(0, 0, 0);
      d.scale.setScalar(wOn > 0 && f >= S.wave + i * 10 ? 1 : 0.0001); d.updateMatrix(); this.fronts.setMatrixAt(i, d.matrix);
    }
    this.fronts.instanceMatrix.needsUpdate = true;
    (this.fronts.material as THREE.MeshBasicMaterial).opacity = 0.3 * wOn * (1 - win(f, S.plate - 40, S.bag, 20) * 0.6);
    const rOn = win(f, S.wave + 150, S.bag, 20);
    for (let i = 0; i < 70; i++) {
      const x = -1.45 + (i / 69) * 2.0, amp = 0.3 * Math.sin(((x + 1.45) / 2.0) * Math.PI * 4) * Math.cos(f * 0.31);
      d.position.set(x, 1.15 + amp, 0); d.rotation.set(0, 0, 0); d.scale.setScalar(rOn > 0.02 ? rOn : 0.0001); d.updateMatrix(); this.ribbon.setMatrixAt(i, d.matrix);
    }
    this.ribbon.instanceMatrix.needsUpdate = true;
    // ---- big kernel ----
    const popped = KPOP.find((p) => f >= p && f < p + 60);
    const kWin = f < S.door || (f >= S.kernel && f < S.popping);
    this.kernel.visible = kWin && popped === undefined;
    this.bigPop.visible = this.hulls.visible = kWin && popped !== undefined;
    if (popped !== undefined) {
      const t = f - popped, s = t < 6 ? (t / 6) * 1.3 : 1.3 - 0.3 * ease((t - 6) / 10);
      this.bigPop.scale.setScalar(Math.max(0.05, s)); this.bigPop.rotation.y = t * 0.01;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        d.position.set(Math.cos(a) * (0.6 + t * 0.1), Math.sin(a * 1.7) * 0.5 + t * 0.04 - t * t * 0.003, Math.sin(a) * (0.4 + t * 0.07));
        d.rotation.set(t * 0.3 + i, t * 0.2, i); d.scale.setScalar(1); d.updateMatrix(); this.hulls.setMatrixAt(i, d.matrix);
      }
      this.hulls.instanceMatrix.needsUpdate = true;
    }
    const temp = f < S.door ? clamp(f / 40) : clamp((f - S.kernel) / 260);
    (this.endoCap.material as THREE.MeshToonMaterial).color.setRGB(1, 1 - 0.2 * temp, 1 - 0.45 * temp);
    const t0 = f < S.door ? 0 : S.kernel, flips = Math.floor((f - t0) / 10), within = ((f - t0) % 10) / 10;
    const from = flips % 2 ? Math.PI : 0, to = flips % 2 ? 0 : Math.PI, ang = from + (to - from) * ease(Math.min(1, within * 1.8));
    this.molSeed.forEach(([x, y, z, ph], i) => {
      const jit = 0.1 + temp * 0.5, a = ang + Math.sin(f * 0.9 + ph * 5) * jit, jx = Math.sin(f * 1.3 + ph) * 0.018 * temp, jy = Math.cos(f * 1.1 + ph) * 0.018 * temp;
      d.rotation.set(0, 0, 0); d.scale.setScalar(1);
      d.position.set(x + jx, y + jy, z); d.updateMatrix(); this.molO.setMatrixAt(i, d.matrix);
      for (let h = 0; h < 2; h++) { const ha = a + (h ? 0.91 : -0.91); d.position.set(x + jx + Math.cos(ha) * 0.08, y + jy + Math.sin(ha) * 0.08, z); d.updateMatrix(); this.molH.setMatrixAt(i * 2 + h, d.matrix); }
    });
    this.molO.instanceMatrix.needsUpdate = true; this.molH.instanceMatrix.needsUpdate = true;
    const steamAmt = f >= S.kernel + 170 ? clamp((f - S.kernel - 170) / 100) : 0;
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 0.2 + (i % 4) * 0.12;
      d.position.set(Math.cos(a) * r, Math.sin(a) * r * 1.1 + 0.1, 0.12); d.rotation.set(0, 0, 0);
      d.scale.setScalar(steamAmt > 0 ? (0.6 + steamAmt * (0.6 + (i % 3) * 0.25)) * (1 + 0.08 * Math.sin(f * 0.6 + i)) : 0.0001); d.updateMatrix(); this.steam.setMatrixAt(i, d.matrix);
    }
    this.steam.instanceMatrix.needsUpdate = true;
    this.kernel.scale.setScalar(1 + 0.03 * steamAmt * (0.5 + 0.5 * Math.sin(f * 0.8)));
    // ---- bag cross-section ----
    const heatB = f >= S.bag + 100 ? 0.4 + 0.25 * Math.sin(f * 0.4) : 0;
    (this.susceptor.material as THREE.MeshToonMaterial).emissive.setRGB(heatB, heatB * 0.35, 0);
    const inflate = f < S.popping ? 0 : ease((f - S.popping - 10) / 150);
    this.bagBig.set(inflate, 1.2);
    this.kernels.forEach((k, i) => {
      const [x, z] = this.kernelSeed[i], pt = i < BAGPOPS.length ? BAGPOPS[(i * 7) % BAGPOPS.length] : 1e9;
      const shake = f >= S.popping && f < pt ? Math.sin(f * 2.3 + i) * 0.01 : 0;
      k.visible = !(f >= S.popping && f >= pt);
      k.position.set(x + shake, -0.07, z);
      const p = this.pops[i]; p.visible = f >= S.popping && f >= pt;
      if (p.visible) {
        const t = f - pt, s = t < 5 ? (t / 5) * 1.25 : 1.25 - 0.25 * ease((t - 5) / 8);
        const land = [x * 0.8, 0.05 + (i % 3) * 0.14 + inflate * 0.25, z * 0.7], fly = clamp(t / 18);
        p.position.set(x + (land[0] - x) * fly, -0.05 + (land[1] + 0.05) * fly + Math.sin(fly * Math.PI) * 0.7, z + (land[2] - z) * fly);
        p.scale.setScalar(s); p.rotation.set(t * 0.2 * (1 - fly) + i, i, 0);
      }
    });
    // ---- myth set ----
    this.drawBlock(f);
    for (let i = 0; i < 18; i++) {
      const side = i % 3, lane = Math.floor(i / 3), t = (((f - S.outro) * 0.022 + lane * 0.17) % 1 + 1) % 1, depth = 0.22 * t;
      if (side === 0) d.position.set(M - 1.5 + depth * 2.0, 0.55 + lane * 0.13, 0.7);
      else if (side === 1) d.position.set(M + 1.5 - depth * 2.0, 0.55 + lane * 0.13, 0.7);
      else d.position.set(M - 0.8 + lane * 0.32, 1.95 - depth * 1.6, 0.7);
      d.rotation.set(0, 0, side === 2 ? Z90 : 0); d.scale.setScalar(f >= S.outro ? 1 - t * 0.7 : 0.0001); d.updateMatrix(); this.rays.setMatrixAt(i, d.matrix);
    }
    this.rays.instanceMatrix.needsUpdate = true;
  }

  project(name: string): [number, number, boolean] {
    const v = new THREE.Vector3();
    this.pts[name].getWorldPosition(v);
    v.project(this.camera);
    return [((v.x + 1) / 2) * 360, ((1 - v.y) / 2) * 640, v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05];
  }
  render(f: number) {
    this.update(f);
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
const Z90 = Math.PI / 2;
