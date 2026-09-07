import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, disposeObject, magicTexture, makeLabel, seeded, toon } from './art';
import { Character } from './Character';
import { getJob } from '../data/jobs';

export type MapId = 0 | 1 | 2;
export interface MapInfo {
  id: MapId; name: string; en: string; subtitle: string; level: string; sky: string;
  grass: string; leaf: string; water: string; accent: string; npcName: string; npcJob: string;
  mobName: string; mobColor: string; mobHp: number; mobAttack: number; mobXp: number;
}
export const MAPS: MapInfo[] = [
  { id: 0, name: '晨曦山谷', en: 'Dawnlight Valley', subtitle: '风带来了青草的味道，也带来了新的故事。', level: 'Lv. 1 — 5', sky: '#d9e8db', grass: '#a4bb75', leaf: '#739b59', water: '#7ac6c0', accent: '#d8b56e', npcName: '莉露', npcJob: 'acolyte', mobName: '软糖波利', mobColor: '#f2a8b5', mobHp: 52, mobAttack: 11, mobXp: 22 },
  { id: 1, name: '萤语森林', en: 'Whispering Woods', subtitle: '跟随萤火的微光，听一听森林的心事。', level: 'Lv. 4 — 9', sky: '#c7dedd', grass: '#8cab89', leaf: '#567f75', water: '#7bbac8', accent: '#b0ace2', npcName: '菲恩', npcJob: 'hunter', mobName: '露珠波利', mobColor: '#9bcdbb', mobHp: 112, mobAttack: 17, mobXp: 38 },
  { id: 2, name: '星落遗迹', en: 'Starfall Sanctuary', subtitle: '旧日的星光，仍在等待一位勇敢的旅人。', level: 'Lv. 7 — 12', sky: '#e9e0d4', grass: '#b7bb87', leaf: '#a49a8a', water: '#a7bbd4', accent: '#d7ad78', npcName: '星语者', npcJob: 'sage', mobName: '星光波利', mobColor: '#c7b3de', mobHp: 160, mobAttack: 21, mobXp: 50 },
];
export interface Obstacle { x: number; z: number; radius: number }
export interface Portal { group: THREE.Group; x: number; z: number; to: MapId; north: boolean }
export interface Chest { id: string; group: THREE.Group; lid: THREE.Group; x: number; z: number; opened: boolean }
export interface Spawn { x: number; z: number; boss?: boolean }

const UP = new THREE.Vector3(0, 1, 0);
const RUINS_ARENA = { z: -16, radius: 7.9, height: .52 };
const mobLocations = [[-7, 19], [7, 19], [-10, 13], [10, 13], [-7, 8], [13, 20], [-8, -6], [7, -7], [-12, -14], [10, -17], [-7, -22], [15, -6]];

