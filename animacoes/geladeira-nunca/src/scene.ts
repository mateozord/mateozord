import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  TOTAL, SHOTS, LABS, CLICKS, DOOR_SHUT, clamp, smooth, speed, sceneTime, lr, integ, shotAt, motorLevel, heatAt, potScale, shallowScale,
  doorOpen, frostAt, blockAt, wallNear, wallVisible, freezeAt, crackAt,
} from './timeline';

export const RW = 270, RH = 480;
THREE.ColorManagement.enabled = false;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const P = 20; // macro set: freezer with the glass bottle
const TAU = Math.PI * 2;

type Key = number[]; // [px, py, pz, tx, ty, tz, fov]
// one entry per shot in timeline.json (same order): camera eases from a to b during the shot; next shot = cut
const HOOK: Key = [6.3, 1.8, -0.6, 0, 1.5, -0.3, 36];
const CAMS: Record<string, [Key, Key]> = {
  'hook': [HOOK, [5.3, 1.7, -0.5, 0, 1.45, -0.3, 36]],
  'i-comp': [[1.5, 0.75, -1.9, 0.1, 0.4, -1.0, 30], [1.1, 0.62, -1.6, 0.1, 0.4, -1.0, 28]],
  'i-cond': [[1.8, 1.6, -3.2, 0, 1.6, -0.8, 34], [1.2, 1.9, -2.6, 0, 1.9, -0.8, 34]],
  'i-evap': [[2.4, 2.7, 0.6, 0, 2.7, -0.5, 30], [1.8, 2.75, 0.2, 0, 2.75, -0.5, 28]],
  'e1-pot': [[3.2, 1.8, 1.6, 0.1, 1.5, 0, 32], [2.6, 1.6, 1.2, 0.15, 1.45, 0, 30]],
  'e1-thermo': [[0.95, 2.62, 0.62, -0.65, 2.55, 0.25, 30], [0.55, 2.58, 0.45, -0.65, 2.55, 0.25, 30]],
  'e1-comp': [[0.6, 0.6, -1.55, 0.1, 0.42, -1.0, 26], [0.5, 0.55, -1.45, 0.1, 0.42, -1.0, 24]],
  'e1-cond': [[2.6, 1.2, -3.0, 0, 1.4, -0.8, 34], [1.6, 1.0, -2.4, 0, 1.2, -0.8, 32]],
  'e1-fix': [[1.7, 1.7, 0.9, 0.15, 1.3, 0.05, 28], [1.4, 1.6, 0.7, 0.15, 1.3, 0.05, 26]],
  'e1-wide': [[4.2, 2.0, -2.6, 0, 1.5, -0.4, 34], [3.8, 1.8, -2.0, 0, 1.4, -0.4, 34]],
  'e2-door': [[0.6, 1.9, 6.2, 0, 1.7, 0, 34], [0.3, 1.9, 5.0, 0, 1.75, 0, 34]],
  'e2-air': [[3.8, 1.6, 2.4, 0, 1.6, 0.4, 34], [3.3, 1.7, 2.0, 0, 1.7, 0.4, 34]],
  'e2-frost': [[1.8, 2.75, 0.4, 0, 2.75, -0.5, 28], [1.3, 2.8, 0.1, 0, 2.75, -0.5, 26]],
  'e2-fan': [[0.4, 2.7, 1.6, 0, 2.9, -0.3, 30], [0.2, 2.85, 1.0, 0, 2.95, -0.3, 28]],
  'e2-comp': [[0.6, 0.62, -1.5, 0.1, 0.42, -1.0, 26], [0.7, 0.66, -1.4, 0.1, 0.42, -1.0, 26]],
  'e2-seal': [[2.8, 2.5, 2.8, 0.3, 1.6, 0.6, 34], [2.4, 2.3, 2.4, 0.4, 1.6, 0.6, 32]],
  'e3-fill': [[3.6, 1.9, 1.3, 0, 1.7, 0, 34], [3.2, 1.9, 0.9, 0, 1.7, 0, 34]],
  'e3-fan': [[1.7, 2.5, 1.0, 0, 2.9, -0.3, 30], [1.5, 2.6, 0.8, 0, 2.92, -0.3, 30]],
  'e3-stuck': [[3.4, 2.2, 0.2, 0, 2.0, -0.1, 32], [2.9, 2.3, 0.0, 0, 2.0, -0.1, 32]],
  'e3-hot': [[2.6, 0.55, 1.6, 0.2, 0.65, 0.1, 30], [2.3, 0.6, 1.4, 0.2, 0.65, 0.1, 30]],
  'e3-fix': [[3.6, 1.9, 1.0, 0, 1.7, -0.1, 34], [4.0, 2.0, 1.4, 0, 1.7, -0.1, 34]],
  'e4-wall': [[5.2, 1.8, -0.9, 0, 1.6, -0.9, 36], [4.8, 1.8, -1.0, 0, 1.6, -1.0, 36]],
  'e4-cond': [[2.4, 1.4, -0.2, 0, 1.6, -1.0, 30], [2.0, 1.6, -0.3, 0, 1.7, -1.0, 28]],
  'e4-trap': [[3.0, 2.6, -1.0, 0, 2.0, -1.0, 32], [2.6, 2.8, -1.0, 0, 2.0, -1.0, 32]],
  'e4-comp': [[1.2, 0.7, -1.15, 0.1, 0.42, -1.0, 26], [0.9, 0.56, -1.1, 0.1, 0.42, -1.0, 26]],
  'e4-fix': [[5.0, 1.9, -1.0, 0, 1.6, -1.0, 36], [5.2, 1.9, -1.4, 0, 1.6, -1.0, 36]],
  'e4-gap': [[3.6, 2.2, -3.4, 0, 1.6, -0.8, 34], [3.0, 2.0, -3.0, 0, 1.6, -0.8, 34]],
  'e5-bottle': [[P + 0.3, 1.2, 3.2, P, 1.0, 0, 34], [P + 0.2, 1.1, 2.7, P, 1.0, 0, 34]],
  'e5-ice': [[P + 0.9, 0.9, 1.6, P, 0.8, 0, 30], [P + 0.6, 0.85, 1.3, P, 0.8, 0, 30]],
  'e5-neck': [[P + 0.5, 1.8, 1.1, P, 1.7, 0, 28], [P + 0.35, 1.75, 0.85, P, 1.7, 0, 28]],
  'e5-crack': [[P, 1.0, 1.4, P, 0.95, 0, 32], [P + 0.1, 1.0, 1.15, P, 0.95, 0, 32]],
  'e5-crack2': [[P - 0.9, 0.4, 1.3, P, 0.9, 0, 34], [P - 0.7, 0.5, 1.0, P, 0.9, 0, 34]],
  'e5-after': [[P + 0.8, 1.4, 2.8, P, 1.0, 0, 34], [P + 0.5, 1.3, 2.4, P, 1.0, 0, 34]],
  'e5-after2': [[P - 0.5, 1.2, 2.0, P, 1.0, 0, 32], [P - 0.3, 1.1, 1.7, P, 1.0, 0, 32]],
  'end': [[6.8, 2.6, 1.2, 0, 1.6, -0.2, 36], HOOK],
};
// pull-back factor per shot (portrait frame is narrow)
const DIST: Record<string, number> = {'i-comp': 1.9, 'e1-comp': 2.0, 'e2-comp': 1.9, 'e4-comp': 1.6, 'e1-thermo': 1.4, 'e1-fix': 1.6, 'e5-bottle': 1.4, 'e5-ice': 1.9, 'e5-neck': 2.2, 'e5-crack': 2.0, 'e5-crack2': 1.9, 'e5-after': 1.3, 'e5-after2': 1.8, 'e3-hot': 1.3};
function camAt(f: number) {
  const i = shotAt(f), s = SHOTS[i][0], e = i + 1 < SHOTS.length ? SHOTS[i + 1][0] : TOTAL - 1;
  const [a, b] = CAMS[SHOTS[i][1]];
  const t = smooth(0, 1, (sceneTime(f) - sceneTime(s)) / (sceneTime(e) - sceneTime(s)));
  const k = DIST[SHOTS[i][1]] ?? 1, o = a.map((v, j) => v + (b[j] - v) * t);
  for (let j = 0; j < 3; j++) o[j] = o[j + 3] + (o[j] - o[j + 3]) * k;
  return o;
}

