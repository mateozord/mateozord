import * as THREE from 'three';
import {S, REAL, BUTTONS, clamp, ease, factorAt, revAt, ringHits, coilIndex, TOTAL} from './timeline';

export const RW = 270, RH = 480; // low-res 3D render, upscaled 4x with nearest filtering
THREE.ColorManagement.enabled = false;

// cumulative angles (deterministic per frame)
const BLADE = new Float64Array(TOTAL + 2), ROTOR = new Float64Array(TOTAL + 2), OSC = new Float64Array(TOTAL + 2), AIR = new Float64Array(TOTAL + 2);
const oscRate = (f: number) => (f < S.blades || f >= S.back ? (Math.PI * 2) / 240 : f >= S.osc && f < S.slow ? (Math.PI * 2) / 160 : 0);
for (let f = 0; f <= TOTAL; f++) {
  const s = revAt(f);
  ROTOR[f + 1] = ROTOR[f] + s * Math.PI * 2;
  BLADE[f + 1] = BLADE[f] + Math.min(s, 0.045) * Math.PI * 2; // cap avoids wagon-wheel aliasing; blur covers real speed
  OSC[f + 1] = OSC[f] + oscRate(f);
  AIR[f + 1] = AIR[f] + Math.min(s, 0.12);
}
export const oscAmp = (f: number) => {
  if (f < S.blades) return 0.5;
  if (f < S.osc) return 0.5 * (1 - ease((f - S.blades) / 16));
  if (f < S.slow) return 0.5 * ease((f - S.osc) / 20) * (1 - ease((f - (S.slow - 20)) / 20));
  if (f < S.back) return 0;
  return 0.5 * ease((f - S.back) / 30);
};
const cutAt = (f: number) => {
  const win = (a: number, b: number) => Math.min(ease((f - a) / 16), ease((b - f) / 16));
  return Math.max(0, win(S.motor + 6, S.speeds), win(S.osc + 10, S.slow));
};
const airVis = (f: number) => {
  if (f < S.motor) return 1;
  if (f < S.motor + 12) return 1 - (f - S.motor) / 12;
  if (f < S.slow - 12) return f >= S.osc ? 0.25 : 0;
  return 1;
};

type Key = [number, number, number, number, number, number, number, number];
const KEYS: Key[] = [
  [0, 6, 5.4, 8.6, 0, 2.3, 0, 40],
  [80, 3.6, 4.4, 5.4, 0, 3.2, 0.2, 36],
  [110, 5.28, 4.24, 1.98, 0, 3.62, 0.55, 34],
  [170, 3.96, 5.34, 5, 0, 3.62, 0.6, 34],
  [240, 2.8, 3.38, 5.4, 0, 3.62, 0.6, 36],
  [262, 5.1, 4.76, -0.55, 0, 3.62, -0.1, 30],
  [330, 4.2, 4.61, -1.6, 0, 3.62, -0.1, 28],
  [400, 3.6, 5.36, -0.6, 0, 3.62, 0, 28],
  [440, 3.2, 3.88, 1.23, 0, 3.62, -0.05, 26],
  [520, 2.88, 5.8, -1.49, 0, 3.62, -0.05, 26],
  [560, 2.88, 4.12, 2.4, 0, 1.6, 0.6, 34],
  [584, 3, 2.69, 4.6, 0, 0.38, 0.7, 30],
  [650, 1.65, 2.24, 3.85, 0, 0.38, 0.7, 28],
  [720, -2.8, 5.8, -4.3, 0, 3.4, -0.5, 32],
  [760, -2.4, 5.46, -3.55, 0, 3.3, -0.55, 28],
  [840, 2.88, 4.98, -3.79, 0, 3.3, -0.55, 28],
  [880, 1.6, 3.43, 3.36, 0, 3.62, 0.8, 38],
  [900, 2.1, 3.0, 4.6, 0, 3.62, 0.8, 40],
  [1000, 1.0, 4.1, 3.7, 0, 3.62, 0.7, 44],
  [1040, 1.6, 3.5, 4.4, 0, 3.62, 0.7, 40],
  [1082, 5.6, 4.6, 8.4, 0, 2.3, 0, 40],
  [1120, 4.8, 5, 8.8, 0, 2.3, 0, 40],
  [1200, -5.4, 4.8, 8.6, 0, 2.3, 0, 40],
];
function camAt(f: number) {
  let i = 0;
  while (i < KEYS.length - 2 && f >= KEYS[i + 1][0]) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  let t = clamp((f - k1[0]) / (k2[0] - k1[0]));
  if (i === 0) t = ease(t);
  const out: number[] = [];
  for (let j = 1; j < 8; j++) {
    const p0 = k0[j], p1 = k1[j], p2 = k2[j], p3 = k3[j];
    out.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t));
  }
  return out;
}

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

