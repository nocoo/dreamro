import * as THREE from 'three';
import type { Job, Weapon } from '../data/jobs';
import { canvasTexture, contactShadow, disposeObject, toon } from './art';

export interface Appearance { hair: string; style: number; feminine: boolean }

const faceCache = new Map<string, THREE.CanvasTexture>();
let slimeFace: THREE.CanvasTexture | undefined;
function faceTexture(eyes: string, closed: boolean, feminine: boolean) {
  const key = `${eyes}-${closed}-${feminine}`;
  if (faceCache.has(key)) return faceCache.get(key)!;
  const texture = canvasTexture(512, 512, ctx => {
    const blush = (x: number) => {
      const g = ctx.createRadialGradient(x, 318, 0, x, 318, 43);
      g.addColorStop(0, 'rgba(226,132,125,.5)'); g.addColorStop(1, 'rgba(226,132,125,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, 318, 43, 25, 0, 0, Math.PI * 2); ctx.fill();
    };
    blush(118); blush(392);
    for (const x of [164, 348]) {
      ctx.strokeStyle = '#624538'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 34, 177); ctx.quadraticCurveTo(x, 165, x + 29, 179); ctx.stroke();
      if (closed) {
        ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - 38, 257); ctx.quadraticCurveTo(x, 284, x + 36, 251); ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#fffdf4'; ctx.beginPath(); ctx.ellipse(x, 255, 40, 56, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createLinearGradient(x, 205, x, 306);
      g.addColorStop(0, '#3e373a'); g.addColorStop(.38, eyes); g.addColorStop(1, '#ddbb7b');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + 2, 261, 29, 47, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#302b2d'; ctx.beginPath(); ctx.ellipse(x + 3, 250, 12, 28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#493537'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x - 40, 246); ctx.bezierCurveTo(x - 39, 192, x + 31, 188, x + 41, 240); ctx.stroke();
      if (feminine) { ctx.beginPath(); ctx.moveTo(x - 35, 219); ctx.lineTo(x - 47, 203); ctx.moveTo(x - 29, 211); ctx.lineTo(x - 36, 191); ctx.stroke(); }
      ctx.fillStyle = '#fffef7'; ctx.beginPath(); ctx.ellipse(x - 10, 227, 12, 16, -.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 14, 279, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff1c2'; ctx.beginPath(); ctx.ellipse(x + 2, 294, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(156,98,76,.58)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(254, 300); ctx.lineTo(250, 313); ctx.lineTo(257, 315); ctx.stroke();
    ctx.strokeStyle = '#ad675b'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(235, 355); ctx.quadraticCurveTo(255, 371, 276, 354); ctx.stroke();
    ctx.strokeStyle = '#fff1cf'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(244, 378); ctx.lineTo(264, 378); ctx.stroke();
  });
  faceCache.set(key, texture); return texture;
}

export class Character {
  readonly height: number;
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly head = new THREE.Group();
  readonly rightArm = new THREE.Group();
  readonly leftArm = new THREE.Group();
  readonly rightLeg = new THREE.Group();
  readonly leftLeg = new THREE.Group();
  readonly weaponGroup = new THREE.Group();
  private cape?: THREE.Mesh;
  private capeBase?: Float32Array;
  private faceMaterial: THREE.MeshBasicMaterial;
  private eyesOpen: THREE.Texture;
  private eyesClosed: THREE.Texture;
  private blink = false;
  private mats = new Map<string, THREE.Material>();
  private sphere = new THREE.SphereGeometry(1, 24, 18);
  private cube = new THREE.BoxGeometry(1, 1, 1);
  private timeOffset = Math.random() * 10;
  private ribbons: THREE.Object3D[] = [];

  constructor(readonly job: Job, readonly appearance: Appearance, readonly detailed = true) {
    this.group.name = `character-${job.id}`;
    this.group.add(this.body, contactShadow(1.8, .4));
    const skin = '#f1ccb0';
    const cloth = job.cloth; const trim = job.trim;
    const boots = '#635147'; const hair = appearance.hair;

    this.body.add(this.head, this.rightArm, this.leftArm, this.rightLeg, this.leftLeg);
    this.head.position.y = 2.22;
    this.rightArm.position.set(-.44, 1.6, .01);
    this.leftArm.position.set(.44, 1.6, .01);
    this.rightLeg.position.set(-.2, .94, 0);
    this.leftLeg.position.set(.2, .94, 0);

    this.ellipsoid(this.body, cloth, [0, 1.36, 0], [.39, .48, .27]);
    this.cylinder(this.body, cloth, .36, .47, .49, [0, 1.02, 0]);
    this.cylinder(this.body, trim, .46, .48, .055, [0, .795, 0]);
    this.ellipsoid(this.body, '#f9f2dc', [0, 1.43, .235], [.25, .33, .08]);
    this.box(this.body, trim, [0, 1.4, .313], [.045, .46, .035]);
    this.cylinder(this.body, boots, .375, .4, .105, [0, 1.1, .005]);
    this.box(this.body, '#d6ae60', [0, 1.1, .398], [.19, .16, .055]);
    this.box(this.body, '#624738', [0, 1.1, .434], [.11, .085, .015]);
    this.cylinder(this.body, skin, .14, .15, .18, [0, 1.85, 0]);
    for (const [i, leg] of [this.rightLeg, this.leftLeg].entries()) {
      this.capsule(leg, appearance.feminine ? skin : '#e7dcca', .125, .29, [0, -.19, 0]);
      this.capsule(leg, boots, .145, .23, [0, -.62, 0]);
      this.ellipsoid(leg, boots, [0, -.80, .095], [.165, .13, .25]);
      this.cylinder(leg, trim, .15, .15, .045, [0, -.48, 0]);
      this.box(leg, '#ddc697', [i === 0 ? -.145 : .145, -.57, .025], [.03, .08, .1]);
    }
    for (const arm of [this.leftArm, this.rightArm]) {
      this.ellipsoid(arm, cloth, [0, -.07, 0], [.185, .23, .19]);
      this.capsule(arm, skin, .108, .24, [0, -.35, .015]);
      this.capsule(arm, cloth, .125, .11, [0, -.52, .025]);
      this.cylinder(arm, trim, .13, .13, .04, [0, -.57, .025]);
      this.ellipsoid(arm, skin, [0, -.65, .03], [.13, .14, .12]);
    }
    this.ellipsoid(this.head, skin, [0, 0, 0], [.62, .61, .53]);
    this.ellipsoid(this.head, skin, [-.60, -.035, -.01], [.10, .15, .085]);
    this.ellipsoid(this.head, skin, [.60, -.035, -.01], [.10, .15, .085]);
    this.eyesOpen = faceTexture(job.family === 'mage' ? '#7a649e' : '#659689', false, appearance.feminine);
    this.eyesClosed = faceTexture(job.family === 'mage' ? '#7a649e' : '#659689', true, appearance.feminine);
    this.faceMaterial = new THREE.MeshBasicMaterial({ map: this.eyesOpen, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.09, 1.06), this.faceMaterial);
    face.position.set(0, -.025, .523); this.head.add(face);
    this.makeHair(hair);
    this.makeOutfit();
    this.makeWeapon(job.weapon, this.weaponGroup);
    this.weaponGroup.position.set(0, -.60, .11);
    this.rightArm.add(this.weaponGroup);
    if (['sword', 'dagger', 'axe', 'mace', 'hammer'].includes(job.weapon)) this.weaponGroup.rotation.z = Math.PI - .15;
    else this.weaponGroup.position.y -= .15;
    if (job.weapon === 'bow') this.weaponGroup.rotation.z = -.17;
    if (job.weapon === 'fist') this.weaponGroup.visible = false;
    this.leftArm.rotation.z = -.09;
    this.rightArm.rotation.z = .09;
    this.group.updateMatrixWorld(true);
    this.height = new THREE.Box3().setFromObject(this.group).max.y;
  }

  private material(color: string, metallic = false) {
    const key = `${color}-${metallic}`;
    if (!this.mats.has(key)) this.mats.set(key, metallic
      ? new THREE.MeshStandardMaterial({ color, roughness: .44, metalness: .38 })
      : toon(color));
    return this.mats.get(key)!;
  }

  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, pos: number[], scale?: number[], metallic = false) {
    const mesh = new THREE.Mesh(geometry, this.material(color, metallic));
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  private ellipsoid(parent: THREE.Object3D, color: string, pos: number[], scale: number[]) { return this.mesh(parent, this.sphere, color, pos, scale); }
  private box(parent: THREE.Object3D, color: string, pos: number[], scale: number[], metallic = false) { return this.mesh(parent, this.cube, color, pos, scale, metallic); }
  private cylinder(parent: THREE.Object3D, color: string, r1: number, r2: number, height: number, pos: number[], metallic = false) {
    return this.mesh(parent, new THREE.CylinderGeometry(r1, r2, height, 24), color, pos, undefined, metallic);
  }
  private capsule(parent: THREE.Object3D, color: string, radius: number, length: number, pos: number[]) {
    return this.mesh(parent, new THREE.CapsuleGeometry(radius, length, 6, 12), color, pos);
  }
  private torus(parent: THREE.Object3D, color: string, radius: number, tube: number, pos: number[], metallic = false) {
    return this.mesh(parent, new THREE.TorusGeometry(radius, tube, 8, 40), color, pos, undefined, metallic);
  }
  private shape(parent: THREE.Object3D, color: string, points: number[][], pos: number[], depth = .055) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
    return this.mesh(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 2, steps: 1 }), color, pos);
  }
  private tube(parent: THREE.Object3D, color: string, points: THREE.Vector3[], radius: number) {
    return this.mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, radius, 8, false), color, [0, 0, 0]);
  }

  private makeHair(color: string) {
    const style = this.appearance.style;
    const scalp = new THREE.SphereGeometry(.665, 24, 18, 0, Math.PI * 2, 0, Math.PI * .44);
    this.mesh(this.head, scalp, color, [0, .105, -.02], [1, .92, .92]);
    this.ellipsoid(this.head, color, [0, .06, -.19], [.65, .59, .42]);
    const fringe = [
      [[-.59, .32], [-.44, .54], [-.2, .56], [-.16, .33], [-.38, .05], [-.39, .22], [-.56, -.06]],
      [[-.30, .50], [-.1, .61], [.20, .55], [.27, .40], [.09, .18], [.08, .34], [-.07, .03], [-.12, .30]],
      [[.12, .55], [.41, .53], [.58, .31], [.60, -.09], [.40, .06], [.31, .29], [.26, .10]],
    ];
    fringe.forEach((points, i) => {
      const mesh = this.shape(this.head, color, points, [0, .025, .50]);
      mesh.rotation.y = (i - 1) * .12;
    });
    this.ellipsoid(this.head, new THREE.Color(color).lerp(new THREE.Color('#ffe5ac'), .20).getStyle(), [-.24, .54, .30], [.19, .045, .095]);
    if (style === 1) {
      const tuft = this.mesh(this.head, new THREE.ConeGeometry(.15, .39, 8), color, [.16, .70, 0], [1, 1, .5]);
      tuft.rotation.z = -.8;
      const side = this.shape(this.head, color, [[-.5, .38], [-.63, .29], [-.67, -.34], [-.44, -.16]], [-.02, 0, .27]);
      side.rotation.z = .1;
    }
    if (style === 2 || this.appearance.feminine) {
      for (const side of [-1, 1]) {
        const lock = this.capsule(this.head, color, .145, style === 2 ? .73 : .3, [.58 * side, style === 2 ? -.40 : -.2, -.04]);
        lock.rotation.z = side * -.12;
        this.ribbons.push(lock);
        if (style === 2) {
          this.ellipsoid(this.head, this.job.color, [.62 * side, -.38, .10], [.18, .085, .09]);
          this.shape(this.head, this.job.color, [[0, 0], [-.15, -.22], [-.02, -.18], [.1, -.28]], [.62 * side, -.39, .07]);
        }
      }
    } else {
      for (const side of [-1, 1]) this.shape(this.head, color, [[0, .3], [.15 * side, .22], [.13 * side, -.18], [-.03 * side, -.1]], [.5 * side, -.02, .24]);
    }
  }

  private makeCape(color: string, length = 1.12) {
    const geom = new THREE.PlaneGeometry(1, length, 8, 12);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const f = (length / 2 - pos.getY(i)) / length;
      pos.setX(i, pos.getX(i) * (.62 + f * .53));
      pos.setZ(i, -f * .17 + Math.cos(pos.getX(i) * 6) * f * .04);
    }
    geom.computeVertexNormals();
    const mat = toon(color, { side: THREE.DoubleSide });
    this.cape = new THREE.Mesh(geom, mat);
    this.cape.position.set(0, 1.23, -.32);
    this.cape.castShadow = true; this.body.add(this.cape);
    this.capeBase = new Float32Array(pos.array);
    for (const side of [-1, 1]) this.ellipsoid(this.body, this.job.trim, [.19 * side, 1.68, .22], [.065, .065, .04]);
  }

  private feather(parent: THREE.Object3D, position: number[], color = '#fff3d9') {
    const feather = new THREE.Group(); feather.position.set(...position as [number, number, number]);
    const stem = this.cylinder(feather, this.job.trim, .014, .014, .62, [0, .3, 0]); stem.rotation.z = -.4;
    for (let i = 0; i < 6; i++) {
      const y = .18 + i * .065;
      const leaf = this.ellipsoid(feather, color, [.05 + i * .015, y, 0], [.12 - i * .012, .065, .035]);
      leaf.rotation.z = -.55;
    }
    parent.add(feather); return feather;
  }

  private makeOutfit() {
    const { family, id, trim, cloth } = this.job;
    if (family === 'swordsman') {
      this.makeCape(id === 'crusader' ? '#c46f67' : '#b5706d');
      for (const side of [-1, 1]) {
        const shoulder = this.ellipsoid(side === -1 ? this.rightArm : this.leftArm, '#b5bdc0', [side * .02, .015, 0], [.26, .155, .26]);
        this.ellipsoid(shoulder, trim, [0, .3, .55], [.24, .22, .1]);
      }
      this.shield(this.leftArm, id === 'crusader' ? '#f6e9c6' : '#688eaa', [0, -.43, .26]);
      if (id !== 'swordsman') {
        this.mesh(this.head, new THREE.SphereGeometry(.69, 24, 14, 0, Math.PI * 2, 0, 1.35), id === 'crusader' ? '#dcc185' : '#abb8c2', [0, .15, -.035], [1, .88, .92], true);
        this.box(this.head, trim, [0, .49, .49], [.09, .26, .06], true);
        for (const side of [-1, 1]) {
          this.shape(this.head, '#eef1e6', [[0, 0], [side * .28, .12], [side * .41, .48], [side * .19, .32], [side * .1, .43]], [side * .57, .31, -.04]);
          this.ellipsoid(this.head, trim, [side * .62, .26, 0], [.08, .1, .1]);
        }
      } else {
        const band = this.torus(this.head, '#f0d38c', .637, .027, [0, .22, .03]); band.rotation.x = Math.PI / 2;
        this.ellipsoid(this.head, '#86bac6', [0, .23, .63], [.068, .08, .035]);
      }
    }
    if (family === 'mage') {
      this.makeCape(id === 'sage' ? '#578481' : '#796194', 1.4);
      this.cylinder(this.body, cloth, .34, .58, .81, [0, .9, -.01]);
      this.cylinder(this.body, trim, .565, .59, .065, [0, .49, -.01]);
      if (id === 'sage') {
        const cap = this.box(this.head, '#496d73', [0, .63, 0], [1.23, .10, 1.05]); cap.rotation.y = .2;
        this.feather(this.head, [.48, .59, 0], '#fff3d1');
      } else {
        this.cylinder(this.head, cloth, .90, .87, .065, [0, .54, -.045]);
        this.cylinder(this.head, trim, .90, .90, .02, [0, .56, -.045]);
        const cone = this.mesh(this.head, new THREE.ConeGeometry(.58, .95, 24), cloth, [-.04, 1.00, -.1]); cone.rotation.z = .13;
        const tip = this.mesh(this.head, new THREE.ConeGeometry(.19, .43, 20), cloth, [-.19, 1.47, -.1]); tip.rotation.z = .5;
        this.cylinder(this.head, trim, .50, .55, .105, [0, .68, -.07]);
        this.shape(this.head, '#f5d984', [[0, .13], [.04, .04], [.14, 0], [.04, -.04], [0, -.13], [-.04, -.04], [-.14, 0], [-.04, .04]], [0, .85, .45]);
      }
    }
    if (family === 'archer') {
      this.makeCape(cloth, .92);
      if (id === 'dancer') {
        this.cylinder(this.body, '#e6a8b9', .32, .64, .64, [0, .87, 0]);
        for (const s of [-1, 1]) this.feather(this.head, [.5 * s, .25, -.05], '#edc98a');
        const band = this.torus(this.head, trim, .64, .026, [0, .30, .06]); band.rotation.x = Math.PI / 2;
        this.ellipsoid(this.head, '#d4859a', [0, .3, .68], [.08, .09, .04]);
      } else {
        this.mesh(this.head, new THREE.SphereGeometry(.72, 24, 12, 0, Math.PI * 2, 0, 1.35), cloth, [0, .24, -.07], [1, .72, .95]);
        const brim = this.cylinder(this.head, id === 'bard' ? '#637c8d' : '#60775a', .80, .77, .05, [0, .35, .05]); brim.rotation.z = -.1;
        this.feather(this.head, [.51, .43, -.06]);
        if (id !== 'bard') {
          this.cylinder(this.body, '#936745', .13, .13, .8, [.35, 1.3, -.34]);
          for (let i = 0; i < 3; i++) {
            this.cylinder(this.body, '#dccbad', .018, .018, .55, [.28 + i * .07, 1.8, -.34]);
            this.ellipsoid(this.body, '#f3eacb', [.28 + i * .07, 2.05, -.34], [.055, .1, .018]);
          }
        }
      }
    }
    if (family === 'acolyte') {
      if (id === 'monk') {
        for (let i = 0; i < 13; i++) {
          const a = i / 13 * Math.PI * 2;
          this.ellipsoid(this.body, '#6c4938', [Math.sin(a) * .32, 1.64 + Math.cos(a) * .07, Math.cos(a) * .29], [.065, .065, .065]);
        }
        for (const arm of [this.leftArm, this.rightArm]) for (let y = -.53; y < -.3; y += .055) this.cylinder(arm, '#fff2d2', .13, .13, .033, [0, y, .03]);
        this.box(this.head, '#9e6555', [0, .3, .51], [1.02, .10, .035]);
      } else {
        this.makeCape('#f8ebcc', 1.2);
        this.cylinder(this.body, '#eee5cf', .35, .54, .80, [0, .9, -.01]);
        this.box(this.body, '#be935b', [0, 1.05, .46], [.16, .77, .015]);
        this.box(this.body, '#f1da99', [0, 1.47, .37], [.25, .065, .04]);
        this.box(this.body, '#f1da99', [0, 1.47, .37], [.065, .25, .04]);
        if (id === 'priest') {
          this.cylinder(this.head, '#f6eddb', .46, .51, .37, [0, .7, -.05]);
          this.box(this.head, trim, [0, .69, .48], [.055, .23, .02]);
          this.box(this.head, trim, [0, .72, .48], [.18, .055, .02]);
        } else {
          const ring = this.torus(this.head, trim, .65, .025, [0, .30, .03]); ring.rotation.x = Math.PI / 2;
          this.shape(this.head, trim, [[0, .12], [.09, 0], [0, -.12], [-.09, 0]], [0, .29, .65]);
        }
      }
    }
    if (family === 'merchant') {
      const hat = this.ellipsoid(this.head, cloth, [-.09, .57, -.02], [.76, .22, .65]); hat.rotation.z = .12;
      this.cylinder(this.head, '#6d5349', .62, .63, .09, [0, .46, 0]);
      this.box(this.body, '#eedcb6', [0, 1.17, .30], [.5, .68, .06]);
      this.box(this.body, '#a67856', [0, 1.0, .345], [.29, .16, .025]);
      this.box(this.body, '#865f49', [.41, 1.04, -.12], [.24, .35, .24]);
      this.box(this.body, trim, [.41, 1.13, .03], [.09, .08, .025]);
      if (id === 'blacksmith' || id === 'alchemist') {
        for (const x of [-.25, .25]) {
          this.torus(this.head, '#be9654', .125, .025, [x, id === 'blacksmith' ? .49 : -.02, id === 'blacksmith' ? .50 : .558], true);
          if (id === 'blacksmith') this.ellipsoid(this.head, '#70918d', [x, .49, .50], [.105, .09, .03]);
        }
        this.box(this.head, '#be9654', [0, id === 'blacksmith' ? .49 : -.02, .57], [.25, .023, .021], true);
      }
    }
    if (family === 'thief') {
      this.makeCape(id === 'rogue' ? '#b1695d' : '#655979', .92);
      this.box(this.head, id === 'rogue' ? '#bc7166' : cloth, [0, .29, .515], [1.0, .13, .036]);
      this.shape(this.head, cloth, [[0, .05], [.15, .20], [.39, -.06], [.20, -.12], [.37, -.36], [.08, -.28]], [.53, .27, -.04]);
      if (id === 'assassin') {
        this.ellipsoid(this.head, '#6c6080', [0, -.29, .415], [.46, .17, .12]);
        this.box(this.head, '#ae9eb4', [0, -.27, .54], [.22, .026, .01]);
        const second = new THREE.Group(); this.makeWeapon('dagger', second); second.position.set(0, -.62, .12); second.rotation.z = Math.PI + .2; this.leftArm.add(second);
      }
      this.box(this.body, '#9a7865', [0, 1.45, .315], [.08, .58, .06]).rotation.z = .55;
    }
    if (family === 'novice') {
      this.box(this.body, '#856447', [0, 1.3, -.36], [.6, .62, .24]);
      this.box(this.body, '#d0b98e', [0, 1.58, -.37], [.63, .10, .28]);
      this.feather(this.head, [.43, .38, .04], '#7c9d76');
    }
  }

  private shield(parent: THREE.Object3D, color: string, pos: number[]) {
    const group = new THREE.Group(); group.position.set(pos[0], pos[1], pos[2]); group.rotation.y = -.2;
    this.shape(group, this.job.trim, [[0, .45], [.35, .25], [.30, -.2], [0, -.49], [-.30, -.2], [-.35, .25]], [0, 0, 0]);
    this.shape(group, color, [[0, .36], [.27, .20], [.23, -.15], [0, -.38], [-.23, -.15], [-.27, .20]], [0, 0, .065]);
    this.box(group, '#f0dc9d', [0, -.01, .14], [.06, .47, .026]);
    this.box(group, '#f0dc9d', [0, .1, .14], [.31, .06, .026]);
    parent.add(group);
  }

  private makeWeapon(type: Weapon, parent: THREE.Object3D) {
    const wood = '#806049'; const gold = '#d6b368'; const silver = '#e4e8df';
    if (type === 'sword' || type === 'dagger' || type === 'spear') {
      const length = type === 'dagger' ? .62 : type === 'spear' ? .48 : 1.03;
      const base = type === 'spear' ? 1.2 : .07;
      this.cylinder(parent, wood, .045, .045, type === 'spear' ? 2.25 : .30, [0, type === 'spear' ? .22 : -.10, 0]);
      this.shape(parent, silver, [[-.095, 0], [-.09, length - .18], [0, length], [.09, length - .18], [.095, 0]], [0, base, -.025]);
      this.box(parent, '#f9fff2', [0, base + length * .4, .04], [.025, length * .73, .017]);
      this.box(parent, gold, [0, base, .025], [type === 'spear' ? .28 : .40, .07, .12], true);
      this.ellipsoid(parent, gold, [0, type === 'spear' ? -1 : -.26, 0], [.074, .085, .074]);
      this.ellipsoid(parent, this.job.color, [0, base, .10], [.05, .05, .025]);
    } else if (type === 'staff' || type === 'mace') {
      this.cylinder(parent, wood, .043, .053, 1.75, [0, .15, 0]);
      for (const y of [-.63, .4, .86]) this.cylinder(parent, gold, .062, .062, .10, [0, y, 0]);
      if (type === 'staff') {
        this.torus(parent, gold, .25, .035, [0, 1.08, 0]);
        const orb = this.ellipsoid(parent, this.job.color, [0, 1.08, .01], [.17, .21, .17]);
        orb.material = new THREE.MeshStandardMaterial({ color: this.job.color, emissive: this.job.color, emissiveIntensity: .65, roughness: .2 });
        this.shape(parent, gold, [[-.20, 0], [0, -.28], [.20, 0], [0, -.15]], [0, 1.05, -.04]);
        this.ellipsoid(parent, '#fff0cc', [-.04, 1.17, .15], [.04, .055, .02]);
      } else {
        this.ellipsoid(parent, gold, [0, 1.05, 0], [.21, .25, .21]);
        this.box(parent, silver, [0, 1.25, 0], [.07, .40, .07]);
        this.box(parent, silver, [0, 1.30, 0], [.3, .07, .07]);
      }
    } else if (type === 'bow') {
      this.tube(parent, '#b18c53', [new THREE.Vector3(0, -.67, 0), new THREE.Vector3(.29, -.36, 0), new THREE.Vector3(.34, 0, 0), new THREE.Vector3(.29, .36, 0), new THREE.Vector3(0, .67, 0)], .043);
      this.cylinder(parent, '#f1e1b9', .009, .009, 1.34, [0, 0, 0]);
      this.cylinder(parent, wood, .018, .018, 1.15, [.1, 0, .04]).rotation.z = Math.PI / 2;
      this.box(parent, '#d6b56b', [.33, 0, 0], [.07, .23, .10]);
    } else if (type === 'axe' || type === 'hammer') {
      this.cylinder(parent, wood, .053, .053, 1.13, [0, .2, 0]);
      if (type === 'hammer') {
        this.box(parent, '#929e9e', [0, .72, 0], [.63, .34, .31], true);
        for (const x of [-.26, .26]) this.box(parent, gold, [x, .72, 0], [.075, .39, .36], true);
      } else {
        this.shape(parent, silver, [[0, .4], [.28, .58], [.47, .55], [.49, .85], [.25, .97], [0, .85]], [0, 0, -.05]);
        this.box(parent, gold, [0, .68, 0], [.14, .27, .14]);
      }
    } else if (type === 'book') {
      const book = new THREE.Group(); book.rotation.x = -.35;
      this.box(book, '#476f73', [0, .2, 0], [.51, .66, .17]);
      this.box(book, '#f6eaca', [0, .2, .04], [.44, .60, .17]);
      this.box(book, '#598187', [0, .2, .145], [.51, .66, .036]);
      this.shape(book, gold, [[0, .14], [.10, 0], [0, -.14], [-.10, 0]], [0, .2, .17]);
      parent.add(book);
    } else if (type === 'lute') {
      this.ellipsoid(parent, '#be8955', [0, -.02, 0], [.29, .4, .14]);
      this.ellipsoid(parent, '#ebc890', [0, -.02, .11], [.25, .35, .06]);
      this.ellipsoid(parent, '#74523e', [0, .06, .17], [.085, .085, .014]);
      this.box(parent, wood, [0, .52, 0], [.11, .58, .10]);
      this.box(parent, wood, [0, .83, 0], [.20, .16, .13]);
      for (const x of [-.028, 0, .028]) this.box(parent, '#f4ddb5', [x, .3, .19], [.004, .98, .004]);
      parent.rotation.z = -.3;
    } else if (type === 'fan') {
      const points: number[][] = [[0, 0]];
      for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * .8 + Math.PI * .1; points.push([Math.cos(a) * .69, Math.sin(a) * .69]); }
      this.shape(parent, '#e6b3ba', points, [0, 0, 0], .025);
      for (let i = 0; i < 7; i++) {
        const a = i / 6 * Math.PI * .8 + Math.PI * .1;
        const spoke = this.box(parent, gold, [Math.cos(a) * .33, Math.sin(a) * .33, .04], [.018, .67, .018]); spoke.rotation.z = a - Math.PI / 2;
      }
    } else if (type === 'flask') {
      this.ellipsoid(parent, '#99c6b1', [0, .13, 0], [.24, .27, .24]);
      this.cylinder(parent, '#c5ded3', .075, .09, .22, [0, .4, 0]);
      this.cylinder(parent, '#a28255', .09, .09, .10, [0, .53, 0]);
      this.ellipsoid(parent, '#ebfff0', [-.08, .22, .20], [.04, .075, .025]);
      this.box(parent, '#e7d7a4', [0, .13, .232], [.16, .14, .025]);
    }
  }

  update(time: number, dt: number, moving = false, attack = 0, casting = 0, dead = false) {
    const t = time + this.timeOffset;
    const walk = moving ? Math.sin(t * 11) : Math.sin(t * 1.8) * .025;
    this.body.position.y = moving ? Math.abs(Math.sin(t * 11)) * .085 : Math.sin(t * 2.3) * .018;
    this.body.rotation.x = THREE.MathUtils.damp(this.body.rotation.x, dead ? -Math.PI / 2 : moving ? .06 : 0, 8, dt);
    this.body.rotation.z = moving ? Math.sin(t * 11) * .035 : Math.sin(t * 1.7) * .011;
    this.body.scale.y = 1 + Math.sin(t * 2.3) * .007;
    this.head.rotation.x = Math.sin(t * 1.8) * .015;
    this.head.rotation.y = moving ? 0 : Math.sin(t * .65) * .045;
    this.rightLeg.rotation.x = walk * .62; this.leftLeg.rotation.x = -walk * .62;
    this.rightArm.rotation.x = -walk * .42; this.leftArm.rotation.x = walk * .42;
    this.rightArm.rotation.z = .10 + Math.sin(t * 2.1) * .025;
    this.leftArm.rotation.z = -.10 - Math.sin(t * 2.1) * .025;
    if (attack > 0) {
      const p = Math.max(0, 1 - attack / .45);
      this.rightArm.rotation.x = -Math.sin(p * Math.PI) * 1.65;
      this.rightArm.rotation.z = .10 + Math.sin(p * Math.PI * 1.5) * .75;
      this.body.rotation.y = Math.sin(p * Math.PI * 2) * .2;
    } else this.body.rotation.y *= .85;
    if (casting > 0) {
      this.leftArm.rotation.x = -1.15; this.leftArm.rotation.z = -.40;
      this.rightArm.rotation.x = -.35; this.head.rotation.x = -.06;
    }
    const blink = Math.sin(t * 1.42) > .985;
    if (blink !== this.blink) { this.faceMaterial.map = blink ? this.eyesClosed : this.eyesOpen; this.blink = blink; }
    this.ribbons.forEach((r, i) => r.rotation.x = Math.sin(t * 2.5 + i) * .06 + (moving ? .13 : 0));
    if (this.cape && this.capeBase) {
      const pos = this.cape.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const y = this.capeBase[i * 3 + 1]; const f = .6 - y;
        pos.setZ(i, this.capeBase[i * 3 + 2] + Math.sin(t * 2.7 + y * 4 + this.capeBase[i * 3] * 3) * .045 * f - (moving ? f * .13 : 0));
      }
      pos.needsUpdate = true;
    }
  }

  dispose() { disposeObject(this.group); this.mats.clear(); }
}