const POST_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// Bayer index comes from gl_FragCoord only: the dither pattern is fixed on screen and never changes per frame
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
const HOT = new THREE.Color('#ff4a2a'), WARM = new THREE.Color('#ff9a3d'), COLD = new THREE.Color('#3f8cff'), ICE = new THREE.Color('#bfe4ff');
const WATER = new THREE.Color('#2a64ff'), SOLID = new THREE.Color('#eef9ff'), GOLD = new THREE.Color('#ffbf3a');
const hash = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const frac = (v: number) => ((v % 1) + 1) % 1;
// loop-locked phases (whole number of cycles over the video, so the last frame matches frame 0)
const R_STEAM = lr(0.012), R_AIR = lr(0.006), R_HEAT = lr(0.008), R_IN = lr(0.02), R_BUB = lr(0.15);
const FLOW = integ((f) => speed(f) * (0.25 + 0.75 * motorLevel(f)), 1 / (110 * 0.0022));
const CRANK = integ((f) => speed(f) * motorLevel(f) * 0.85, TAU);
const FAN = integ((f) => speed(f) * 0.5 * (0.25 + 0.75 * motorLevel(f)), TAU / 4);
// thermostat knob ticks a little at each click
const tick = (f: number) => CLICKS.reduce((s, c) => s + (f >= c && f < c + 8 ? Math.sin(((f - c) / 8) * Math.PI) : 0), 0);

// boxes that crowd the shelves (error 3): size, position, colour
const BOXES: [number[], number[], string][] = [
  [[0.36, 0.6, 0.26], [-0.3, 2.32, -0.3], '#e0a83a'], [[0.26, 0.55, 0.24], [0.05, 2.3, -0.35], '#d8333f'],
  [[0.28, 0.36, 0.22], [0.45, 2.2, 0.3], '#7fcf9a'], [[0.3, 0.28, 0.22], [-0.05, 2.16, 0.32], '#9cc0ff'],
  [[0.5, 0.45, 0.3], [-0.15, 1.4, -0.3], '#f2f4fb'], [[0.4, 0.42, 0.3], [0.45, 1.39, -0.3], '#c87a4a'],
  [[0.3, 0.3, 0.2], [0.2, 1.33, 0.42], '#ffd23f'], [[0.45, 0.4, 0.5], [-0.4, 0.46, 0.0], '#8e9ad8'],
  [[0.3, 0.32, 0.3], [-0.42, 0.88, 0.05], '#e9b48a'], [[0.4, 0.25, 0.3], [0.25, 0.92, -0.28], '#3fbf6a'],
];

