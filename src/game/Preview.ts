import * as THREE from 'three';
import { Character, Slime, type Appearance } from './Character';
import type { Job } from '../data/jobs';
import { disposeObject, magicTexture } from './art';
import { Effects } from './Effects';

export class CharacterPreview {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 80);
  private character: Character;
  private dais = new THREE.Group();
  private seal: THREE.Mesh;
  private sealTexture = magicTexture('#be9a55');
  private effects = new Effects();
  private slimes = [new Slime('#eeb1bb'), new Slime('#b4ceae')];
  private abort = new AbortController();
  private raf = 0;
  private previous = 0;
  private time = 0;
  private yaw = .1;
  private rotating = false;
  private startX = 0;
  private startYaw = 0;
  private reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private sparkleTime = 0;
  private resizeObserver: ResizeObserver;

  constructor(private renderer: THREE.WebGLRenderer, private container: HTMLElement, job: Job, appearance: Appearance) {
    this.character = new Character(job, appearance);
    this.scene.add(this.character.group, this.effects.group, this.dais);
    this.camera.position.set(0, 3.3, 8); this.camera.lookAt(0, 1.32, 0);
    this.scene.add(new THREE.HemisphereLight('#fff3d4', '#a6b99a', 2.5));
    const sun = new THREE.DirectionalLight('#fff0ce', 3.4); sun.position.set(-3, 7, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -5; sun.shadow.camera.right = 5; sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -4; sun.shadow.normalBias = .025;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#d7e4ff', .9); fill.position.set(4, 3, -2); this.scene.add(fill);
    const stone = new THREE.MeshStandardMaterial({ color: '#e3dcc7', roughness: 1 });
    for (const [r, y, h] of [[1.88, -.18, .20], [1.72, -.035, .10]]) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r + .04, h, 96), stone); mesh.position.y = y; mesh.receiveShadow = true; mesh.castShadow = true; this.dais.add(mesh);
    }
    for (const radius of [1.64, 1.70, 1.88]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .013, 8, 96), new THREE.MeshStandardMaterial({ color: '#c3a570', roughness: .55, metalness: .2 })); ring.rotation.x = Math.PI / 2; ring.position.y = radius === 1.88 ? -.08 : .021; this.dais.add(ring);
    }
    this.seal = new THREE.Mesh(new THREE.PlaneGeometry(3.13, 3.13), new THREE.MeshBasicMaterial({ map: this.sealTexture, transparent: true, opacity: .58, depthWrite: false }));
    this.seal.rotation.x = -Math.PI / 2; this.seal.position.y = .025; this.dais.add(this.seal);
    this.slimes.forEach((slime, i) => { slime.group.position.set(i === 0 ? 1.07 : -1.32, .018, i === 0 ? .76 : .36); slime.group.scale.setScalar(i === 0 ? .38 : .27); this.scene.add(slime.group); });
    const signal = this.abort.signal;
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; this.rotating = true; this.startX = e.clientX; this.startYaw = this.yaw; canvas.setPointerCapture(e.pointerId); }, { signal });
    canvas.addEventListener('pointermove', e => { if (this.rotating) this.yaw = this.startYaw + (e.clientX - this.startX) * .011; }, { signal });
    const stop = () => this.rotating = false;
    canvas.addEventListener('pointerup', stop, { signal }); canvas.addEventListener('pointercancel', stop, { signal });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }
  setCharacter(job: Job, appearance: Appearance) {
    this.scene.remove(this.character.group); this.character.dispose(); this.character = new Character(job, appearance); this.scene.add(this.character.group);
    this.effects.burst(new THREE.Vector3(0, .4, 0), '#fff0bb', 45, 1.3, 1.8);
    this.yaw = .1;
  }
  rotate(amount: number) { this.yaw += amount; }
  private resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    this.renderer.setSize(width, height); const aspect = width / height;
    const size = width < 500 ? 5.25 : 5.3;
    this.camera.left = -size * aspect / 2; this.camera.right = size * aspect / 2;
    this.camera.top = size / 2; this.camera.bottom = -size / 2; this.camera.updateProjectionMatrix();
  }
  private frame = (now: number) => {
    const dt = this.previous ? Math.min(.05, (now - this.previous) / 1000) : .016; this.previous = now;
    if (!document.hidden) {
      this.time += dt; const t = this.reduceMotion ? 0 : this.time;
      this.character.update(t, dt); this.character.group.rotation.y = this.yaw + (this.rotating ? 0 : Math.sin(t * .34) * .035);
      this.slimes.forEach(s => s.update(t, false, 0, 0, .05)); this.seal.rotation.z = t * .035;
      this.effects.update(dt); this.sparkleTime -= dt;
      if (this.sparkleTime < 0 && !this.reduceMotion) { this.sparkleTime = .25; const a = Math.random() * Math.PI * 2; this.effects.burst(new THREE.Vector3(Math.cos(a) * 1.35, .18, Math.sin(a) * 1.35), '#fff0bd', 1, .11, .5); }
      this.renderer.setClearColor(0x000000, 0); this.renderer.render(this.scene, this.camera);
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  dispose() {
    cancelAnimationFrame(this.raf); this.abort.abort(); this.resizeObserver.disconnect();
    this.character.dispose(); this.slimes.forEach(s => s.dispose()); this.effects.dispose(); this.sealTexture.dispose(); disposeObject(this.dais);
    this.scene.traverse(o => { if (o instanceof THREE.DirectionalLight || o instanceof THREE.SpotLight || o instanceof THREE.PointLight) o.shadow.dispose(); });
    this.scene.clear();
  }
}