export class World {
  readonly root = new THREE.Group();
  readonly ground: THREE.Mesh;
  readonly obstacles: Obstacle[] = [];
  readonly portals: Portal[] = [];
  readonly chests: Chest[] = [];
  readonly spawns: Spawn[] = [];
  readonly trees: { x: number; z: number; size: number; height: number }[] = [];
  readonly npc: Character;
  readonly npcPosition = new THREE.Vector3(-5.1, 0, 22);
  readonly map: MapInfo;
  private random: () => number;
  private textures = new Set<THREE.Texture>();
  private waterMaterial?: THREE.ShaderMaterial;
  private portalMaterials: THREE.ShaderMaterial[] = [];
  private magicalCircles: THREE.Mesh[] = [];
  private windmills: THREE.Group[] = [];
  private butterflies: { root: THREE.Group; wings: THREE.Mesh[]; x: number; z: number; phase: number }[] = [];
  private fireflies?: THREE.Points;
  private instancedLeaves?: THREE.InstancedMesh;
  private canopyAlpha?: THREE.InstancedBufferAttribute;
  private sightDirection = new THREE.Vector3();
  private sightOffset = new THREE.Vector3();
  private heroSight = new THREE.Vector3();
  private targetSight = new THREE.Vector3();
  private leafMatrices: THREE.Matrix4[] = [];
  private batchedSources = new Set<THREE.BufferGeometry>();
  private elapsed = 0;
  private groundTexture: THREE.Texture;
  private matCache = new Map<string, THREE.Material>();
  private sphere = new THREE.IcosahedronGeometry(1, 2);
  private cube = new THREE.BoxGeometry(1, 1, 1);
  private cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);

  constructor(id: MapId, openedChests: string[] = []) {
    this.map = MAPS[id]; this.random = seeded(11037 + id * 470);
    this.root.name = `world-${id}`;
    this.groundTexture = this.makeGroundTexture();
    this.ground = this.buildGround();
    this.root.add(this.ground);
    this.buildPath();
    if (id < 2) this.buildRiver();
    if (id === 0) this.buildVillage();
    else if (id === 1) this.buildForestCamp();
    else this.buildRuins();
    this.addPortal(true, id < 2 ? (id + 1) as MapId : undefined);
    this.addPortal(false, id > 0 ? (id - 1) as MapId : undefined);
    for (const [i, [x, z]] of [[-16, 12], [15, -16]].entries()) this.addChest(`${id}-${i}`, x, z, openedChests.includes(`${id}-${i}`));
    this.npc = new Character(getJob(this.map.npcJob), { hair: id === 1 ? '#a2a0ba' : '#d3b47f', style: 2, feminine: id !== 2 }, false);
    this.npc.group.scale.setScalar(.75); this.npcPosition.y = this.heightAt(this.npcPosition.x, this.npcPosition.z);
    this.npc.group.position.copy(this.npcPosition); this.npc.group.rotation.y = .35; this.root.add(this.npc.group);
    const label = makeLabel(`${id === 0 ? '向导' : id === 1 ? '林间信使' : '遗迹守望者'} · ${this.map.npcName}`, '#fff4cc', .54);
    label.position.copy(this.npcPosition).add(new THREE.Vector3(0, 2.75, 0)); this.root.add(label);
    const quest = makeLabel('!', '#ffe19c', .8); quest.position.copy(this.npcPosition).add(new THREE.Vector3(0, 3.32, 0)); this.root.add(quest); quest.name = 'quest-mark';
    this.obstacles.push({ x: this.npcPosition.x, z: this.npcPosition.z, radius: .5 });
    this.buildTrees(); this.buildRocks(); this.buildMeadow(); this.buildDistance(); this.buildButterflies();
    for (const [x, z] of mobLocations) {
      const p = this.nearestWalkable(x, z); this.spawns.push({ x: p.x, z: p.y });
    }
    if (id === 2) this.spawns.push({ x: this.pathX(RUINS_ARENA.z), z: RUINS_ARENA.z, boss: true });
    this.batchScenery();
  }

  pathX(z: number) { return Math.sin(z * .113) * 3.5; }
  riverZ(x: number) { return 3 + Math.sin(x * .14) * 1.8; }
  heightAt(x: number, z: number) {
    const edge = Math.max(Math.abs(x) - 24, Math.abs(z) - 32, 0);
    let h = .12 + Math.sin(x * .14) * Math.cos(z * .18) * .17 + Math.sin(z * .21) * .12;
    h += Math.pow(edge / 8, 1.4) * 1.6;
    if (this.map.id < 2) {
      const d = Math.abs(z - this.riverZ(x));
      if (d < 3.2) h = THREE.MathUtils.lerp(-.57, h, THREE.MathUtils.smoothstep(d, 1.75, 3.2));
    }
    if (this.map.id === 2) {
      const d = Math.hypot(x - this.pathX(RUINS_ARENA.z), z - RUINS_ARENA.z);
      if (d < RUINS_ARENA.radius + .1) h = .36;
    }
    return h;
  }
  walkHeight(x: number, z: number) {
    if (this.map.id === 2 && Math.hypot(x - this.pathX(RUINS_ARENA.z), z - RUINS_ARENA.z) < RUINS_ARENA.radius) return RUINS_ARENA.height;
    if (this.map.id < 2 && Math.abs(x - this.pathX(3)) < 2.3 && z > -1.6 && z < 8) {
      const f = THREE.MathUtils.clamp((z + 1.6) / 9.6, 0, 1);
      return .19 + Math.sin(f * Math.PI) * .37;
    }
    return this.heightAt(x, z);
  }
  isWalkable(x: number, z: number, margin = .28) {
    if (Math.abs(x) > 31.5 || Math.abs(z) > 31.6) return false;
    if (this.map.id < 2 && Math.abs(z - this.riverZ(x)) < 2.65 && Math.abs(x - this.pathX(3)) > 1.72) return false;
    for (const o of this.obstacles) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.radius + margin) ** 2) return false;
    return true;
  }
  nearestWalkable(x: number, z: number) {
    x = THREE.MathUtils.clamp(x, -31, 31); z = THREE.MathUtils.clamp(z, -31, 31);
    if (this.isWalkable(x, z)) return new THREE.Vector2(x, z);
    for (let r = .5; r < 12; r += .5) for (let i = 0; i < 24; i++) {
      const nx = x + Math.sin(i / 24 * Math.PI * 2) * r; const nz = z + Math.cos(i / 24 * Math.PI * 2) * r;
      if (this.isWalkable(nx, nz)) return new THREE.Vector2(nx, nz);
    }
    return new THREE.Vector2(this.pathX(24), 24);
  }

  private mat(color: string, rough = true) {
    if (!this.matCache.has(color)) this.matCache.set(color, rough ? new THREE.MeshStandardMaterial({ color, roughness: .95 }) : toon(color));
    return this.matCache.get(color)!;
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
    const mesh = new THREE.Mesh(geometry, this.mat(color)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    return this.mesh(parent, this.cube, color, x, y, z, sx, sy, sz);
  }
  private ball(parent: THREE.Object3D, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    return this.mesh(parent, this.sphere, color, x, y, z, sx, sy, sz);
  }
  private beam(parent: THREE.Object3D, color: string, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
    const m = this.mesh(parent, this.cylinder, color, ...from.clone().add(to).multiplyScalar(.5).toArray(), radius, from.distanceTo(to), radius);
    m.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize()); return m;
  }
  private makeGroundTexture() {
    const random = seeded(123);
    const texture = canvasTexture(512, 512, ctx => {
      ctx.fillStyle = '#f0efdc'; ctx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 26000; i++) {
        const x = random() * 512; const y = random() * 512; const a = random();
        ctx.fillStyle = a > .55 ? `rgba(255,255,234,${.15 + random() * .3})` : `rgba(133,138,105,${.025 + random() * .075})`;
        ctx.fillRect(x, y, random() * 3 + 1, random() * 4 + 1);
      }
      for (let i = 0; i < 1700; i++) {
        ctx.strokeStyle = 'rgba(126,140,94,.08)'; ctx.lineWidth = .6;
        const x = random() * 512; const y = random() * 512;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 7 - 3, y - random() * 7); ctx.stroke();
      }
    });
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(16, 16); texture.anisotropy = 4;
    this.textures.add(texture); return texture;
  }
  private buildGround() {
    const geometry = new THREE.PlaneGeometry(96, 96, 112, 112); geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position; const colors = new Float32Array(pos.count * 3);
    const color = new THREE.Color(this.map.grass); const dark = new THREE.Color(this.map.id === 1 ? '#709a78' : '#86a363');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i); pos.setY(i, this.heightAt(x, z));
      const f = (Math.sin(x * .35 + Math.sin(z * .15)) * Math.cos(z * .32) + 1) * .24 + this.random() * .1;
      const c = color.clone().lerp(dark, f); colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#ffffff', map: this.groundTexture, vertexColors: true, roughness: 1 }));
    ground.receiveShadow = true; ground.name = 'walkable-ground'; return ground;
  }
  private buildPath() {
    const vertices: number[] = []; const colors: number[] = []; const indices: number[] = [];
    const base = new THREE.Color(this.map.id === 2 ? '#d9cfb2' : '#ddd0a5');
    const edge = new THREE.Color(this.map.grass);
    const steps = 150; const across = 8;
    for (let i = 0; i <= steps; i++) {
      const z = -35 + i / steps * 70;
      for (let j = 0; j <= across; j++) {
        const f = j / across * 2 - 1;
        const x = this.pathX(z) + f * (2.1 + Math.sin(z * .35) * .24);
        const y = this.heightAt(x, z) + .037;
        vertices.push(x, y, z);
        const c = base.clone().lerp(edge, Math.pow(Math.abs(f), 6) * .8).multiplyScalar(.96 + this.random() * .07);
        colors.push(c.r, c.g, c.b);
        if (i < steps && j < across) { const a = i * (across + 1) + j; indices.push(a, a + across + 1, a + 1, a + 1, a + across + 1, a + across + 2); }
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const path = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })); path.receiveShadow = true; this.root.add(path);
    const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.04, .10, 6), this.mat('#d6cfb2'), 48);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 48; i++) {
      const z = 24 - i * .49; const x = this.pathX(z) + (this.random() - .5) * 2.3;
      dummy.position.set(x, this.heightAt(x, z) + .05, z); dummy.rotation.y = this.random() * 6;
      dummy.scale.set(.2 + this.random() * .34, .6, .2 + this.random() * .2); dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
    }
    stones.receiveShadow = true; this.root.add(stones);
  }

  private buildRiver() {
    const vertices: number[] = []; const uvs: number[] = []; const indices: number[] = [];
    for (let i = 0; i <= 100; i++) {
      const x = -48 + i * .96; const z = this.riverZ(x);
      vertices.push(x, -.08, z - 2.7, x, -.08, z + 2.7); uvs.push(i / 8, 0, i / 8, 1);
      if (i < 100) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.waterMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(this.map.water) } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        void main(){float wave=sin(vUv.x*30.+vUv.y*14.-uTime*1.5)*sin(vUv.x*9.-vUv.y*21.+uTime*.65);
        float shine=smoothstep(.73,.98,wave);float edge=smoothstep(.34,.5,abs(vUv.y-.5));
        vec3 col=mix(uColor*.80,uColor*1.12,vUv.y*.35+.35)+shine*.15+edge*.17;
        gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include', ';\n#include'),
      side: THREE.DoubleSide,
    });
    const water = new THREE.Mesh(geometry, this.waterMaterial); this.root.add(water);
    const bridge = new THREE.Group(); bridge.position.x = this.pathX(3); this.root.add(bridge);
    const wood = '#b59b72'; const rail = '#917556';
    for (let i = 0; i < 23; i++) {
      const z = -1.5 + i * .42; const f = i / 22;
      this.box(bridge, i % 3 === 0 ? '#bdab80' : wood, 0, .13 + Math.sin(f * Math.PI) * .37, z, 4.1, .15, .39);
    }
    for (const side of [-1, 1]) {
      const posts: THREE.Vector3[] = [];
      for (let i = 0; i < 5; i++) {
        const z = -1.35 + i * 2.23; const y = .15 + Math.sin(i / 4 * Math.PI) * .37;
        this.box(bridge, rail, side * 1.94, y + .52, z, .13, 1.23, .13);
        this.ball(bridge, '#ccb988', side * 1.94, y + 1.17, z, .12, .1, .12);
        posts.push(new THREE.Vector3(side * 1.94, y + 1.02, z));
      }
      for (let i = 0; i < 4; i++) {
        this.beam(bridge, rail, posts[i], posts[i + 1], .06);
        this.beam(bridge, rail, posts[i].clone().add(new THREE.Vector3(0, -.5, 0)), posts[i + 1].clone().add(new THREE.Vector3(0, -.5, 0)), .034);
      }
    }
  }

  private house(x: number, z: number, roof: string, scale = 1, rotation = 0) {
    const group = new THREE.Group(); group.position.set(x, this.heightAt(x, z), z); group.rotation.y = rotation; group.scale.setScalar(scale); this.root.add(group);
    this.box(group, '#dfd9c1', 0, 1.7, 0, 4.5, 3.4, 3.6);
    this.box(group, '#ad9b7b', 0, .18, 0, 4.8, .36, 3.8);
    for (const side of [-1, 1]) {
      this.box(group, '#92775a', side * 2.17, 1.65, 1.85, .16, 3.15, .13);
      this.box(group, '#92775a', side * 2.17, 1.65, -1.82, .16, 3.15, .13);
      const roofSide = this.box(group, roof, side * 1.28, 4.1, 0, 3.22, .17, 4.4); roofSide.rotation.z = side * -.55;
      for (let row = 0; row < 6; row++) {
        const ridge = this.box(group, new THREE.Color(roof).multiplyScalar(.90).getStyle(), side * (.18 + row * .46), 4.91 - row * .28, 0, .055, .06, 4.44); ridge.rotation.z = side * -.55;
      }
      this.box(group, '#668b88', side * 1.42, 1.86, 1.823, .75, .94, .06);
      this.box(group, '#ddc595', side * 1.42, 1.86, 1.879, .045, 1.05, .07);
      this.box(group, '#ddc595', side * 1.42, 1.86, 1.879, .84, .045, .07);
      this.box(group, '#9a7a57', side * 1.42, 1.24, 2.03, .96, .24, .30);
      for (let j = 0; j < 4; j++) this.ball(group, '#85a368', side * 1.42 - .32 + j * .21, 1.45, 2.04, .18, .19, .16);
      for (let j = 0; j < 3; j++) this.ball(group, '#e8b0b2', side * 1.42 - .25 + j * .23, 1.57, 2.06, .065, .075, .065);
    }
    const gable = new THREE.Shape(); gable.moveTo(-2.25, 0); gable.lineTo(0, 1.43); gable.lineTo(2.25, 0); gable.closePath();
    for (const zi of [-1.8, 1.8]) {
      const mesh = this.mesh(group, new THREE.ShapeGeometry(gable), '#e2d6b9', 0, 3.4, zi); mesh.material = new THREE.MeshStandardMaterial({ color: '#e2d6b9', roughness: 1, side: THREE.DoubleSide });
    }
    this.box(group, '#785d42', 0, 1.05, 1.833, .95, 2.1, .06);
    this.box(group, '#b89565', 0, 2.15, 1.94, 1.16, .13, .23);
    this.ball(group, '#dac38e', .28, 1.04, 1.91, .047, .047, .047);
    this.box(group, '#a7997d', 0, .11, 2.06, 1.5, .20, .6);
    this.box(group, '#c1b49b', 1.28, 4.95, -.60, .57, 1.70, .55);
    this.box(group, '#988b70', 1.28, 5.82, -.60, .76, .18, .71);
    this.obstacles.push({ x, z, radius: 3.05 * scale });
    return group;
  }
  private fence(x: number, z: number, length: number, rotate = 0) {
    const group = new THREE.Group(); group.position.set(x, this.heightAt(x, z), z); group.rotation.y = rotate; this.root.add(group);
    const n = Math.ceil(length / 1.8);
    for (let i = 0; i <= n; i++) {
      this.box(group, '#b3a27a', i / n * length, .59, 0, .12, 1.22, .13);
      this.mesh(group, new THREE.ConeGeometry(.11, .15, 4), '#c6b58b', i / n * length, 1.27, 0);
    }
    for (const y of [.38, .9]) this.box(group, '#cab98d', length / 2, y, 0, length, .12, .07);
  }
  private buildVillage() {
    this.house(-13, 25, '#a77464', 1.02, .14);
    this.house(-20, 19, '#688e9b', .79, -.22);
    this.fence(-17, 18, 7); this.fence(7, 25, 10, -.12);
    const stall = new THREE.Group(); stall.position.set(-8.8, this.heightAt(-8.8, 20), 20); this.root.add(stall);
    for (const x of [-1.3, 1.3]) this.box(stall, '#9f8460', x, 1.2, 0, .12, 2.5, .12);
    this.box(stall, '#aa8962', 0, .86, .1, 2.8, .2, 1.2);
    for (let i = 0; i < 7; i++) {
      const awning = this.box(stall, i % 2 ? '#fcf1ce' : '#89a7a0', -1.2 + i * .4, 2.3, .1, .4, .085, 1.8); awning.rotation.x = .13;
      this.box(stall, i % 2 ? '#fcf1ce' : '#89a7a0', -1.2 + i * .4, 2.16, 1.0, .4, .24, .07);
    }
    for (let i = 0; i < 6; i++) {
      this.mesh(stall, new THREE.CylinderGeometry(.075, .11, .20, 12), i % 2 ? '#bc8689' : '#86afb6', -.98 + i * .37, 1.07, .32);
      this.mesh(stall, new THREE.CylinderGeometry(.045, .045, .075, 8), '#ceb78d', -.98 + i * .37, 1.21, .32);
    }
    this.obstacles.push({ x: -8.8, z: 20, radius: 1.5 });
    this.signpost(3.6, 22, '晨曦山谷');
    const windmill = this.house(24, -12, '#759597', 1.16, -.32);
    const rotor = new THREE.Group(); rotor.position.set(0, 3.8, 2.52); windmill.add(rotor);
    this.ball(rotor, '#c5b592', 0, 0, .11, .22, .22, .22);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Group(); blade.rotation.z = i * Math.PI / 2; rotor.add(blade);
      this.box(blade, '#ad966f', 0, 1.48, 0, .10, 3.0, .10);
      this.box(blade, '#f0e6c7', .36, 1.96, 0, .62, 1.75, .035);
      for (let y = 1.22; y < 2.8; y += .25) this.box(blade, '#c9b48d', .35, y, .025, .66, .033, .033);
    }
    this.windmills.push(rotor);
  }
  private buildForestCamp() {
    this.house(-13, 24, '#698b87', .9, .16);
    this.signpost(4, 23, '循着萤火前行');
    for (const [x, z] of [[-12, -2], [15, 17], [-18, -19], [13, -22]]) {
      const stem = this.mesh(this.root, new THREE.CylinderGeometry(.4, .55, 1.8, 12), '#eadfc6', x, this.heightAt(x, z) + .9, z);
      const cap = this.mesh(this.root, new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#bc9eba', x, stem.position.y + .8, z, 1.8, .85, 1.8);
      for (let j = 0; j < 5; j++) this.ball(cap, '#f0e5d5', Math.sin(j * 2.4) * .57, .58, Math.cos(j * 2.4) * .57, .12, .06, .12);
      this.obstacles.push({ x, z, radius: .7 });
    }
    this.fence(-17, 18, 8, .12);
  }
  private buildRuins() {
    const { z: cz, radius, height } = RUINS_ARENA; const cx = this.pathX(cz);
    // Keep the platform above both the terrain and the path, with decals above its surface.
    this.mesh(this.root, new THREE.CylinderGeometry(radius, radius + .2, .22, 64), '#d7ceb5', cx, height - .11, cz);
    const ring = this.mesh(this.root, new THREE.RingGeometry(7.2, 7.55, 64), '#eee2bd', cx, height + .02, cz); ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
    const circleTexture = magicTexture('#d2b26d'); this.textures.add(circleTexture);
    const seal = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ map: circleTexture, transparent: true, opacity: .34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    seal.rotation.x = -Math.PI / 2; seal.position.set(cx, height + .04, cz); this.root.add(seal); this.magicalCircles.push(seal);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2; const x = cx + Math.cos(a) * 8.6; const z = cz + Math.sin(a) * 8.6;
      if (Math.abs(x - this.pathX(z)) < 3) continue;
      const height = i % 3 === 0 ? 1.6 : 4.7;
      this.mesh(this.root, new THREE.CylinderGeometry(.48, .58, height, 14), '#e5dcc4', x, height / 2 + .2, z);
      this.box(this.root, '#d2c5a8', x, .30, z, 1.3, .36, 1.3);
      this.box(this.root, '#ece0c2', x, height + .18, z, 1.2, .26, 1.2);
      for (let j = 0; j < 8; j++) {
        const r = j / 8 * Math.PI * 2; this.mesh(this.root, new THREE.CylinderGeometry(.035, .04, height * .82, 5), '#cec3a7', x + Math.sin(r) * .51, height / 2 + .25, z + Math.cos(r) * .51);
      }
      this.obstacles.push({ x, z, radius: .72 });
    }
    for (const [x, z] of [[-16, 14], [12, 18], [-11, -8], [17, -2], [-16, -21]]) {
      const crystal = this.mesh(this.root, new THREE.ConeGeometry(.5, 2.2, 5), '#b8bfd7', x, this.heightAt(x, z) + 1.1, z); crystal.rotation.z = .22;
      this.mesh(this.root, new THREE.ConeGeometry(.27, 1.1, 5), '#d3b7cb', x + .6, this.heightAt(x, z) + .5, z + .3).rotation.z = -.3;
      this.obstacles.push({ x, z, radius: .6 });
    }
    this.signpost(4, 23, '旧日星光，仍未熄灭');
  }
  private signpost(x: number, z: number, text: string) {
    const group = new THREE.Group(); group.position.set(x, this.heightAt(x, z), z); this.root.add(group);
    this.box(group, '#9d8462', 0, .9, 0, .16, 1.8, .16);
    this.box(group, '#cab28a', 0, 1.63, 0, 1.65, .45, .15);
    const label = makeLabel(text, '#fff1ce', .20); label.position.set(0, 1.64, .12); group.add(label);
    this.ball(group, '#e4d0a3', 0, 1.93, 0, .13, .13, .13);
  }

  private addPortal(north: boolean, to: MapId | undefined) {
    if (to === undefined) return;
    const z = north ? -29 : 29.5; const x = this.pathX(z); const y = this.heightAt(x, z);
    const group = new THREE.Group(); group.position.set(x, y, z); if (!north) group.rotation.y = Math.PI; this.root.add(group);
    this.mesh(group, new THREE.CylinderGeometry(3.25, 3.4, .15, 48), '#d9d1b6', 0, .045, 0);
    for (const side of [-1, 1]) {
      this.box(group, '#d6ccb0', side * 2, 1.4, 0, .65, 2.8, .70);
      this.box(group, '#c0b493', side * 2, .22, 0, .93, .34, .9);
      this.box(group, '#c1b493', side * 2, 2.75, 0, .85, .18, .9);
      this.obstacles.push({ x: x + side * 2, z, radius: .5 });
      this.ball(group, this.map.leaf, side * 2, 2.0, -.25, .52, .70, .5);
    }
    for (let i = 0; i < 11; i++) {
      const a = i / 10 * Math.PI;
      const stone = this.box(group, i % 3 ? '#ddd2b7' : '#c7bba0', Math.cos(a) * 2.02, 2.72 + Math.sin(a) * 1.35, 0, .59, .51, .68);
      stone.rotation.z = a - Math.PI / 2;
    }
    const glow = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(MAPS[to].id === 1 ? '#85c9d0' : '#c0abd9') } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float uTime;uniform vec3 uColor;void main(){vec2 p=vUv-.5;float r=length(p)*2.;float a=atan(p.y,p.x);float spiral=.5+.5*sin(a*4.-r*20.+uTime*1.7);float edge=smoothstep(.55,.98,r)*(1.-smoothstep(.97,1.,r));float opacity=(1.-r)*.18+edge*.76+spiral*.08;gl_FragColor=vec4(mix(uColor,vec3(1.,.98,.85),edge*.6),opacity);}`,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.58, 56), glow); disc.scale.y = 1.16; disc.position.set(0, 1.94, .08); group.add(disc); this.portalMaterials.push(glow);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(1.61, .026, 8, 64), new THREE.MeshBasicMaterial({ color: '#d6f8eb', transparent: true, opacity: .8 })); torus.scale.y = 1.16; torus.position.copy(disc.position); group.add(torus);
    const texture = magicTexture('#91c5c0'); this.textures.add(texture);
    const seal = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.8), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .60, depthWrite: false })); seal.rotation.x = -Math.PI / 2; seal.position.y = .14; group.add(seal); this.magicalCircles.push(seal);
    const label = makeLabel(MAPS[to].name, '#fff5d4', .58); label.position.set(0, 4.75, 0); group.add(label);
    this.portals.push({ group, x, z, to, north });
  }
  private addChest(id: string, x: number, z: number, opened: boolean) {
    const group = new THREE.Group(); group.position.set(x, this.heightAt(x, z), z); group.rotation.y = .15; this.root.add(group);
    this.box(group, '#a87d55', 0, .38, 0, 1.22, .67, .84);
    this.box(group, '#775b46', 0, .15, 0, 1.30, .13, .91);
    for (const side of [-1, 1]) this.box(group, '#d8b771', side * .42, .37, .43, .095, .62, .035);
    this.box(group, '#d5b76f', 0, .52, .45, .22, .25, .08);
    const lid = new THREE.Group(); lid.position.set(0, .72, -.40); group.add(lid);
    this.box(lid, '#b68a5a', 0, .015, .40, 1.29, .17, .90);
    for (const side of [-1, 1]) this.box(lid, '#e0c07b', side * .42, .12, .40, .10, .05, .9);
    if (opened) lid.rotation.x = -1.2;
    const mark = makeLabel('✧', '#ffe4a1', .7); mark.name = 'chest-glint'; mark.position.y = 1.65; mark.visible = !opened; group.add(mark);
    this.chests.push({ id, group, lid, x, z, opened }); this.obstacles.push({ x, z, radius: .75 });
  }

  private buildTrees() {
    const random = this.random;
    const positions: { x: number; z: number; h: number; r: number; color: THREE.Color }[] = [];
    for (let attempt = 0; attempt < 1200 && positions.length < 86; attempt++) {
      const x = (random() - .5) * 76; const z = (random() - .5) * 78;
      if (Math.abs(x - this.pathX(z)) < 7.8 || Math.abs(z - this.riverZ(x)) < 4 && this.map.id < 2) continue;
      if (mobLocations.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 2.5)) continue;
      if (this.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 3)) continue;
      if (this.map.id === 2 && Math.hypot(x - this.pathX(-16), z + 16) < 11) continue;
      if (positions.some(p => Math.hypot(p.x - x, p.z - z) < 3.9)) continue;
      const h = 4.6 + random() * 2.6; const r = 1.7 + random() * .7;
      const color = new THREE.Color(this.map.leaf);
      if (random() < .13) color.set(this.map.id === 0 ? '#d5afa7' : this.map.id === 1 ? '#ada3b9' : '#c6a7ae');
      else color.offsetHSL((random() - .5) * .035, 0, (random() - .5) * .11);
      positions.push({ x, z, h, r, color }); this.trees.push({ x, z, size: r, height: h });
      if (Math.abs(x) < 32 && Math.abs(z) < 32) this.obstacles.push({ x, z, radius: .52 });
    }
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.75, 1, 1, 9), this.mat(this.map.id === 1 ? '#c6c7b1' : '#9b8560'), positions.length * 3);
    const leafGeom = new THREE.IcosahedronGeometry(1, 1);
    const leafPos = leafGeom.attributes.position;
    for (let i = 0; i < leafPos.count; i++) {
      const x = leafPos.getX(i); const y = leafPos.getY(i); const z = leafPos.getZ(i);
      const k = 1 + Math.sin(x * 11 + y * 6 + z * 9) * .045; leafPos.setXYZ(i, x * k, y * k, z * k);
    }
    // Retain the radial normals: recomputing normals on an unindexed polyhedron makes every leaf cluster faceted.
    leafGeom.normalizeNormals();
    this.canopyAlpha = new THREE.InstancedBufferAttribute(new Float32Array(positions.length * 7).fill(1), 1);
    this.canopyAlpha.setUsage(THREE.DynamicDrawUsage); leafGeom.setAttribute('canopyAlpha', this.canopyAlpha);
    const leafMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true });
    leafMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float canopyAlpha;\nvarying float vCanopyAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCanopyAlpha = canopyAlpha;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCanopyAlpha;')
        .replace('#include <opaque_fragment>', 'diffuseColor.a *= vCanopyAlpha;\n#include <opaque_fragment>');
    };
    leafMaterial.customProgramCacheKey = () => 'dreamro-canopy-visibility-v1';
    const leaves = new THREE.InstancedMesh(leafGeom, leafMaterial, positions.length * 7);
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      const y = this.heightAt(p.x, p.z);
      dummy.position.set(p.x, y + p.h * .3, p.z); dummy.rotation.set(.03, random(), .06); dummy.scale.set(.23 + p.r * .08, p.h * .65, .23 + p.r * .07); dummy.updateMatrix(); trunks.setMatrixAt(i * 3, dummy.matrix);
      for (let b = 0; b < 2; b++) {
        const side = b === 0 ? -1 : 1; dummy.position.set(p.x + side * .4, y + p.h * .46, p.z); dummy.rotation.set(0, random(), side * -.62); dummy.scale.set(.11, p.h * .35, .11); dummy.updateMatrix(); trunks.setMatrixAt(i * 3 + b + 1, dummy.matrix);
      }
      for (let j = 0; j < 7; j++) {
        const a = j / 6 * Math.PI * 2;
        const dist = j === 6 ? 0 : p.r * .65;
        dummy.position.set(p.x + Math.cos(a) * dist, y + p.h * .65 + (j === 6 ? p.r * .8 : random() * .4), p.z + Math.sin(a) * dist);
        dummy.rotation.set(random() * .4, random() * 6, random() * .3);
        dummy.scale.set(p.r * (.73 + random() * .19), p.r * (.72 + random() * .21), p.r * (.7 + random() * .21)); dummy.updateMatrix();
        leaves.setMatrixAt(i * 7 + j, dummy.matrix); this.leafMatrices.push(dummy.matrix.clone());
        leaves.setColorAt(i * 7 + j, p.color.clone().offsetHSL(0, 0, (random() - .4) * .10));
      }
    });
    trunks.castShadow = true; trunks.receiveShadow = true; leaves.castShadow = true; leaves.receiveShadow = true;
    this.root.add(trunks, leaves); this.instancedLeaves = leaves;
  }
  private buildRocks() {
    const rock = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.mat('#ffffff'), 104);
    const moss = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), this.mat('#92a36e'), 104);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 104; i++) {
      let x = (this.random() - .5) * 76; let z = (this.random() - .5) * 75;
      if (i < 42 && this.map.id < 2) z = this.riverZ(x) + (i % 2 ? 1 : -1) * (2.7 + this.random() * .7);
      if (Math.abs(x - this.pathX(z)) < 3.1 || this.obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.radius + .8) || mobLocations.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 1.8)) { x = x < 0 ? -34 - this.random() * 5 : 34 + this.random() * 5; }
      const s = .3 + this.random() * .65; const h = s * (.5 + this.random() * .45);
      dummy.position.set(x, this.heightAt(x, z) + h * .42, z); dummy.rotation.set(this.random() * .4, this.random() * 6, this.random() * .3); dummy.scale.set(s, h, s * .8); dummy.updateMatrix(); rock.setMatrixAt(i, dummy.matrix);
      rock.setColorAt(i, new THREE.Color('#c0bda2').offsetHSL(0, 0, this.random() * .12));
      dummy.position.y += h * .67; dummy.scale.set(s * .76, h * .14, s * .60); dummy.updateMatrix(); moss.setMatrixAt(i, dummy.matrix);
      if (s > .66 && Math.abs(x) < 31 && Math.abs(z) < 31) this.obstacles.push({ x, z, radius: s * .75 });
    }
    rock.castShadow = true; rock.receiveShadow = true; moss.receiveShadow = true; this.root.add(rock, moss);
  }
  private buildMeadow() {
    const grassGeometry = new THREE.BufferGeometry();
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-.12, 0, 0, .02, .49, .01, .04, 0, 0, -.03, 0, .06, -.1, .31, .03, .12, 0, -.05, 0, 0, -.09, .09, .4, -.07, 0, 0, .08], 3));
    grassGeometry.computeVertexNormals();
    const grass = new THREE.InstancedMesh(grassGeometry, new THREE.MeshStandardMaterial({ color: this.map.id === 1 ? '#719777' : '#8eaa69', roughness: 1, side: THREE.DoubleSide }), 2300);
    const petals: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2; const petal = new THREE.CircleGeometry(1, 6); petal.rotateX(-Math.PI / 2); petal.scale(.085, 1, .048); petal.rotateY(-a); petal.translate(Math.cos(a) * .07, .32, Math.sin(a) * .07); petals.push(petal);
    }
    const flowerGeometry = mergeGeometries(petals); petals.forEach(p => p.dispose());
    const flowers = new THREE.InstancedMesh(flowerGeometry, this.mat('#ffffff'), 760);
    const centersGeometry = new THREE.CircleGeometry(.036, 6); centersGeometry.rotateX(-Math.PI / 2); centersGeometry.translate(0, .326, 0);
    const centers = new THREE.InstancedMesh(centersGeometry, this.mat('#e2bd69'), 760);
    const dummy = new THREE.Object3D();
    const petalColors = ['#fff8db', '#fffbed', '#e8ceda', '#d4dae7', '#f2df9f'];
    const sample = () => {
      let x = 0, z = 0;
      for (let n = 0; n < 100; n++) {
        x = (this.random() - .5) * 67; z = (this.random() - .5) * 68;
        if (Math.abs(x - this.pathX(z)) > 2.1 && this.isWalkable(x, z, 0) && this.heightAt(x, z) > -.05) break;
      }
      return [x, z];
    };
    for (let i = 0; i < 2300; i++) {
      const [x, z] = sample(); dummy.position.set(x, this.heightAt(x, z), z); dummy.rotation.y = this.random() * 6;
      const s = .45 + this.random() * .7; dummy.scale.set(s, s, s); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < 760; i++) {
      const [x, z] = sample(); dummy.position.set(x, this.heightAt(x, z) + .04, z); dummy.rotation.y = this.random() * 6;
      const s = .75 + this.random() * .9; dummy.scale.setScalar(s); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix); centers.setMatrixAt(i, dummy.matrix); flowers.setColorAt(i, new THREE.Color(petalColors[i % petalColors.length]));
    }
    grass.receiveShadow = true; flowers.receiveShadow = true; this.root.add(grass, flowers, centers);
  }
  private buildDistance() {
    for (let i = 0; i < 22; i++) {
      const a = Math.PI + i / 22 * Math.PI; const r = 75 + this.random() * 18; const h = 7 + this.random() * 13;
      const rock = this.ball(this.root, i % 2 ? '#a5b4a0' : '#98ac9b', Math.cos(a) * r, h * .42, Math.sin(a) * r, 11 + this.random() * 8, h, 10 + this.random() * 8);
      rock.castShadow = false;
      this.ball(this.root, this.map.id === 1 ? '#99b3ae' : '#bbcab8', Math.cos(a) * (r + 13), h * .9, Math.sin(a) * (r + 13), 16, h * 1.3, 15).castShadow = false;
    }
    for (let i = 0; i < 9; i++) {
      const x = -75 + i * 18; const z = -62 - this.random() * 20;
      const cloud = new THREE.Group(); cloud.position.set(x, 25 + this.random() * 12, z); this.root.add(cloud);
      for (let j = 0; j < 4; j++) this.ball(cloud, '#f5f3df', j * 3.2, Math.sin(j) * 2, 0, 5.6, 2.5 + this.random() * 1.5, 3.5).castShadow = false;
    }
  }

  private batchScenery() {
    const dynamic = new Set<THREE.Object3D>([this.npc.group, ...this.chests.map(c => c.group), ...this.windmills, ...this.butterflies.map(b => b.root)]);
    const batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; castShadow: boolean }>();
    this.root.updateMatrixWorld(true);
    const visit = (object: THREE.Object3D) => {
      if (dynamic.has(object)) return;
      for (const child of [...object.children]) visit(child);
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object === this.ground || Array.isArray(object.material)) return;
      if (object.material.transparent || object.material instanceof THREE.ShaderMaterial) return;
      const key = `${object.material.uuid}-${Object.keys(object.geometry.attributes).sort().join(',')}-${object.castShadow}`;
      let batch = batches.get(key);
      if (!batch) { batch = { material: object.material, geometries: [], castShadow: object.castShadow }; batches.set(key, batch); }
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld); batch.geometries.push(geometry); this.batchedSources.add(object.geometry); object.removeFromParent();
    };
    visit(this.root);
    for (const batch of batches.values()) {
      const geometry = mergeGeometries(batch.geometries);
      batch.geometries.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geometry, batch.material); mesh.castShadow = batch.castShadow; mesh.receiveShadow = true; mesh.name = 'batched-scenery'; this.root.add(mesh);
    }
  }
  private buildButterflies() {
    for (let i = 0; i < 12; i++) {
      const x = (this.random() - .5) * 38; const z = (this.random() - .5) * 48;
      const group = new THREE.Group(); group.position.set(x, 1.3, z); this.root.add(group);
      const wings: THREE.Mesh[] = [];
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.CircleGeometry(.13, 12), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? '#f9e1a5' : '#c7e5e7', side: THREE.DoubleSide }));
        wing.scale.set(.75, 1.3, 1); wing.position.x = s * .10; wing.rotation.x = Math.PI / 2; group.add(wing); wings.push(wing);
      }
      this.butterflies.push({ root: group, wings, x, z, phase: this.random() * 9 });
    }
    const pos = new Float32Array(150 * 3); const color = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) { pos[i * 3] = (this.random() - .5) * 60; pos[i * 3 + 1] = .8 + this.random() * 3.5; pos[i * 3 + 2] = (this.random() - .5) * 60; color[i * 3] = 1; color[i * 3 + 1] = .85 + this.random() * .15; color[i * 3 + 2] = .58 + this.random() * .2; }
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geom.setAttribute('color', new THREE.BufferAttribute(color, 3));
    const texture = canvasTexture(64, 64, ctx => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31); g.addColorStop(0, '#ffffff'); g.addColorStop(.2, '#fff5cb'); g.addColorStop(1, 'rgba(255,248,211,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64); }); this.textures.add(texture);
    this.fireflies = new THREE.Points(geom, new THREE.PointsMaterial({ size: this.map.id === 1 ? .25 : .15, map: texture, transparent: true, opacity: .85, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending })); this.root.add(this.fireflies);
  }

  update(time: number, dt: number) {
    this.elapsed += dt;
    this.npc.update(time, dt);
    if (this.waterMaterial) this.waterMaterial.uniforms.uTime.value = time;
    for (const mat of this.portalMaterials) mat.uniforms.uTime.value = time;
    this.magicalCircles.forEach((m, i) => m.rotation.z = time * (i % 2 ? -.035 : .035));
    this.windmills.forEach(m => m.rotation.z = time * .11);
    this.butterflies.forEach(b => {
      b.root.position.set(b.x + Math.sin(time * .36 + b.phase) * 2, 1.4 + Math.sin(time * 1.2 + b.phase) * .4, b.z + Math.cos(time * .24 + b.phase) * 1.3);
      b.root.rotation.y = time * .25 + b.phase;
      b.wings.forEach((w, i) => w.rotation.y = Math.sin(time * 17 + b.phase) * 1.0 * (i ? 1 : -1));
    });
    if (this.fireflies) { this.fireflies.position.y = Math.sin(time * .3) * .3; this.fireflies.rotation.y = Math.sin(time * .045) * .02; }
    const quest = this.root.getObjectByName('quest-mark'); if (quest) quest.position.y = this.npcPosition.y + 3.32 + Math.sin(time * 2.1) * .12;
    for (const c of this.chests) {
      if (c.opened) { c.lid.rotation.x = THREE.MathUtils.damp(c.lid.rotation.x, -1.4, 5, dt); c.group.getObjectByName('chest-glint')!.visible = false; }
      else c.group.getObjectByName('chest-glint')!.position.y = 1.55 + Math.sin(time * 2) * .12;
    }
    if (this.instancedLeaves && this.elapsed > .065) {
      this.elapsed = 0; const matrix = new THREE.Matrix4();
      this.leafMatrices.forEach((base, i) => { matrix.copy(base); matrix.elements[12] += Math.sin(time * 1.1 + base.elements[12] * .2) * .035; this.instancedLeaves!.setMatrixAt(i, matrix); });
      this.instancedLeaves.instanceMatrix.needsUpdate = true;
    }
  }
  updateCanopyVisibility(hero: THREE.Vector3, camera: THREE.Camera, dt: number, target?: THREE.Vector3) {
    if (!this.canopyAlpha) return;
    camera.getWorldDirection(this.sightDirection).negate();
    this.heroSight.copy(hero); this.heroSight.y += 1.45;
    if (target) { this.targetSight.copy(target); this.targetSight.y += .8; }
    let changed = false;
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      const centerY = this.heightAt(tree.x, tree.z) + tree.height * .70;
      const blocks = (focus: THREE.Vector3) => {
        this.sightOffset.set(tree.x - focus.x, centerY - focus.y, tree.z - focus.z);
        const depth = this.sightOffset.dot(this.sightDirection);
        return depth > 0 && this.sightOffset.lengthSq() - depth * depth < (tree.size * 1.6 + .65) ** 2;
      };
      const opacity = blocks(this.heroSight) || target && blocks(this.targetSight) ? .12 : 1;
      const previous = this.canopyAlpha.getX(i * 7);
      const next = THREE.MathUtils.damp(previous, opacity, 9, dt);
      if (Math.abs(next - previous) < .0001) continue;
      for (let j = 0; j < 7; j++) this.canopyAlpha.setX(i * 7 + j, next);
      changed = true;
    }
    if (changed) this.canopyAlpha.needsUpdate = true;
  }
  dispose() {
    this.npc.dispose(); this.textures.forEach(t => t.dispose()); this.textures.clear(); disposeObject(this.root); this.batchedSources.forEach(g => g.dispose()); this.batchedSources.clear(); this.matCache.clear();
  }
}