export class MicroScene {
  renderer: THREE.WebGLRenderer;
  rt: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, RW / RH, 0.1, 80);
  postScene = new THREE.Scene();
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  clipFront = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.66);
  clipRight = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.7);
  clipComp = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.1);
  grad: THREE.DataTexture;
  door = new THREE.Group(); fan = new THREE.Group(); pot = new THREE.Group(); shallow = new THREE.Group();
  wall = new THREE.Group(); bottle = new THREE.Group(); gasket = new THREE.Group(); knob = new THREE.Group();
  piston!: THREE.Mesh; rod!: THREE.Mesh; crank = new THREE.Group(); rotor = new THREE.Group();
  liqNeck!: THREE.Mesh; cap!: THREE.Mesh;
  curve!: THREE.CatmullRomCurve3;
  uValve = 0; uEvapEnd = 0;
  gas!: THREE.InstancedMesh; air!: THREE.InstancedMesh; heatW!: THREE.InstancedMesh; steam!: THREE.InstancedMesh;
  frost!: THREE.InstancedMesh; doorAir!: THREE.InstancedMesh; spikes!: THREE.InstancedMesh; shards!: THREE.InstancedMesh;
  bubbles: THREE.Mesh[] = []; boxes: THREE.Mesh[] = []; cracks: {m: THREE.Mesh; thr: number}[] = [];
  condMat!: THREE.MeshToonMaterial; evapMat!: THREE.MeshToonMaterial; ledMat!: THREE.MeshToonMaterial; soupMat!: THREE.MeshToonMaterial;
  drawerMat!: THREE.MeshToonMaterial; liqMat!: THREE.MeshToonMaterial; glassMat!: THREE.MeshToonMaterial;
  heatL!: THREE.PointLight; potL!: THREE.PointLight; hotL!: THREE.PointLight;
  parts: Record<string, THREE.MeshToonMaterial[]> = {};
  pts: Record<string, THREE.Object3D> = {};
  crackO = new THREE.Vector3();

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
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: POST_VS, fragmentShader: POST_FS,
      uniforms: {tColor: {value: this.rt.texture}, tDepth: {value: this.rt.depthTexture}, res: {value: new THREE.Vector2(RW, RH)}, cNear: {value: 0.1}, cFar: {value: 80}},
    })));
    this.build();
  }
  mat(c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) { return new THREE.MeshToonMaterial({color: c, gradientMap: this.grad, emissive: new THREE.Color('#000000'), ...o}); }
  // a material that belongs to a named part: it pulses when that part's label is on screen
  pm(part: string, c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) { const m = this.mat(c, o); (this.parts[part] ??= []).push(m); return m; }
  rbox(s: number[], p: number[], m: THREE.Material, parent: THREE.Object3D = this.scene, r = 0.04) {
    const x = new THREE.Mesh(new RoundedBoxGeometry(s[0], s[1], s[2], 2, Math.min(r, Math.min(...s) / 2.2)), m); x.position.set(p[0], p[1], p[2]); parent.add(x); return x;
  }
  box(s: number[], p: number[], m: THREE.Material, parent: THREE.Object3D = this.scene) {
    const x = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), m); x.position.set(p[0], p[1], p[2]); parent.add(x); return x;
  }
  cyl(r: number, h: number, p: number[], m: THREE.Material, parent: THREE.Object3D = this.scene, seg = 24, open = false, r2 = r) {
    const x = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, seg, 1, open), m); x.position.set(p[0], p[1], p[2]); parent.add(x); return x;
  }
  tube(pts: THREE.Vector3[], r: number, m: THREE.Material) {
    const x = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pts.length * 12, r, 6), m); this.scene.add(x); return x;
  }
  inst(geo: THREE.BufferGeometry, color: string, n: number) { const x = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({color}), n); x.frustumCulled = false; this.scene.add(x); return x; }
  point(name: string, p: number[], parent: THREE.Object3D = this.scene) { const o = new THREE.Object3D(); o.position.set(p[0], p[1], p[2]); parent.add(o); this.pts[name] = o; }

  build() {
    const sc = this.scene, Z = Math.PI / 2;
    sc.background = new THREE.Color('#1a1f3d');
    sc.fog = new THREE.Fog('#1a1f3d', 10, 24);
    sc.add(new THREE.AmbientLight('#8890c0', 0.6));
    const key = new THREE.DirectionalLight('#fff3dc', 1.2); key.position.set(4, 6, 5); sc.add(key);
    const back = new THREE.DirectionalLight('#c8b0ff', 0.8); back.position.set(-3, 4, -6); sc.add(back);
    for (const x of [0, P]) { const fl = new THREE.Mesh(new THREE.CircleGeometry(12, 40), this.mat('#151a36')); fl.rotation.x = -Z; fl.position.x = x; sc.add(fl); }
    // ---- body: outer shell with the front and the right side cut away (dollhouse), inner liner seen from inside ----
    this.rbox([1.6, 3.2, 1.4], [0, 1.75, 0], this.mat('#e9ecf6', {clippingPlanes: [this.clipFront, this.clipRight]}), sc, 0.1);
    this.box([1.4, 3.0, 1.2], [0, 1.75, -0.02], this.mat('#cfe0f2', {side: THREE.BackSide}));
    const rim = this.mat('#d5dbe8');
    this.box([1.58, 0.1, 0.11], [0, 3.235, 0.61], rim); this.box([1.58, 0.1, 0.11], [0, 0.265, 0.61], rim);
    this.box([0.1, 2.9, 0.11], [-0.74, 1.75, 0.61], rim);
    for (const [x, z] of [[-0.65, 0.55], [0.65, 0.55], [-0.65, -0.55], [0.65, -0.55]]) this.cyl(0.06, 0.15, [x, 0.075, z], this.mat('#11121c'), sc, 10);
    // shelves + food
    const glass = this.mat('#a8d8ff');
    for (const y of [1.15, 2.0]) this.box([1.36, 0.035, 1.05], [0, y, 0], glass);
    this.box([0.26, 0.5, 0.26], [-0.4, 1.42, 0.05], this.mat('#ffffff')); this.box([0.27, 0.12, 0.27], [-0.4, 1.6, 0.05], this.mat('#2a5bd7')); // milk
    for (const [x, z, c] of [[0.4, 0.15, '#e23b3b'], [0.55, -0.05, '#e23b3b'], [0.3, -0.2, '#ffb43a']] as [number, number, string][]) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), this.mat(c)); a.position.set(x, 2.13, z); sc.add(a); }
    this.box([0.4, 0.16, 0.3], [-0.3, 2.1, 0.0], this.mat('#ffd23f')); // cheese
    this.drawerMat = this.pm('hotspot', '#7fcf9a');
    this.box([0.5, 0.3, 0.4], [0.2, 0.62, 0.0], this.drawerMat); this.box([0.48, 0.05, 0.38], [0.2, 0.79, 0.0], this.mat('#4f9a6a'));
    this.hotL = new THREE.PointLight('#ff7a3a', 0, 1.6); this.hotL.position.set(0.2, 0.9, 0.2); sc.add(this.hotL);
    this.point('hotspot', [0.2, 0.75, 0.1]);
    this.box([0.3, 0.06, 0.12], [0, 3.2, 0.35], this.mat('#fff7d0')); // lamp
    // ---- boiling pot (hook + error 1) ----
    this.pot.position.set(0.15, 1.17, 0.05); sc.add(this.pot);
    const potM = this.pm('pot', '#c8403a');
    this.cyl(0.24, 0.27, [0, 0.135, 0], potM, this.pot, 24);
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 6, 24), potM); rimT.rotation.x = Z; rimT.position.y = 0.27; this.pot.add(rimT);
    for (const s of [-1, 1]) this.rbox([0.1, 0.04, 0.08], [s * 0.3, 0.22, 0], this.mat('#2a2c38'), this.pot, 0.015);
    this.soupMat = this.mat('#e0902a');
    this.cyl(0.222, 0.02, [0, 0.262, 0], this.soupMat, this.pot, 24);
    for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), this.soupMat); b.position.set(Math.cos(k * 2.4) * 0.13 * hash(k, 9), 0.27, Math.sin(k * 2.4) * 0.13 * hash(k, 9) + 0.02); this.pot.add(b); this.bubbles.push(b); }
    this.point('pot', [0.24, 0.12, 0.12], this.pot);
    this.point('steam', [0.15, 2.0, 0.05]);
    this.potL = new THREE.PointLight('#ff8a3a', 0, 1.8); this.potL.position.set(0.15, 1.7, 0.2); sc.add(this.potL);
    this.steam = this.inst(new THREE.BoxGeometry(0.06, 0.06, 0.06), '#f2f6ff', 44);
    // shallow containers (the right way)
    this.shallow.position.set(0.17, 1.17, 0.07); sc.add(this.shallow);
    const shM = this.pm('shallow', '#9cc0ff');
    for (const x of [-0.19, 0.19]) { this.rbox([0.32, 0.08, 0.26], [x, 0.04, 0], shM, this.shallow, 0.02); this.rbox([0.33, 0.02, 0.27], [x, 0.09, 0], this.mat('#e8f1ff'), this.shallow, 0.008); }
    this.point('shallow', [0.19, 0.08, 0.1], this.shallow);
    // crowding boxes (error 3)
    BOXES.forEach(([s, p, c]) => { const b = this.rbox(s, p, this.pm('boxes', c), sc, 0.03); b.scale.setScalar(0.0001); this.boxes.push(b); });
    this.point('boxes', [-0.3, 2.45, -0.2]); this.point('airStuck', [0.1, 2.7, -0.05]); this.point('airFlow', [0.25, 1.75, 0.25]);
    // ---- thermostat on the left inner wall (faces the open side) ----
    this.rbox([0.06, 0.3, 0.26], [-0.67, 2.55, 0.25], this.pm('thermo', '#e8e9f0'), sc, 0.02);
    this.knob.position.set(-0.63, 2.6, 0.25); sc.add(this.knob);
    this.cyl(0.07, 0.04, [0, 0, 0], this.pm('thermo', '#2a5bd7'), this.knob, 16).rotation.z = Z;
    this.box([0.012, 0.012, 0.09], [0.022, 0, 0.0], this.mat('#ffffff'), this.knob);
    this.ledMat = this.mat('#224422');
    this.cyl(0.025, 0.02, [-0.635, 2.45, 0.25], this.ledMat, sc, 10).rotation.z = Z;
    this.point('thermo', [-0.62, 2.6, 0.25]);
    // ---- fan under the ceiling, in front of the evaporator ----
    this.fan.position.set(0, 2.95, -0.3); sc.add(this.fan);
    this.cyl(0.05, 0.05, [0, 0, 0], this.mat('#11121c'), this.fan, 10).rotation.x = Z;
    const blade = this.pm('fan', '#8e9ad8');
    for (let k = 0; k < 4; k++) { const g = new THREE.Group(); g.rotation.z = (k / 4) * TAU; const b = this.rbox([0.2, 0.08, 0.015], [0.12, 0, 0], blade, g, 0.007); b.rotation.x = 0.4; this.fan.add(g); }
    this.cyl(0.25, 0.04, [0, 2.95, -0.33], this.mat('#9aa0c8', {side: THREE.DoubleSide}), sc, 24, true).rotation.x = Z;
    this.point('fan', [0.12, 2.98, -0.28]);
    // ---- door (pivot on the left edge) with the rubber gasket on its inner face ----
    this.door.position.set(-0.8, 1.75, 0.72); sc.add(this.door);
    this.rbox([1.6, 3.2, 0.1], [0.8, 0, 0], this.mat('#f2f4fb'), this.door, 0.06);
    this.rbox([0.06, 0.8, 0.08], [1.45, 0.4, 0.09], this.mat('#9aa0c8'), this.door, 0.03);
    for (const y of [-0.9, 0.0, 0.9]) this.box([1.2, 0.04, 0.16], [0.8, y, -0.13], this.mat('#cfe0f2'), this.door);
    this.gasket.position.set(0.8, 0, -0.073); this.door.add(this.gasket);
    const rub = this.pm('gasket', '#4a4e60');
    this.rbox([1.5, 0.06, 0.048], [0, 1.53, 0], rub, this.gasket, 0.02); this.rbox([1.5, 0.06, 0.048], [0, -1.53, 0], rub, this.gasket, 0.02);
    this.rbox([0.06, 3.0, 0.048], [-0.73, 0, 0], rub, this.gasket, 0.02); this.rbox([0.06, 3.0, 0.048], [0.73, 0, 0], rub, this.gasket, 0.02);
    this.point('gasket', [1.53, -0.2, -0.075], this.door);
    this.point('warmIn', [0.1, 2.6, 0.9]); this.point('coldOut', [0.1, 0.6, 0.95]);
    this.doorAir = this.inst(new THREE.BoxGeometry(0.05, 0.05, 0.05), '#ffffff', 80);
    // ---- refrigerant loop ----
    const cond: THREE.Vector3[] = [];
    for (let k = 0; k < 10; k++) { const y = 0.75 + k * 0.23, s = k % 2 ? -1 : 1; cond.push(V(0.58 * s, y, -0.8), V(-0.58 * s, y + 0.115, -0.8)); }
    const evap: THREE.Vector3[] = [];
    for (let k = 0; k < 4; k++) { const y = 3.05 - k * 0.22; evap.push(V(-0.55, y, -0.52), V(0.55, y - 0.11, -0.52)); }
    const start = [V(0.2, 0.62, -1.0), V(0.55, 0.66, -0.85)];
    const valve = [V(-0.56, 3.05, -0.8), V(-0.6, 3.12, -0.75), V(-0.58, 3.12, -0.62)];
    const ret = [V(0.6, 2.25, -0.62), V(0.62, 2.2, -0.95), V(0.6, 1.0, -0.98), V(0.3, 0.64, -1.02)];
    const loop = [...start, ...cond, ...valve, ...evap, ...ret];
    this.curve = new THREE.CatmullRomCurve3(loop, true, 'centripetal');
    const nearestU = (p: THREE.Vector3) => { let best = 0, bd = 1e9; for (let k = 0; k <= 800; k++) { const d = this.curve.getPointAt(k / 800).distanceTo(p); if (d < bd) { bd = d; best = k / 800; } } return best; };
    this.uValve = nearestU(valve[1]); this.uEvapEnd = nearestU(ret[1]);
    this.condMat = this.pm('grid', '#2a2c38');
    this.evapMat = this.pm('evap', '#b9c6d8');
    this.tube([...start.slice(1), ...cond, valve[0]], 0.025, this.condMat);
    for (let k = 0; k < 10; k++) this.box([0.008, 2.4, 0.01], [-0.5 + k * 0.11, 1.85, -0.83], this.condMat); // grid wires
    this.tube([cond[cond.length - 1], ...valve, evap[0]], 0.012, this.mat('#c87a4a'));
    this.tube([valve[2], ...evap, ret[0]], 0.03, this.evapMat);
    this.tube([evap[evap.length - 1], ...ret, start[0], start[1]], 0.03, this.mat('#c87a4a'));
    this.heatL = new THREE.PointLight('#ff6a3a', 0, 2.4); this.heatL.position.set(0.6, 1.6, -1.5); sc.add(this.heatL);
    this.point('grid', [0.35, 1.6, -0.82]); this.point('evap', [0.45, 2.75, -0.5]); this.point('coldGas', [-0.3, 2.64, -0.52]);
    this.point('hotGas', [0.5, 1.1, -0.82]); this.point('trapped', [0.3, 2.3, -1.05]); this.point('gap', [0.5, 2.0, -1.5]);
    this.gas = this.inst(new THREE.BoxGeometry(0.055, 0.055, 0.055), '#ffffff', 110);
    this.frost = this.inst(new THREE.BoxGeometry(0.045, 0.045, 0.045), '#eef8ff', 170);
    this.point('frost', [0.2, 2.86, -0.5]);
    this.air = this.inst(new THREE.BoxGeometry(0.04, 0.04, 0.04), '#cfeaff', 70);
    this.heatW = this.inst(new THREE.BoxGeometry(0.05, 0.05, 0.01), '#ff8a3d', 46);
    // ---- compressor: shell cut open on the +x side; motor, crank and piston inside ----
    const C = [0.1, 0.38, -1.0];
    const fill = new THREE.PointLight('#d8dcff', 2.8, 3.4); fill.position.set(1.1, 1.0, -1.7); sc.add(fill); // keeps the dark back shots close to the interior brightness (no luma jump on cuts)
    this.rbox([0.58, 0.56, 0.44], C, this.pm('compressor', '#3a3f58', {clippingPlanes: [this.clipComp], side: THREE.DoubleSide}), sc, 0.16);
    this.box([0.78, 0.04, 0.54], [0.1, 0.08, -1.0], this.mat('#3a3256'));
    const coil = this.pm('compressor', '#c8783a', {clippingPlanes: [this.clipComp], side: THREE.DoubleSide});
    this.cyl(0.12, 0.16, [0.1, 0.22, -0.9], coil, sc, 20);
    this.rotor.position.set(0.1, 0.22, -0.9); sc.add(this.rotor);
    this.cyl(0.06, 0.2, [0, 0, 0], this.mat('#8a8fa8'), this.rotor, 12); this.box([0.13, 0.03, 0.03], [0, 0.11, 0], this.mat('#ffd23f'), this.rotor);
    this.cyl(0.075, 0.2, [0.1, 0.5, -1.1], this.mat('#5a5f78', {side: THREE.DoubleSide, clippingPlanes: [this.clipComp]}), sc, 18, true); // cylinder bore
    this.box([0.18, 0.04, 0.18], [0.1, 0.615, -1.1], this.mat('#3a3d4a')); // valve plate
    this.crank.position.set(0.1, 0.33, -1.1); sc.add(this.crank);
    this.cyl(0.06, 0.03, [0, 0, 0], this.mat('#8a8fa8'), this.crank, 16).rotation.z = Z;
    this.cyl(0.012, 0.05, [0, 0.04, 0], this.mat('#ffd23f'), this.crank, 8).rotation.z = Z;
    const pm = this.pm('piston', '#e0e4f0');
    this.piston = this.cyl(0.066, 0.07, [0.1, 0.48, -1.1], pm, sc, 18);
    this.rod = this.box([0.02, 0.12, 0.02], [0.1, 0.4, -1.1], this.pm('piston', '#b9c0d8'));
    this.point('compressor', [0.12, 0.64, -0.86]); this.point('piston', [0.14, 0.04, 0], this.piston);
    // ---- kitchen wall that slides up behind the fridge (error 4) ----
    sc.add(this.wall);
    const wm = this.pm('wall', '#d9c7a8');
    this.box([3.4, 4.4, 0.2], [0, 2.2, 0], wm, this.wall);
    this.box([3.4, 0.18, 0.06], [0, 0.09, 0.12], this.mat('#8a6f52'), this.wall);
    for (let k = 1; k < 9; k++) this.box([3.4, 0.012, 0.01], [0, k * 0.45, 0.103], this.mat('#bfae90'), this.wall);
    this.point('wall', [0.6, 2.6, 0.1], this.wall);
    // ---- macro: freezer with a full, capped glass bottle ----
    this.box([2.6, 2.8, 2.2], [P, 1.3, -0.2], this.mat('#bcd9ee', {side: THREE.BackSide}));
    for (let k = 0; k < 7; k++) this.box([2.5, 0.025, 0.025], [P, 0.06, -1.1 + k * 0.3], this.mat('#8a93b0'));
    const fr = this.inst(new THREE.BoxGeometry(0.06, 0.06, 0.02), '#f4fbff', 70), d = new THREE.Object3D();
    for (let i = 0; i < 70; i++) { d.position.set(P - 1.2 + hash(i, 11) * 2.4, 0.2 + hash(i, 12) * 2.5, -1.29); d.scale.setScalar(0.5 + hash(i, 13)); d.updateMatrix(); fr.setMatrixAt(i, d.matrix); }
    this.bottle.position.set(P, 0.08, 0); sc.add(this.bottle);
    this.liqMat = this.pm('ice', '#3f7cf0');
    this.cyl(0.272, 0.96, [0, 0.5, 0], this.liqMat, this.bottle, 24);
    this.cyl(0.272, 0.25, [0, 1.105, 0], this.liqMat, this.bottle, 24, false, 0.088);
    const ng = new THREE.CylinderGeometry(0.088, 0.088, 1, 16); ng.translate(0, 0.5, 0);
    this.liqNeck = new THREE.Mesh(ng, this.liqMat); this.liqNeck.position.y = 1.22; this.bottle.add(this.liqNeck);
    this.glassMat = this.pm('bottle', '#a6f0d6', {transparent: true, opacity: 0.22, depthWrite: false});
    this.cyl(0.3, 1.0, [0, 0.5, 0], this.glassMat, this.bottle, 28);
    this.cyl(0.3, 0.25, [0, 1.125, 0], this.glassMat, this.bottle, 28, true, 0.11);
    this.cyl(0.11, 0.33, [0, 1.415, 0], this.glassMat, this.bottle, 18, true);
    this.cap = this.cyl(0.128, 0.09, [0, 1.62, 0], this.pm('cap', '#d8b04a'), this.bottle, 18);
    this.point('bottle', [0.27, 0.75, 0.12], this.bottle); this.point('cap', [0.1, 1.64, 0.05], this.bottle);
    this.point('neck', [0.0, 1.45, 0.1], this.bottle); this.point('ice', [0.18, 0.45, 0.22], this.bottle);
    this.spikes = this.inst(new THREE.OctahedronGeometry(0.03, 0), '#eaf8ff', 90);
    // crack lines: random walks on the front of the glass, each segment shows up in order
    const cr = this.mat('#1d2a4a'), seg = new THREE.BoxGeometry(0.014, 0.014, 1); seg.translate(0, 0, 0.5);
    const onGlass = (th: number, y: number) => V(P + Math.sin(th) * 0.308, 0.08 + y, Math.cos(th) * 0.308);
    this.crackO.copy(onGlass(0.15, 0.78));
    for (let br = 0; br < 5; br++) {
      let th = 0.15, y = 0.78, dir = (br / 5) * TAU + 0.4;
      for (let k = 0; k < 7; k++) {
        const len = 0.07 + hash(br, k) * 0.05, nth = th + Math.cos(dir) * len / 0.308, ny = clamp(y + Math.sin(dir) * len, 0.05, 1.05);
        const a = onGlass(th, y), b = onGlass(nth, ny), m = new THREE.Mesh(seg, cr);
        m.position.copy(a); m.lookAt(b); m.userData.len = a.distanceTo(b); m.scale.set(1, 1, 0.0001); sc.add(m);
        this.cracks.push({m, thr: k / 8 + hash(br, 30) * 0.05});
        th = nth; y = ny; dir += (hash(br, k + 50) - 0.5) * 1.3;
      }
    }
    this.point('crack', [Math.sin(0.15) * 0.31, 0.78, Math.cos(0.15) * 0.31], this.bottle);
    this.shards = this.inst(new THREE.TetrahedronGeometry(0.035, 0), '#c8f6e6', 18);
    this.point('shards', [0.2, 0.55, 0.45], this.bottle);
  }

  update(f: number) {
    const [px, py, pz, tx, ty, tz, fov] = camAt(f);
    this.camera.position.set(px, py, pz); this.camera.lookAt(tx, ty, tz); this.camera.fov = fov; this.camera.updateProjectionMatrix();
    const st = sceneTime(f), m = motorLevel(f), heat = heatAt(f), open = doorOpen(f), d = new THREE.Object3D(), c = new THREE.Color();
    for (const ms of Object.values(this.parts)) for (const x of ms) x.emissive.setRGB(0, 0, 0);
    // door + gasket squish when it shuts
    this.door.rotation.y = -1.9 * open;
    const sq = f >= DOOR_SHUT && f < DOOR_SHUT + 10 ? Math.sin(((f - DOOR_SHUT) / 10) * Math.PI) : 0;
    this.gasket.scale.set(1 + 0.02 * sq, 1, 1 - 0.45 * sq);
    // thermostat: LED green while the motor runs, blinks red under max heat (warning)
    const warn = heat > 0.95 ? 0.5 + 0.5 * Math.cos((f / 20) * TAU) : 0;
    this.ledMat.emissive.setRGB(0.1 + 0.9 * warn, 0.9 * m * (1 - warn), 0.2 * m * (1 - warn));
    this.knob.rotation.x = -0.25 * tick(f);
    this.condMat.emissive.setRGB(0.8 * heat * (0.3 + 0.7 * m), 0.16 * heat * (0.3 + 0.7 * m), 0.04 * heat);
    this.evapMat.emissive.setRGB(0.05, 0.2 * (0.4 + 0.6 * m), 0.45 * (0.4 + 0.6 * m));
    this.heatL.intensity = 0.9 * heat * (0.3 + 0.7 * m) + 0.6 * wallNear(f);
    // compressor: crank turns, rod pushes the piston up and down, rotor spins; whole unit hums
    const ph = CRANK[clamp(Math.floor(f), 0, TOTAL)], rc = 0.04, L = 0.12;
    this.crank.rotation.x = ph; this.rotor.rotation.y = ph;
    const pinY = 0.33 + rc * Math.cos(ph), pinZ = -1.1 + rc * Math.sin(ph), yP = 0.33 + rc * Math.cos(ph) + Math.sqrt(L * L - (rc * Math.sin(ph)) ** 2);
    this.piston.position.y = yP + 0.035;
    this.rod.position.set(0.1, (pinY + yP) / 2, (pinZ - 1.1) / 2); this.rod.rotation.x = Math.atan2(-(pinZ + 1.1), yP - pinY);
    // pot: boiling bubbles + steam; glow
    const ps = potScale(f), ss = shallowScale(f);
    this.pot.scale.setScalar(Math.max(ps, 0.0001)); this.pot.visible = ps > 0.001;
    this.shallow.scale.setScalar(Math.max(ss, 0.0001)); this.shallow.visible = ss > 0.001;
    this.soupMat.emissive.setRGB(0.35, 0.12, 0.0);
    this.bubbles.forEach((b, k) => { const t = frac(st * R_BUB + hash(k, 3)); b.scale.setScalar(Math.sin(t * Math.PI) + 0.0001); });
    this.potL.intensity = 0.9 * ps;
    for (let i = 0; i < 44; i++) {
      const sk = SHOTS[shotAt(f)][1] === 'e1-thermo' ? 0.35 : 1, t = frac(i / 44 + st * R_STEAM), a = hash(i, 1) * TAU, r = 0.05 + t * (0.25 + 0.3 * hash(i, 2));
      d.position.set(0.15 + Math.cos(a) * r * ps, 1.43 + t * 1.6 * ps, 0.05 + Math.sin(a) * r * 0.8);
      d.rotation.set(t * 3, i, 0); d.scale.setScalar(sk * ps * (0.5 + t * 1.3) * Math.sin(t * Math.PI) + 0.0001); d.updateMatrix(); this.steam.setMatrixAt(i, d.matrix);
    }
    this.steam.instanceMatrix.needsUpdate = true;
    // crowding boxes appear one by one, then leave
    this.boxes.forEach((b, i) => { const k = smooth(925 + i * 5, 937 + i * 5, f) * (1 - smooth(1185 + i * 3, 1197 + i * 3, f)); b.scale.setScalar(Math.max(k, 0.0001)); b.visible = k > 0.001; });
    const blk = blockAt(f);
    this.drawerMat.emissive.setRGB(0.3 * blk, 0.06 * blk, 0);
    this.hotL.intensity = 0.45 * blk;
    this.fan.rotation.z = -FAN[clamp(Math.floor(f), 0, TOTAL)];
    // gas: hot after the compressor, cools along the grid, turns cold after the valve
    const fl = FLOW[clamp(Math.floor(f), 0, TOTAL)];
    for (let i = 0; i < 110; i++) {
      const u = frac(i / 110 + fl * 0.0022);
      d.position.copy(this.curve.getPointAt(u)); d.rotation.set(i, i * 0.7, 0);
      if (u < this.uValve) c.copy(HOT).lerp(WARM, clamp(u / this.uValve));
      else if (u < this.uEvapEnd) c.copy(COLD).lerp(ICE, clamp((u - this.uValve) / (this.uEvapEnd - this.uValve)));
      else c.copy(ICE).lerp(HOT, clamp((u - this.uEvapEnd) / (1 - this.uEvapEnd)) * 0.3);
      d.scale.setScalar(u < this.uValve ? 1.1 : 0.9); d.updateMatrix(); this.gas.setMatrixAt(i, d.matrix); this.gas.setColorAt(i, c);
    }
    this.gas.instanceMatrix.needsUpdate = true; this.gas.instanceColor!.needsUpdate = true;
    // frost grows on the evaporator tubes (humid air from the open door)
    const fz = frostAt(f);
    for (let i = 0; i < 170; i++) {
      const u = this.uValve + (this.uEvapEnd - this.uValve) * hash(i, 20), h = hash(i, 21);
      d.position.copy(this.curve.getPointAt(u)).add(V((hash(i, 22) - 0.5) * 0.06, (hash(i, 23) - 0.5) * 0.07, (hash(i, 24) - 0.5) * 0.07 + 0.01));
      d.rotation.set(i, i * 1.3, 0); d.scale.setScalar(clamp(fz * 1.6 - h * 0.6) * (0.6 + h) + 0.0001); d.updateMatrix(); this.frost.setMatrixAt(i, d.matrix);
    }
    this.frost.instanceMatrix.needsUpdate = true;
    // cold air blown by the fan: forward then down; boxes cut the path short (air piles up near the fan)
    for (let i = 0; i < 70; i++) {
      const t = frac(i / 70 + st * R_AIR) * (1 - 0.82 * blk), lane = hash(i, 1) - 0.5, jit = blk * Math.sin(st * 0.3 + i) * 0.03;
      d.position.set(lane * 1.1 + jit, 2.9 - Math.pow(t, 1.4) * 2.3, -0.25 + Math.sin(t * Math.PI) * 0.65 * (1 - 0.5 * blk));
      d.rotation.set(0, i, 0); d.scale.setScalar((0.4 + 0.6 * m) * (Math.sin(clamp(t / (1 - 0.82 * blk)) * Math.PI) + 0.0001)); d.updateMatrix(); this.air.setMatrixAt(i, d.matrix);
    }
    this.air.instanceMatrix.needsUpdate = true;
    // heat shimmer rising off the back grid; a close wall traps it (slower, wider, redder)
    const wn = wallNear(f);
    this.wall.visible = wallVisible(f); this.wall.position.z = -2.8 + 1.45 * wn;
    for (let i = 0; i < 46; i++) {
      const t = frac(i / 46 + st * R_HEAT), y = 0.6 + t * (2.8 - 1.2 * wn);
      d.position.set((hash(i, 2) - 0.5) * 1.3 + Math.sin(t * 9 + i) * (0.04 + 0.06 * wn), y, -0.92 - hash(i, 3) * (0.15 + 0.1 * (1 - wn)));
      d.rotation.set(0, 0, t * 3); d.scale.setScalar((heat * (0.3 + 0.7 * m) + 0.5 * wn) * Math.sin(t * Math.PI) + 0.0001); d.updateMatrix(); this.heatW.setMatrixAt(i, d.matrix);
    }
    this.heatW.instanceMatrix.needsUpdate = true;
    // open door: warm air flows in on top, cold air spills out at the bottom
    for (let i = 0; i < 80; i++) {
      const inn = i < 40, t = frac(i / 40 + st * R_IN), lane = hash(i, 7) - 0.5;
      if (inn) d.position.set(lane * 1.2, 2.2 + hash(i, 8) * 0.8 - t * 0.5, 1.8 - t * 2.0);
      else d.position.set(lane * 1.2, 0.95 - hash(i, 8) * 0.4 - t * 0.5, -0.2 + t * 2.0);
      d.rotation.set(i, t * 4, 0); d.scale.setScalar(open * Math.sin(t * Math.PI) + 0.0001); d.updateMatrix(); this.doorAir.setMatrixAt(i, d.matrix);
      this.doorAir.setColorAt(i, inn ? c.copy(WARM).lerp(HOT, t * 0.5) : c.copy(COLD).lerp(ICE, t));
    }
    this.doorAir.instanceMatrix.needsUpdate = true; this.doorAir.instanceColor!.needsUpdate = true;
    // freezer: water turns to ice, grows up the neck until it presses the cap, then the glass cracks
    const fr = freezeAt(f), ck = crackAt(f);
    this.liqMat.color.copy(WATER).lerp(SOLID, fr);
    this.liqNeck.scale.y = 0.2 + 0.12 * fr;
    this.cap.position.y = 1.62 + 0.012 * smooth(0.85, 1, fr);
    for (let i = 0; i < 90; i++) {
      const a = (hash(i, 40) - 0.5) * 3.2, y = 0.05 + hash(i, 41) * 0.95, g = clamp((fr - hash(i, 42) * 0.7) * 3);
      d.position.set(P + Math.sin(a) * 0.28, 0.08 + y, Math.cos(a) * 0.28); d.rotation.set(i, i * 2, 0);
      d.scale.set(g * 0.7 + 0.0001, g * (1 + hash(i, 43)) + 0.0001, g * 0.7 + 0.0001); d.updateMatrix(); this.spikes.setMatrixAt(i, d.matrix);
    }
    this.spikes.instanceMatrix.needsUpdate = true;
    for (const {m: cm, thr} of this.cracks) { const g = clamp((ck - thr) / 0.15); cm.scale.set(1, 1, Math.max(g * cm.userData.len, 0.0001)); cm.visible = g > 0; }
    for (let i = 0; i < 18; i++) {
      const s = clamp((ck - 0.35 - hash(i, 60) * 0.2) / 0.6), a = (hash(i, 61) - 0.5) * 2.4 + 0.15, up = 0.3 + hash(i, 62) * 0.6;
      d.position.set(this.crackO.x + Math.sin(a) * s * 0.55, this.crackO.y + (up - 1.4 * s) * s * 0.5, this.crackO.z + Math.cos(a) * s * 0.5 + 0.02);
      d.rotation.set(s * 4 + i, s * 3, i); d.scale.setScalar(s > 0 ? 0.6 + hash(i, 63) : 0.0001); d.updateMatrix(); this.shards.setMatrixAt(i, d.matrix);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    this.glassMat.opacity = 0.22 + 0.1 * ck;
    // highlight: the part named by an on-screen label pulses gold (colour only, no screen flash)
    for (const [a, b, , name] of LABS) {
      const ms = this.parts[name];
      if (!ms || f < a || f >= b) continue;
      const env = Math.min(clamp((f - a) / 6), clamp((b - f) / 6)), k = env * (0.55 + 0.45 * Math.sin(((f - a) / 16) * TAU)) * 0.5;
      for (const x of ms) x.emissive.add(c.copy(GOLD).multiplyScalar(k));
    }
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