export class Slime {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly material: THREE.MeshPhysicalMaterial;
  private crown?: THREE.Group;
  private phase = Math.random() * Math.PI * 2;
  constructor(readonly color: string, readonly boss = false) {
    const geometry = new THREE.SphereGeometry(1, 28, 20);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0) pos.setY(i, pos.getY(i) * .29);
    geometry.computeVertexNormals();
    this.material = new THREE.MeshPhysicalMaterial({ color, roughness: .29, metalness: .02, clearcoat: .7, clearcoatRoughness: .22, sheen: .25, sheenColor: '#ffe7dd' });
    const mesh = new THREE.Mesh(geometry, this.material); mesh.scale.set(.77, .91, .70); mesh.position.y = .27; mesh.castShadow = true;
    this.body.add(mesh);
    const face = slimeFace ??= canvasTexture(256, 128, ctx => {
      ctx.fillStyle = '#564152';
      for (const x of [78, 179]) { ctx.beginPath(); ctx.ellipse(x, 48, 7, 12, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#664253'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(113, 67); ctx.quadraticCurveTo(128, 82, 144, 66); ctx.stroke();
      ctx.fillStyle = '#e17e99';
      for (const x of [47, 209]) { ctx.beginPath(); ctx.ellipse(x, 68, 14, 7, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff5f2';
      for (const x of [76, 177]) { ctx.beginPath(); ctx.arc(x, 44, 2.5, 0, Math.PI * 2); ctx.fill(); }
    });
    const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.11, .56), new THREE.MeshBasicMaterial({ map: face, transparent: true, depthWrite: false }));
    faceMesh.position.set(0, .53, .635); this.body.add(faceMesh);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshBasicMaterial({ color: '#fff7e9', transparent: true, opacity: .65 }));
    shine.position.set(-.3, .99, .32); shine.scale.set(.18, .04, .12); shine.rotation.z = -.3; this.body.add(shine);
    this.group.add(this.body, contactShadow(2.0, .33));
    if (boss) {
      this.group.scale.setScalar(2.1);
      this.crown = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({ color: '#e5c36e', roughness: .3, metalness: .4 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.4, .36, .17, 20, 1, true), gold); this.crown.add(band);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(.095, .3, 4), gold); spike.position.set(Math.sin(a) * .35, .2, Math.cos(a) * .35); this.crown.add(spike);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.055), new THREE.MeshBasicMaterial({ color: '#ba87c8' })); gem.position.set(Math.sin(a) * .37, 0, Math.cos(a) * .37); this.crown.add(gem);
      }
      this.crown.position.set(0, 1.22, 0); this.body.add(this.crown);
    }
  }
  update(time: number, moving: boolean, hit: number, dead: number, yaw: number) {
    const t = time * (moving ? 7 : 3.2) + this.phase;
    const wave = Math.sin(t);
    this.body.scale.set(1 - wave * .055 + hit * .18, 1 + wave * .07 - hit * .13, 1 - wave * .05);
    this.body.position.y = moving ? Math.max(0, wave) * .3 : Math.max(0, wave) * .04;
    this.body.rotation.y = yaw + Math.sin(t * .4) * .1;
    this.body.rotation.z = moving ? Math.sin(t * .5) * .055 : 0;
    this.material.emissive.set(hit > 0 ? '#fff3d6' : '#000000'); this.material.emissiveIntensity = hit * .7;
    if (dead > 0) { this.body.scale.y = Math.max(.02, 1 - dead); this.body.scale.x = this.body.scale.z = 1 + dead * .35; this.group.visible = dead < 1; }
  }
  dispose() { disposeObject(this.group); }
}