export class FanScene {
  renderer: THREE.WebGLRenderer;
  rt: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, RW / RH, 0.1, 40);
  post: THREE.Mesh;
  postScene = new THREE.Scene();
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 10);
  head = new THREE.Group();
  motor = new THREE.Group();
  rotor = new THREE.Group();
  blades = new THREE.Group();
  ghosts: THREE.Group[] = [];
  blurDisc!: THREE.Mesh;
  coils: THREE.Mesh[] = [];
  gear = new THREE.Group();
  crank = new THREE.Group();
  rod!: THREE.Mesh;
  air!: THREE.InstancedMesh;
  airSeed: number[][] = [];
  rings: THREE.Mesh[] = [];
  buttons: THREE.Mesh[] = [];
  pts: Record<string, THREE.Object3D> = {};
  grad: THREE.DataTexture;

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
    this.post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      vertexShader: POST_VS, fragmentShader: POST_FS,
      uniforms: {tColor: {value: this.rt.texture}, tDepth: {value: this.rt.depthTexture}, res: {value: new THREE.Vector2(RW, RH)}, cNear: {value: 0.1}, cFar: {value: 40}},
    }));
    this.postScene.add(this.post);
    this.build();
  }

  mat(c: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) { return new THREE.MeshToonMaterial({color: c, gradientMap: this.grad, ...o}); }
  mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, p: number[] = [0, 0, 0], r: number[] = [0, 0, 0]) {
    const x = new THREE.Mesh(g, m);
    x.position.set(p[0], p[1], p[2]); x.rotation.set(r[0], r[1], r[2]);
    parent.add(x);
    return x;
  }
  rodBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, parent: THREE.Object3D) {
    const len = a.distanceTo(b);
    const x = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), m);
    x.position.copy(a).add(b).multiplyScalar(0.5);
    x.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    parent.add(x);
    return x;
  }
  point(name: string, parent: THREE.Object3D, p: number[]) { const o = new THREE.Object3D(); o.position.set(p[0], p[1], p[2]); parent.add(o); this.pts[name] = o; }

  build() {
    const sc = this.scene, Z = Math.PI / 2;
    sc.background = new THREE.Color('#1a1f3d');
    sc.fog = new THREE.Fog('#1a1f3d', 7, 17);
    sc.add(new THREE.AmbientLight('#8890c0', 0.55));
    const key = new THREE.DirectionalLight('#fff3dc', 1.5); key.position.set(3, 6, 4); sc.add(key);
    const rim = new THREE.DirectionalLight('#7fa0ff', 0.7); rim.position.set(-4, 3, -4); sc.add(rim);
    const cream = this.mat('#f2e2c0'), creamD = this.mat('#cdb894'), steel = this.mat('#9aa6e0'), steelD = this.mat('#4a5280');
    const dark = this.mat('#2d2f45'), copper = this.mat('#e0803a'), grille = this.mat('#c3cbf2'), teal = this.mat('#3ec9a7'), tealD = this.mat('#24806b');
    const clipM = (c: string) => this.mat(c, {clippingPlanes: [this.clip], side: THREE.DoubleSide});

    this.mesh(new THREE.CircleGeometry(30, 48), this.mat('#151a36'), sc, [0, 0, 0], [-Z, 0, 0]);
    // base + buttons + pole
    this.mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.28, 40), cream, sc, [0, 0.14, 0]);
    this.mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.1, 40), creamD, sc, [0, 0.33, 0]);
    for (let i = 0; i < 4; i++) {
      const b = this.mesh(new THREE.BoxGeometry(0.16, 0.08, 0.13), i === 0 ? this.mat('#6b7299') : this.mat('#f2e2c0'), sc, [-0.36 + i * 0.24, 0.39, 0.74]);
      this.buttons.push(b);
    }
    this.point('buttons', sc, [0, 0.42, 0.74]);
    this.mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.0, 16), steel, sc, [0, 1.8, -0.1]);
    this.mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 20), dark, sc, [0, 3.15, -0.1], [Z, 0, 0]);
    // head (oscillates around the neck)
    this.head.position.set(0, 3.3, -0.1);
    sc.add(this.head);
    this.mesh(new THREE.SphereGeometry(0.13, 16, 12), dark, this.head);
    this.motor.position.y = 0.32;
    this.head.add(this.motor);
    const M = this.motor;
    this.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 36), clipM('#f2e2c0'), M, [0, 0, 0.05], [Z, 0, 0]);
    this.mesh(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), clipM('#f2e2c0'), M, [0, 0, -0.3], [-Z, 0, 0]);
    this.mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.05, 36), clipM('#cdb894'), M, [0, 0, 0.41], [Z, 0, 0]);
    this.mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.46, 32, 1, true), clipM('#3a4172'), M, [0, 0, 0.05], [Z, 0, 0]);
    // stator: 8 coils
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const c = this.mesh(new THREE.BoxGeometry(0.1, 0.12, 0.42), this.mat('#e0803a', {clippingPlanes: [this.clip], emissive: new THREE.Color('#000000')}), M, [Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.05], [0, 0, a]);
      this.coils.push(c);
    }
    this.point('coil', M, [0.28, 0, 0.05]);
    // rotor (squirrel cage) + shaft + worm
    M.add(this.rotor);
    this.mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 24), steel, this.rotor, [0, 0, 0.05], [Z, 0, 0]);
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; this.mesh(new THREE.BoxGeometry(0.035, 0.035, 0.44), steelD, this.rotor, [Math.cos(a) * 0.162, Math.sin(a) * 0.162, 0.05]); }
    for (const z of [-0.17, 0.27]) this.mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 24), copper, this.rotor, [0, 0, z]);
    this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.55, 10), this.mat('#e8ecff'), this.rotor, [0, 0, 0.12], [Z, 0, 0]);
    const hp: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) { const t = i / 64, a = t * Math.PI * 2 * 4; hp.push(new THREE.Vector3(Math.cos(a) * 0.045, Math.sin(a) * 0.045, -0.62 + t * 0.18)); }
    this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 64, 0.014, 5), this.mat('#ffd23f'), this.rotor);
    this.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), this.mat('#c2950f'), this.rotor, [0, 0, -0.53], [Z, 0, 0]);
    this.point('rotor', M, [0, 0.17, 0.12]);
    this.point('shaft', M, [0, 0, 0.62]);
    this.point('worm', M, [0, 0.05, -0.53]);
    // gear (crown wheel, vertical axis) meshing with the worm + output crank below
    this.gear.position.set(0.13, 0, -0.53);
    M.add(this.gear);
    this.mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.035, 24), this.mat('#ff6b35'), this.gear);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; this.mesh(new THREE.BoxGeometry(0.03, 0.035, 0.02), this.mat('#ff6b35'), this.gear, [Math.cos(a) * 0.095, 0, Math.sin(a) * 0.095], [0, -a, 0]); }
    this.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 8), this.mat('#e8ecff'), this.gear, [0, -0.27, 0]);
    this.point('gear', M, [0.13, 0.02, -0.53]);
    this.crank.position.set(0.13, -0.55, -0.53);
    M.add(this.crank);
    this.mesh(new THREE.BoxGeometry(0.2, 0.03, 0.05), this.mat('#ffd23f'), this.crank, [0.08, 0, 0]);
    this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), dark, this.crank, [0.17, -0.03, 0]);
    this.mesh(new THREE.BoxGeometry(0.34, 0.12, 0.3), clipM('#cdb894'), M, [0.1, -0.5, -0.53]);
    this.rod = this.mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), this.mat('#ffd23f'), sc);
    this.pts.rod = this.rod;
    // capacitor under the housing
    this.mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 16), dark, M, [-0.28, -0.4, 0.15], [Z, 0, 0]);
    this.mesh(new THREE.CylinderGeometry(0.077, 0.077, 0.04, 16), this.mat('#e6e9ff'), M, [-0.28, -0.4, 0.15], [Z, 0, 0]);
    this.point('capacitor', M, [-0.28, -0.4, 0.15]);
    // hub + blades
    this.blades.position.z = 0.78;
    M.add(this.blades);
    const shape = new THREE.Shape();
    shape.moveTo(0.14, -0.09);
    shape.bezierCurveTo(0.55, -0.34, 1.1, -0.34, 1.22, -0.02);
    shape.bezierCurveTo(1.22, 0.24, 0.7, 0.3, 0.14, 0.09);
    shape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(shape, {depth: 0.02, bevelEnabled: false, curveSegments: 16});
    const makeBlades = (m: THREE.Material) => {
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const arm = new THREE.Group(); arm.rotation.z = (k / 3) * Math.PI * 2; g.add(arm);
        const b = new THREE.Mesh(bladeGeo, m); b.rotation.x = 0.5; arm.add(b);
      }
      return g;
    };
    this.blades.add(makeBlades(teal));
    for (let i = 0; i < 2; i++) {
      const g = makeBlades(new THREE.MeshBasicMaterial({color: '#7fe6cc', transparent: true, opacity: 0.25, depthWrite: false}));
      this.blades.add(g); this.ghosts.push(g);
    }
    this.mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.16, 24), tealD, this.blades, [0, 0, 0], [Z, 0, 0]);
    this.mesh(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), teal, this.blades, [0, 0, 0.08], [Z, 0, 0]);
    this.blurDisc = this.mesh(new THREE.CircleGeometry(1.23, 48), new THREE.MeshBasicMaterial({color: '#9ff0dc', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide}), M, [0, 0, 0.79]);
    this.point('blade', this.blades.children[0].children[0].children[0], [0.85, 0, 0]);
    // grille: rear rings, front dome rings, rim, spokes, badge
    const G = new THREE.Group(); M.add(G);
    for (const r of [0.55, 0.85, 1.15]) this.mesh(new THREE.TorusGeometry(r, 0.012, 4, 64), grille, G, [0, 0, 0.55]);
    const dome = (r: number) => 1.08 - 0.28 * (r / 1.4) * (r / 1.4);
    for (const r of [0.3, 0.55, 0.8, 1.05, 1.3]) this.mesh(new THREE.TorusGeometry(r, 0.012, 4, 64), grille, G, [0, 0, dome(r)]);
    this.mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 64, 1, true), this.mat('#c3cbf2', {side: THREE.DoubleSide}), G, [0, 0, 0.78], [Z, 0, 0]);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let j = 0; j < 4; j++) {
        const r0 = 0.2 + j * 0.3, r1 = r0 + 0.3;
        this.rodBetween(new THREE.Vector3(c * r0, s * r0, dome(r0)), new THREE.Vector3(c * r1, s * r1, dome(Math.min(1.4, r1))), 0.01, grille, G);
      }
      this.rodBetween(new THREE.Vector3(c * 0.4, s * 0.4, 0.55), new THREE.Vector3(c * 1.4, s * 1.4, 0.72), 0.01, grille, G);
    }
    this.mesh(new THREE.CircleGeometry(0.2, 24), this.mat('#ff6b35'), G, [0, 0, 1.085]);
    this.mesh(new THREE.CircleGeometry(0.12, 24), this.mat('#f2e2c0'), G, [0, 0, 1.09]);
    this.point('grille', G, [1.0, -0.9, 0.9]);
    this.point('air', M, [0.5, 0.25, 2.2]);
    this.point('low', M, [0.0, 0.75, 0.45]);
    this.point('high', M, [0.0, -0.55, 1.6]);
    // air particles (in the head frame so they follow the oscillation)
    const N = 200;
    this.air = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.022, 0.06), new THREE.MeshBasicMaterial({color: '#d8efff', transparent: true, opacity: 0.6, depthWrite: false}), N);
    M.add(this.air);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < N; i++) this.airSeed.push([Math.sqrt(rnd()) * 1.25 + 0.12, rnd() * Math.PI * 2, rnd()]);
    // pressure rings for the slow-motion
    for (let i = 0; i < ringHits.length; i++) {
      const r = this.mesh(new THREE.TorusGeometry(1, 0.04, 4, 48), new THREE.MeshBasicMaterial({color: '#e8f6ff', transparent: true, opacity: 0, depthWrite: false}), M, [0, 0, 1]);
      this.rings.push(r);
    }
  }

  update(f: number) {
    const [px, py, pz, tx, ty, tz, fov] = camAt(f);
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(tx, ty, tz);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    const yaw = oscAmp(f) * Math.sin(OSC[f]);
    this.head.rotation.set(-0.06, yaw, 0);
    this.rotor.rotation.z = ROTOR[f];
    const s = revAt(f), blur = clamp((s - 0.05) / 0.25);
    this.blades.children[0].rotation.z = BLADE[f];
    this.ghosts.forEach((g, i) => { g.visible = blur > 0; g.rotation.z = BLADE[f] - (i + 1) * 0.35; });
    (this.blurDisc.material as THREE.MeshBasicMaterial).opacity = blur * 0.45;
    this.gear.rotation.y = -OSC[f];
    this.crank.rotation.y = -OSC[f];
    // coils: rotating magnetic field in the "field" section, steady glow otherwise
    const lit = f >= S.field && f < S.speeds ? coilIndex(f) : -1;
    this.coils.forEach((c, j) => {
      let e = 0;
      if (lit >= 0) { const age = (((lit - j) % 8) + 8) % 8 * 5 + ((f - S.field) % 5); e = Math.exp(-age / 6) * 1.1; }
      else if (f >= S.motor && f < S.osc) e = f >= S.speeds ? 0.15 + 0.5 * ((revAt(f) * 16 * 1800 - 700) / 500) : 0.18;
      (c.material as THREE.MeshToonMaterial).emissive.setRGB(1.0 * e, 0.75 * e, 0.25 * e);
    });
    if (lit >= 0) { const a = (lit / 8) * Math.PI * 2; this.pts.coil.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.05); }
    // buttons
    let pressed = 0;
    BUTTONS.forEach((b, i) => { if (f >= b && f < S.osc) pressed = i + 1; });
    if (f >= S.osc || f < S.speeds) pressed = 3;
    this.buttons.forEach((b, i) => {
      b.position.y = i === pressed ? 0.36 : 0.39;
      (b.material as THREE.MeshToonMaterial).color.set(i === pressed ? '#ff6b35' : i === 0 ? '#6b7299' : '#f2e2c0');
    });
    // cutaway plane faces away from the camera, through the motor axis
    this.scene.updateMatrixWorld(true);
    const center = new THREE.Vector3(0, 0, -0.1).applyMatrix4(this.motor.matrixWorld);
    const n = center.clone().sub(this.camera.position).normalize();
    const cut = cutAt(f);
    this.clip.setFromNormalAndCoplanarPoint(n, center.clone().addScaledVector(n, -1.2 + 1.25 * cut));
    // link rod: crank pin (moves with head) -> fixed collar on the pole
    const pin = new THREE.Vector3(0.17, -0.03, 0).applyMatrix4(this.crank.matrixWorld);
    const anchor = new THREE.Vector3(0.22, 3.05, 0.05);
    this.rod.position.copy(pin).add(anchor).multiplyScalar(0.5);
    this.rod.scale.set(1, pin.distanceTo(anchor), 1);
    this.rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), anchor.clone().sub(pin).normalize());
    // air flow
    const vis = airVis(f), dummy = new THREE.Object3D(), L = 5.2;
    (this.air.material as THREE.MeshBasicMaterial).opacity = 0.6 * vis;
    this.air.visible = vis > 0.01;
    const stretch = 1 + Math.min(5, Math.min(s, 0.12) * 45);
    this.airSeed.forEach(([r, a, z0], i) => {
      const z = -1.0 + ((((z0 * L + AIR[f] * 14) % L) + L) % L);
      const rr = r * (z < 0.6 ? 0.75 + 0.25 * (z + 1) / 1.6 : 1 + (z - 0.6) * 0.07);
      const ang = a + AIR[f] * 1.5 * (z > 0.6 ? 1 / (1 + (z - 0.6)) : 0.3);
      dummy.position.set(Math.cos(ang) * rr, Math.sin(ang) * rr, z);
      dummy.scale.set(1, 1, stretch);
      dummy.updateMatrix();
      this.air.setMatrixAt(i, dummy.matrix);
    });
    this.air.instanceMatrix.needsUpdate = true;
    // pressure rings (each one = one melody note)
    ringHits.forEach((h, i) => {
      const age = f - h, r = this.rings[i], m = r.material as THREE.MeshBasicMaterial;
      r.visible = age >= 0 && age < 50;
      if (!r.visible) return;
      r.position.z = 0.85 + age * 0.03;
      r.scale.setScalar(0.5 + age * 0.018);
      m.opacity = 0.95 * (1 - age / 50);
    });
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
export {REAL, factorAt};
