import * as THREE from 'three';
import {S, CLACK, clamp, ease, sixteenth} from './timeline';

export const RW = 270, RH = 480;
THREE.ColorManagement.enabled = false;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

type Key = number[]; // [frame, px, py, pz, tx, ty, tz, fov]
const KEYS: Key[] = [
  [0, 2.2, 1.1, 3.6, 0, 0.7, 1.2, 34], [26, 2.5, 1.0, 3.0, 0, 0.68, 0.9, 34], [60, 3.1, 0.9, 1.1, 0, 0.65, 0.55, 34],
  [112, 6.5, 3.2, 4.6, 0, 1.75, 0, 38], [170, 3.3, 1.0, 1.5, 0, 0.7, 0.5, 34], [220, 3.0, 1.5, 0.4, 0, 1.2, 0.1, 34],
  [300, 2.8, 1.6, -0.6, 0, 1.45, -0.1, 32], [380, 2.6, 2.0, -1.3, 0, 1.72, -0.5, 30], [460, 3.0, 2.3, 0.2, 0, 1.95, -0.1, 32],
  [540, 3.2, 2.6, 1.2, 0, 2.35, 0.1, 32], [620, 2.3, 2.4, 0.5, 0, 2.35, 0.1, 28], [700, 2.1, 2.7, -0.1, 0, 2.35, 0.1, 28],
  [740, 2.6, 3.0, 6.2, -2.4, 2.4, 1.8, 38], [770, 2.3, 2.7, 8.4, -3.5, 2.5, 2.6, 40], [790, 2.4, 2.8, 8.6, -3.4, 2.5, 2.5, 40], [860, 7.5, 4.2, 7.8, -1.5, 1.8, 0.8, 40],
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
const cutAt = (f: number) => Math.min(ease((f - 28) / 20), 1 - ease((f - 790) / 30));

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
  sled = new THREE.Group();
  beam!: THREE.Mesh;
  fan = new THREE.Group();
  ssd: THREE.Mesh[] = [];
  ram: THREE.Mesh[] = [];
  cpu: THREE.Mesh[] = [];
  gpu: THREE.Mesh[] = [];
  decomp!: THREE.Mesh;
  screen!: THREE.Mesh;
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
  glow(c: string) { return this.mat(c, {emissive: new THREE.Color('#000000')}); }
  box(s: number[], p: number[], m: THREE.Material, parent: THREE.Object3D = this.scene) {
    const x = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), m); x.position.set(p[0], p[1], p[2]); parent.add(x); return x;
  }
  point(name: string, p: number[], parent: THREE.Object3D = this.scene) { const o = new THREE.Object3D(); o.position.set(p[0], p[1], p[2]); parent.add(o); this.pts[name] = o; }

  build() {
    const sc = this.scene, Z = Math.PI / 2;
    sc.background = new THREE.Color('#1a1f3d');
    sc.fog = new THREE.Fog('#1a1f3d', 8, 20);
    sc.add(new THREE.AmbientLight('#8890c0', 0.6));
    const key = new THREE.DirectionalLight('#fff3dc', 1.4); key.position.set(4, 6, 3); sc.add(key);
    const rim = new THREE.DirectionalLight('#7fa0ff', 0.7); rim.position.set(-4, 3, -4); sc.add(rim);
    const clipM = (c: string) => this.mat(c, {clippingPlanes: [this.clip], side: THREE.DoubleSide});
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), this.mat('#151a36')); floor.rotation.x = -Z; sc.add(floor);
    // console: black core + two white curved shells (generic design)
    this.box([0.6, 3.4, 2.4], [0, 1.8, 0], clipM('#1c1f33'));
    const sh = new THREE.Shape();
    sh.moveTo(-1.3, 0.05); sh.lineTo(1.25, 0.05);
    sh.bezierCurveTo(1.3, 1.2, 1.25, 2.4, 1.5, 3.75);
    sh.bezierCurveTo(0.5, 3.6, -0.5, 3.6, -1.45, 3.8);
    sh.bezierCurveTo(-1.25, 2.4, -1.35, 1.2, -1.3, 0.05);
    const shellGeo = new THREE.ExtrudeGeometry(sh, {depth: 0.06, bevelEnabled: false, curveSegments: 20});
    for (const x of [0.36, -0.42]) { const m = new THREE.Mesh(shellGeo, clipM('#eef0fb')); m.rotation.y = Z; m.position.x = x; sc.add(m); }
    this.box([0.04, 0.95, 0.03], [0.0, 0.65, 1.21], this.mat('#05060c')); // disc slot
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.08, 24), this.mat('#2b2e44')); stand.position.y = 0.04; sc.add(stand);
    // mainboard
    this.box([0.03, 3.25, 2.2], [-0.12, 1.85, 0], this.mat('#1f6b4a'));
    for (let i = 0; i < 14; i++) this.box([0.005, 0.01, 1.9], [-0.1, 0.4 + i * 0.22, 0], this.mat('#2d8a60'));
    // disc drive: back plate, disc, laser rail + sled
    this.box([0.02, 1.0, 1.15], [-0.06, 0.65, 0.58], this.mat('#3a3d55'));
    this.disc.position.set(0, 0.65, 0.55);
    sc.add(this.disc);
    const dm = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.015, 64), this.mat('#d6dcff')); dm.rotation.z = Z; this.disc.add(dm);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), this.mat('#3a3d55')); hole.rotation.z = Z; this.disc.add(hole);
    const colors = ['#ff6b9a', '#6fd0ff', '#ffd23f', '#9b7bff'];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, w = this.box([0.02, 0.04, 0.3], [0.01, 0, 0], this.mat(colors[k % 4])); this.disc.remove(w); const g = new THREE.Group(); g.rotation.x = a; w.position.set(0.01, 0, 0.26); g.add(w); this.disc.add(g); }
    this.box([0.03, 0.5, 0.05], [0.07, 0.4, 0.55], this.mat('#8e9ad8'));
    this.sled.position.set(0.09, 0.4, 0.55); sc.add(this.sled);
    this.box([0.05, 0.08, 0.12], [0, 0, 0], this.mat('#59639a'), this.sled);
    this.beam = this.box([0.06, 0.02, 0.02], [-0.05, 0, 0], new THREE.MeshBasicMaterial({color: '#7f7bff'}), this.sled);
    this.point('disc', [0.02, 0.95, 0.75]); this.point('laser', [0.09, 0.4, 0.55]);
    // SSD chips, decompressor, APU (CPU + GPU tiles), RAM, fan, HDMI
    for (let i = 0; i < 4; i++) this.ssd.push(this.box([0.04, 0.2, 0.34], [-0.08, 1.42, -0.75 + i * 0.4], this.glow('#2b2e44')));
    this.point('ssd', [-0.06, 1.52, 0.05]);
    this.decomp = this.box([0.07, 0.22, 0.3], [-0.07, 1.78, -0.6], this.glow('#e0a83a'));
    this.point('decomp', [-0.03, 1.85, -0.6]);
    this.box([0.04, 0.62, 0.62], [-0.09, 2.35, 0.1], this.mat('#2d5e3f'));
    this.box([0.06, 0.4, 0.4], [-0.06, 2.35, 0.1], this.mat('#b8c0e8'));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) this.cpu.push(this.box([0.015, 0.07, 0.06], [-0.025, 2.48 - r * 0.085, -0.05 + c * 0.075], this.glow('#59639a')));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) this.gpu.push(this.box([0.015, 0.06, 0.05], [-0.025, 2.52 - r * 0.068, 0.12 + c * 0.065], this.glow('#59639a')));
    this.point('cpu', [-0.02, 2.36, -0.01]); this.point('gpu', [-0.02, 2.4, 0.19]); this.point('apu', [-0.02, 2.6, 0.1]);
    for (const y of [1.9, 2.82]) for (const z of [-0.32, -0.08, 0.28, 0.52]) this.ram.push(this.box([0.035, 0.17, 0.14], [-0.09, y, z], this.glow('#2b2e44')));
    this.point('ram', [-0.07, 1.9, -0.32]);
    this.fan.position.set(-0.05, 3.18, -0.6); sc.add(this.fan);
    const fd = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24), this.mat('#2b2e44')); fd.rotation.z = Z; this.fan.add(fd);
    for (let k = 0; k < 9; k++) { const g = new THREE.Group(); g.rotation.x = (k / 9) * Math.PI * 2; this.box([0.04, 0.03, 0.24], [0.03, 0, 0.14], this.mat('#8e9ad8'), g); this.fan.add(g); }
    this.box([0.1, 0.1, 0.06], [0, 0.4, -1.23], this.mat('#05060c'));
    this.point('hdmi', [0, 0.45, -1.25]);
    const cable = new THREE.CatmullRomCurve3([V(0, 0.4, -1.27), V(-0.8, 0.05, -1.5), V(-2.6, 0.05, 0.6), V(-3.4, 0.05, 2.3), V(-3.5, 1.4, 2.6)]);
    sc.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 60, 0.03, 5), this.mat('#2b2e44')));
    // TV
    const tv = new THREE.Group(); tv.position.set(-3.5, 2.6, 2.6); tv.rotation.y = Math.PI / 4; sc.add(tv);
    this.box([3.4, 2.0, 0.1], [0, 0, 0], this.mat('#11121c'), tv);
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({map: this.tvTex}));
    this.screen.position.z = 0.06; tv.add(this.screen);
    this.box([0.1, 1.2, 0.1], [0, -1.6, -0.1], this.mat('#2b2e44'), tv);
    this.box([1.2, 0.05, 0.5], [0, -2.2, -0.1], this.mat('#2b2e44'), tv);
    // data flows
    const C = (...p: number[][]) => new THREE.CatmullRomCurve3(p.map((q) => V(q[0], q[1], q[2])));
    this.flows = [
      {curve: C([0.1, 0.42, 0.55], [0.06, 1.0, 0.45], [-0.03, 1.42, 0.05]), from: 70, to: S.decomp, n: 26, speed: 0.012, color: '#7f9bff', s0: 1, s1: 1},
      {curve: C([-0.03, 1.42, 0.05], [0.0, 1.6, -0.3], [-0.02, 1.78, -0.6]), from: S.decomp, to: S.ram, n: 22, speed: 0.016, color: '#3ec9a7', s0: 0.6, s1: 0.6},
      {curve: C([-0.02, 1.78, -0.6], [0.04, 1.9, -0.45], [-0.04, 1.9, -0.32]), from: S.decomp, to: S.ram + 30, n: 18, speed: 0.02, color: '#ffd23f', s0: 1.5, s1: 1.5},
      ...[-0.32, -0.08, 0.28, 0.52].flatMap((z) => [1.9, 2.82].map((y) => ({curve: C([-0.04, y, z], [0.04, (y + 2.35) / 2, (z + 0.1) / 2], [-0.01, 2.35, 0.1]), from: S.ram + 10, to: S.chip + 10, n: 6, speed: 0.03, color: '#ff8a3d', s0: 1, s1: 1}))),
      {curve: C([-0.01, 2.35, 0.1], [0.08, 1.4, -0.7], [0.03, 0.42, -1.27], [-0.8, 0.1, -1.5], [-2.6, 0.1, 0.6], [-3.4, 0.1, 2.3], [-3.5, 1.4, 2.6]), from: S.tv - 20, to: S.end, n: 40, speed: 0.012, color: '#ff5fa2', s0: 1.2, s1: 1.2},
    ];
    const N = this.flows.reduce((a, b) => a + b.n, 0);
    this.bits = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), new THREE.MeshBasicMaterial({color: '#ffffff'}), N);
    let i = 0;
    for (const fl of this.flows) for (let k = 0; k < fl.n; k++) this.bits.setColorAt(i++, new THREE.Color(fl.color));
    sc.add(this.bits);
  }

  drawTV(f: number, on: number) {
    const c = this.tvCanvas.getContext('2d')!, W = 192, H = 108;
    c.fillStyle = '#05060c'; c.fillRect(0, 0, W, H);
    if (on <= 0) { this.tvTex.needsUpdate = true; return; }
    const sky = ['#2b1650', '#5a1f6e', '#a8326e', '#e2556a', '#ff8a5c', '#ffc46b'];
    sky.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * 10, W, 10); });
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
    // disc slides in, then spins; laser reads outward
    this.disc.position.z = 0.55 + 1.15 * (1 - ease(f / CLACK));
    const spin = f < CLACK ? 0 : Math.min(0.25, (f - CLACK) * 0.02);
    this.disc.rotation.x = -(f > CLACK ? (f - CLACK) * spin : 0);
    this.sled.position.y = 0.42 - clamp((f - 30) / 200) * 0.25;
    const bit = sixteenth(f, S.disc);
    this.beam.visible = f > CLACK + 4 && f < S.install + 40 && (f < S.disc || bit % 2 === 0 || (f % 5) < 3);
    this.fan.rotation.x = -f * (f < S.chip ? 0.12 : 0.35);
    // component glows
    const em = (m: THREE.Mesh, r: number, g: number, b: number) => (m.material as THREE.MeshToonMaterial).emissive.setRGB(r, g, b);
    const fill = clamp((f - S.install) / 70);
    this.ssd.forEach((m, i) => { const e = f >= S.install ? clamp(fill * 4 - i) : 0; em(m, 0.1 * e, 0.5 * e, 0.9 * e); });
    const pulse = f >= S.decomp && f < S.ram ? Math.exp(-((f - S.decomp) % 5) / 2) : 0;
    em(this.decomp, pulse * 0.9, pulse * 0.6, pulse * 0.1);
    const ramFill = clamp((f - S.decomp - 40) / 140);
    this.ram.forEach((m, i) => { const e = clamp(ramFill * 8 - i) * (0.55 + 0.25 * Math.sin(f * 0.3 + i)); em(m, 0.9 * e, 0.45 * e, 0.1 * e); });
    const core = f >= S.chip && f < S.tv ? sixteenth(f, S.chip) % 8 : -1;
    this.cpu.forEach((m, i) => { const age = core < 0 ? 99 : ((core - i + 8) % 8) * 5 + ((f - S.chip) % 5); const e = Math.exp(-age / 7) + (f >= S.chip && f < S.tv ? 0.15 : 0); em(m, 0.2 * e, 0.6 * e, 1.0 * e); });
    this.gpu.forEach((m, i) => {
      const r = Math.floor(i / 3), c = i % 3, wave = (f - S.gpu) / 4 - (r + c);
      const e = f >= S.gpu && f < S.tv + 20 ? clamp(1 - Math.abs((wave % 7) - 1) / 2) + 0.2 : 0;
      em(m, 1.0 * e, 0.35 * e, 0.6 * e);
    });
    this.drawTV(f, clamp((f - S.tv) / 10));
    // flowing data bits
    const d = new THREE.Object3D();
    let i = 0;
    for (const fl of this.flows) {
      const act = Math.min(clamp((f - fl.from) / 10), clamp((fl.to - f) / 10));
      for (let k = 0; k < fl.n; k++) {
        const t = (((k / fl.n + (f - fl.from) * fl.speed) % 1) + 1) % 1;
        fl.curve.getPoint(t, d.position);
        d.scale.setScalar(act > 0 ? act * (fl.s0 + (fl.s1 - fl.s0) * t) : 0.0001);
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
