import * as THREE from 'three';
import { magicTexture } from './art';

interface Particle { life: number; max: number; velocity: THREE.Vector3; gravity: number }
interface Ring { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; time: number; duration: number; radius: number; fixed: boolean }
interface Bolt { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; time: number; duration: number; color: string }

export class Effects {
  readonly group = new THREE.Group();
  private positions = new Float32Array(700 * 3);
  private colors = new Float32Array(700 * 3);
  private sizes = new Float32Array(700);
  private alphas = new Float32Array(700);
  private particles: Particle[] = Array.from({ length: 700 }, () => ({ life: 0, max: 0, velocity: new THREE.Vector3(), gravity: 0 }));
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private cursor = 0;
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private magicMap = magicTexture('#ffffff');
  constructor() {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixel: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: 'attribute float aSize;attribute float aAlpha;varying vec3 vColor;varying float vAlpha;uniform float uPixel;void main(){vColor=color;vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*uPixel;}',
      fragmentShader: 'varying vec3 vColor;varying float vAlpha;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float a=(1.-smoothstep(.02,.5,d));float star=max(0.,1.-abs(p.x)*25.)*max(0.,1.-abs(p.y)*2.)+max(0.,1.-abs(p.y)*25.)*max(0.,1.-abs(p.x)*2.);gl_FragColor=vec4(vColor,max(a*.6,star*.8)*vAlpha);}',
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(this.geometry, this.material); points.frustumCulled = false; this.group.add(points);
  }
  burst(at: THREE.Vector3, color: string, count = 20, force = 2, upward = 1.5) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor++ % this.particles.length; const p = this.particles[i];
      p.life = p.max = .5 + Math.random() * .65; p.gravity = upward > 0 ? 2.1 : 0;
      p.velocity.set((Math.random() - .5) * force * 2, Math.random() * force * .9 + upward, (Math.random() - .5) * force * 2);
      this.positions.set([at.x, at.y, at.z], i * 3); this.colors.set([c.r, c.g, c.b], i * 3); this.sizes[i] = 7 + Math.random() * 13; this.alphas[i] = 1;
    }
    this.geometry.attributes.color.needsUpdate = this.geometry.attributes.aSize.needsUpdate = true;
  }
  ring(at: THREE.Vector3, color: string, radius = 2, duration = .6, fixed = false, magic = false) {
    const material = new THREE.MeshBasicMaterial({ color, map: magic ? this.magicMap : null, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(magic ? new THREE.PlaneGeometry(2, 2) : new THREE.RingGeometry(.92, 1, 64), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.copy(at); mesh.position.y += .08; mesh.scale.setScalar(fixed ? radius : .2); this.group.add(mesh);
    this.rings.push({ mesh, material, time: 0, duration, radius, fixed });
  }
  projectile(from: THREE.Vector3, to: THREE.Vector3, color: string, duration = .22) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(from); this.group.add(mesh); this.bolts.push({ mesh, from: from.clone(), to: to.clone(), time: 0, duration, color });
  }
  slash(at: THREE.Vector3, color: string, yaw: number) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(.85, .045, 6, 32, Math.PI * 1.3), material);
    mesh.position.copy(at).add(new THREE.Vector3(0, .85, 0)); mesh.rotation.set(.35, yaw, -.6); this.group.add(mesh);
    this.rings.push({ mesh, material, time: 0, duration: .3, radius: 1.3, fixed: false });
  }
  update(dt: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life -= dt; p.velocity.y -= p.gravity * dt;
      this.positions[i * 3] += p.velocity.x * dt; this.positions[i * 3 + 1] += p.velocity.y * dt; this.positions[i * 3 + 2] += p.velocity.z * dt;
      this.alphas[i] = Math.max(0, p.life / p.max);
    }
    this.geometry.attributes.position.needsUpdate = this.geometry.attributes.aAlpha.needsUpdate = true;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.time += dt; const f = r.time / r.duration;
      r.material.opacity = r.fixed ? Math.min(1, (1 - f) * 4) * .6 : (1 - f) * .8;
      r.mesh.scale.setScalar(r.fixed ? r.radius : .2 + f * r.radius); if (r.fixed) r.mesh.rotation.z += dt * .16;
      if (f >= 1) { this.group.remove(r.mesh); r.mesh.geometry.dispose(); r.material.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.time += dt; const f = Math.min(1, b.time / b.duration);
      b.mesh.position.lerpVectors(b.from, b.to, f); this.burst(b.mesh.position, b.color, 1, .18, 0);
      if (f >= 1) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); this.bolts.splice(i, 1); }
    }
  }
  clear() {
    for (const r of this.rings) { this.group.remove(r.mesh); r.mesh.geometry.dispose(); r.material.dispose(); }
    for (const b of this.bolts) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); }
    this.rings = []; this.bolts = []; this.particles.forEach(p => p.life = 0); this.alphas.fill(0); this.geometry.attributes.aAlpha.needsUpdate = true;
  }
  dispose() { this.clear(); this.geometry.dispose(); this.material.dispose(); this.magicMap.dispose(); this.group.clear(); }
}
