import * as THREE from 'three';
import { getJob, type Job, type Skill } from '../data/jobs';
import { Character, Slime } from './Character';
import { World, MAPS, type MapId } from './World';
import { Effects } from './Effects';
import { GameAudio } from './Audio';
import { dampAngle } from './art';
import { findPath, clearLine } from './pathfinding';
import { statsFor, xpForLevel, persistHero, QUESTS, questReady, type HeroSave, type Stats, type Preferences } from './state';

export type Panel = 'bag' | 'character' | 'journal' | 'map' | 'settings' | 'help';
export type GameEvent =
  | { type: 'log'; message: string; channel: 'world' | 'combat' | 'loot' }
  | { type: 'toast'; title: string; detail?: string; icon?: string }
  | { type: 'float'; text: string; color: string; position: THREE.Vector3; big?: boolean }
  | { type: 'map'; id: MapId }
  | { type: 'transition'; active: boolean; name?: string }
  | { type: 'dialogue' }
  | { type: 'panel'; panel: Panel }
  | { type: 'death' }
  | { type: 'victory' }
  | { type: 'update' };
export interface Enemy {
  id: number; model: Slime; name: string; position: THREE.Vector3; spawn: THREE.Vector2;
  hp: number; maxHp: number; attack: number; xp: number; boss: boolean;
  aggro: boolean; attackTimer: number; wanderTimer: number; wander: THREE.Vector2;
  returning: boolean; returnPath: THREE.Vector2[]; returnRefresh: number;
  hit: number; death: number; respawn: number; poison: number; poisonPower: number; poisonTick: number; rooted: number;
}
interface Zone { at: THREE.Vector3; radius: number; remaining: number; tick: number; power: number; color: string; healing: boolean }
interface Danger { at: THREE.Vector3; remaining: number; radius: number; damage: number }
interface Familiar { model: Slime; remaining: number; nextAttack: number; permanent: boolean; wings?: THREE.Group[] }

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-20, 20, 14, -14, .1, 180);
  readonly player: Character;
  readonly job: Job;
  readonly effects = new Effects();
  readonly hero: HeroSave;
  world: World;
  stats: Stats;
  enemies: Enemy[] = [];
  target: Enemy | null = null;
  hovered: Enemy | null = null;
  cooldowns = [0, 0, 0, 0];
  potionCooldowns = [0, 0];
  guard = 0;
  invulnerable = 0;
  paused = false;
  dead = false;
  transitioning = false;
  time = 0;
  cameraYaw = .40;
  viewHeight = 26;
  fps = 60;
  saved = true;
  interaction: 'npc' | 'chest' | null = null;
  interactionName = '';
  readonly keys = new Set<string>();
  private abort = new AbortController();
  private resizeObserver: ResizeObserver;
  private raf = 0;
  private previous = 0;
  private frameCount = 0;
  private fpsTime = 0;
  private updateTime = 0;
  private saveTime = 0;
  private autoAttack = false;
  private attackTimer = 0;
  private attackPose = 0;
  private castPose = 0;
  private lastDamage = -20;
  private path: THREE.Vector2[] = [];
  private pathRefresh = 0;
  private focus = new THREE.Vector3();
  private joystick = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private zones: Zone[] = [];
  private danger: Danger[] = [];
  private familiar?: Familiar;
  private targetRing: THREE.Mesh;
  private travel?: { to: MapId; north: boolean; time: number; switched: boolean };
  private cameraDrag = false;
  private pointerStart?: { x: number; y: number; button: number; moved: boolean };
  private sunlight: THREE.DirectionalLight;
  private saveFailed = false;

  constructor(private renderer: THREE.WebGLRenderer, private container: HTMLElement, hero: HeroSave, private audio: GameAudio, private emit: (event: GameEvent) => void, preferences: Preferences) {
    this.hero = hero; this.job = getJob(hero.jobId); this.stats = statsFor(hero);
    this.player = new Character(this.job, hero.appearance, false); this.player.group.scale.setScalar(.86);
    this.scene.add(this.player.group, this.effects.group);
    this.scene.add(new THREE.HemisphereLight('#fff3d6', '#759181', 1.9));
    this.sunlight = new THREE.DirectionalLight('#fff0cc', 2.6); this.sunlight.position.set(-22, 38, 16); this.sunlight.castShadow = true;
    Object.assign(this.sunlight.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 110 });
    this.sunlight.shadow.mapSize.set(2048, 2048); this.sunlight.shadow.normalBias = .035; this.sunlight.shadow.bias = -.00005;
    this.scene.add(this.sunlight, this.sunlight.target);
    const fill = new THREE.DirectionalLight('#dbe8ef', .65); fill.position.set(15, 12, -20); this.scene.add(fill);
    this.world = new World(hero.mapId, hero.openedChests); this.scene.add(this.world.root);
    this.scene.background = new THREE.Color(this.world.map.sky); this.scene.fog = new THREE.Fog(this.world.map.sky, 50, 112);
    const p = this.world.nearestWalkable(hero.x, hero.z); this.player.group.position.set(p.x, this.world.walkHeight(p.x, p.y), p.y);
    this.focus.copy(this.player.group.position).add(new THREE.Vector3(0, 0, -2.5));
    const targetMat = new THREE.MeshBasicMaterial({ color: '#f3c286', transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide });
    this.targetRing = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 48), targetMat); this.targetRing.rotation.x = -Math.PI / 2; this.targetRing.visible = false; this.scene.add(this.targetRing);
    this.populate(); this.bind(); this.applyQuality(preferences.quality);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize(); this.updateCamera(.1, true);
    if (hero.claimed[2]) this.makeFamiliar(true);
  }
  start() {
    this.emit({ type: 'map', id: this.hero.mapId });
    this.log(`欢迎来到${this.world.map.name}，${this.hero.name}。愿风与你同路。`);
    this.log('点击地面或使用 WASD 移动。点击波利自动战斗，1–4 施放技能，F 与旅人交谈。');
    if (this.hero.hp <= 0) { this.dead = true; this.emit({ type: 'death' }); }
    this.raf = requestAnimationFrame(this.frame);
  }
  private populate() {
    this.enemies = this.world.spawns.map((spawn, i) => {
      const boss = Boolean(spawn.boss); const model = new Slime(boss ? '#e9a8c6' : i % 5 === 4 && this.hero.mapId === 0 ? '#e9ca97' : this.world.map.mobColor, boss);
      model.group.position.set(spawn.x, this.world.walkHeight(spawn.x, spawn.z), spawn.z); this.scene.add(model.group);
      const hp = boss ? 720 : this.world.map.mobHp + (i % 3) * 7;
      const enemy: Enemy = { id: i, model, name: boss ? '波利女王' : i % 5 === 4 && this.hero.mapId === 0 ? '蜂蜜波利' : this.world.map.mobName, position: model.group.position,
        spawn: new THREE.Vector2(spawn.x, spawn.z), hp, maxHp: hp, attack: boss ? 36 : this.world.map.mobAttack, xp: boss ? 250 : this.world.map.mobXp,
        boss, aggro: false, attackTimer: 1, wanderTimer: 1 + Math.random() * 3, wander: new THREE.Vector2(), returning: false, returnPath: [], returnRefresh: 0,
        hit: 0, death: 0, respawn: 0, poison: 0, poisonPower: 0, poisonTick: 0, rooted: 0 };
      model.group.traverse(obj => { obj.userData.enemyId = i; }); return enemy;
    });
  }
  private bind() {
    const signal = this.abort.signal; const canvas = this.renderer.domElement;
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', '三维冒险地图，WASD 移动，空格攻击，数字 1 到 4 施法');
    canvas.addEventListener('contextmenu', e => e.preventDefault(), { signal });
    canvas.addEventListener('pointerdown', e => {
      if (this.paused || this.dead) return;
      this.pointerStart = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
      if (e.button === 2) { this.cameraDrag = true; canvas.setPointerCapture(e.pointerId); }
      canvas.focus({ preventScroll: true });
    }, { signal });
    canvas.addEventListener('pointermove', e => {
      if (this.cameraDrag && this.pointerStart) { this.cameraYaw -= (e.clientX - this.pointerStart.x) * .006; this.pointerStart.x = e.clientX; this.pointerStart.moved = true; }
      else if (this.pointerStart && Math.hypot(e.clientX - this.pointerStart.x, e.clientY - this.pointerStart.y) > 8) this.pointerStart.moved = true;
      this.hovered = this.enemyAt(e.clientX, e.clientY);
      canvas.style.cursor = this.cameraDrag ? 'grabbing' : this.hovered ? 'crosshair' : 'default';
    }, { signal });
    canvas.addEventListener('pointerup', e => {
      if (this.pointerStart?.button === 0 && !this.pointerStart.moved && !this.paused) this.click(e.clientX, e.clientY);
      this.pointerStart = undefined; this.cameraDrag = false;
    }, { signal });
    canvas.addEventListener('pointercancel', () => { this.pointerStart = undefined; this.cameraDrag = false; }, { signal });
    canvas.addEventListener('wheel', e => { if (!this.paused) { e.preventDefault(); this.viewHeight = THREE.MathUtils.clamp(this.viewHeight + e.deltaY * .015, 17, 37); this.resize(); } }, { signal, passive: false });
    window.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (this.paused || this.dead || this.transitioning) return;
      if (key === 'tab' && e.target !== canvas && e.target !== document.body) return;
      if (key === ' ' && e.target instanceof HTMLButtonElement) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', '1', '2', '3', '4', 'q', 'e', 'f', 'tab'].includes(key)) e.preventDefault();
      this.keys.add(key);
      if (e.repeat) return;
      if (['1', '2', '3', '4'].includes(key)) this.cast(Number(key) - 1);
      if (key === 'q') this.usePotion('red');
      if (key === 'e') this.usePotion('blue');
      if (key === 'f') this.interact();
      if (key === ' ') this.startAttack();
      if (key === 'tab') this.cycleTarget();
      if (key === 'r') { this.cameraYaw = .4; this.viewHeight = 26; this.resize(); }
    }, { signal });
    window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()), { signal });
    window.addEventListener('blur', () => { this.keys.clear(); this.joystick.set(0, 0); this.save(); }, { signal });
    document.addEventListener('visibilitychange', () => { this.keys.clear(); this.save(); void this.audio.suspend(document.hidden); }, { signal });
    window.addEventListener('pagehide', () => this.save(), { signal });
  }
  private setRay(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); this.raycaster.setFromCamera(this.pointer, this.camera);
  }
  private enemyAt(x: number, y: number) {
    this.setRay(x, y);
    const hits = this.raycaster.intersectObjects(this.enemies.filter(e => e.hp > 0).map(e => e.model.group), true);
    return hits.length ? this.enemies[hits[0].object.userData.enemyId] ?? null : null;
  }
  private click(x: number, y: number) {
    if (this.dead || this.transitioning) return;
    const enemy = this.enemyAt(x, y);
    if (enemy) { this.target = enemy; this.autoAttack = true; this.pathRefresh = 0; this.audio.play('click'); return; }
    this.setRay(x, y);
    const npcHits = this.raycaster.intersectObject(this.world.npc.group, true);
    if (npcHits.length && npcHits[0].distance < 120) {
      if (this.player.group.position.distanceTo(this.world.npcPosition) < 3.4) this.interact();
      else this.moveTo(this.world.npcPosition.x + 1.3, this.world.npcPosition.z + .7);
      return;
    }
    const hits = this.raycaster.intersectObject(this.world.ground);
    if (hits.length) this.moveTo(hits[0].point.x, hits[0].point.z);
  }
  moveTo(x: number, z: number) {
    if (this.dead || this.transitioning || this.paused) return;
    const start = new THREE.Vector2(this.player.group.position.x, this.player.group.position.z);
    this.path = findPath(this.world, start, new THREE.Vector2(x, z)); this.autoAttack = false;
    if (this.path.length) { const end = this.path[this.path.length - 1]; this.effects.ring(new THREE.Vector3(end.x, this.world.walkHeight(end.x, end.y), end.y), '#fff0b4', .85, .7); }
    else this.toast('那边暂时走不过去', '沿着小路或桥梁试试看。', 'compass');
  }
  setJoystick(x: number, y: number) { this.joystick.set(x, y); }
  setPaused(paused: boolean) { this.paused = paused; this.keys.clear(); this.joystick.set(0, 0); if (paused) this.save(); }
  private closestEnemy(range = Infinity) {
    let best: Enemy | null = null; let d = range;
    for (const e of this.enemies) { if (e.hp <= 0) continue; const distance = e.position.distanceTo(this.player.group.position); if (distance < d) { best = e; d = distance; } }
    return best;
  }
  startAttack() {
    if (this.paused || this.dead || this.transitioning) return;
    if (!this.target || this.target.hp <= 0) this.target = this.closestEnemy(18);
    if (this.target) { this.autoAttack = true; this.pathRefresh = 0; }
    else this.toast('附近没有魔物', '沿着小路继续探索吧。', 'target');
  }
  private cycleTarget() {
    const list = this.enemies.filter(e => e.hp > 0 && e.position.distanceTo(this.player.group.position) < 18).sort((a, b) => a.position.distanceToSquared(this.player.group.position) - b.position.distanceToSquared(this.player.group.position));
    if (list.length) this.target = list[(list.indexOf(this.target!) + 1) % list.length];
  }
  cast(index: number): boolean {
    if (this.paused || this.dead || this.transitioning || index < 0 || index > 3) return false;
    const skill = this.job.skills[index];
    if (this.cooldowns[index] > 0) { this.toast('技能还在准备中', `${Math.ceil(this.cooldowns[index])} 秒后可以再次使用。`, skill.icon); return false; }
    if (this.hero.sp < skill.cost) { this.toast('SP 不足', '按 E 使用蓝色药水，或稍作休息。', 'drop'); return false; }
    const self = ['heal', 'guard', 'song', 'summon'].includes(skill.kind);
    if (!self && (!this.target || this.target.hp <= 0)) this.target = this.closestEnemy(Math.max(skill.range, this.stats.range) + 1);
    if (!self && (!this.target || this.target.hp <= 0)) { this.toast('先选择一个魔物', '点击魔物，或按 Tab 切换目标。', 'target'); return false; }
    if (!self && this.target!.position.distanceTo(this.player.group.position) > Math.max(skill.range, this.stats.range) + (this.target!.boss ? 1.3 : .4)) {
      this.toast('目标有些远', '靠近一点，再施放技能。', 'target'); return false;
    }
    if (skill.kind === 'heal' && this.hero.hp >= this.stats.hp) { this.toast('生命已经恢复满了', undefined, 'heart'); return false; }
    this.hero.sp -= skill.cost; this.cooldowns[index] = skill.cooldown; this.castPose = .7;
    const at = self ? this.player.group.position.clone() : this.target!.position.clone();
    this.effects.ring(this.player.group.position, skill.color, 1.6, .8, true, true);
    this.audio.play(skill.kind === 'heal' || skill.kind === 'song' ? 'heal' : 'cast');
    this.emit({ type: 'float', text: skill.name, color: skill.color, position: this.player.group.position.clone().add(new THREE.Vector3(0, 2.9, 0)) });
    if (!self && this.target) this.player.group.rotation.y = Math.atan2(this.target.position.x - this.player.group.position.x, this.target.position.z - this.player.group.position.z);
    const power = this.stats.attack * skill.power;
    switch (skill.kind) {
      case 'heal': this.heal(power, true); break;
      case 'guard': this.guard = 8; this.effects.ring(at, skill.color, 1.25, 8, true, true); this.toast(skill.name, '8 秒内减伤 55%，攻击提高 25%。', 'shield'); break;
      case 'strike': this.damage(this.target!, power, skill); this.effects.projectile(this.player.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), at.clone().add(new THREE.Vector3(0, .7, 0)), skill.color); break;
      case 'burst': this.areaDamage(at, skill.radius, power, skill); this.effects.ring(at, skill.color, skill.radius, .6); this.effects.burst(at.clone().add(new THREE.Vector3(0, .5, 0)), skill.color, 55, 3); break;
      case 'poison': this.damage(this.target!, power, skill); if (this.target!.hp > 0) { this.target!.poison = 6; this.target!.poisonPower = this.stats.attack * .43; this.target!.poisonTick = 1; } this.effects.burst(at.clone().add(new THREE.Vector3(0, .65, 0)), skill.color, 24, 1.5); break;
      case 'trap': this.areaDamage(at, skill.radius, power, skill); for (const enemy of this.enemies) if (enemy.hp > 0 && enemy.position.distanceTo(at) < skill.radius) enemy.rooted = 4; this.effects.ring(at, skill.color, skill.radius, 4, true, true); break;
      case 'dash': {
        const delta = this.target!.position.clone().sub(this.player.group.position); const distance = delta.length();
        delta.normalize().multiplyScalar(Math.max(0, Math.min(7, distance - 1.7)));
        const end = this.player.group.position.clone().add(delta); const start2 = new THREE.Vector2(this.player.group.position.x, this.player.group.position.z);
        if (clearLine(this.world, start2, new THREE.Vector2(end.x, end.z))) this.player.group.position.copy(end);
        this.player.group.position.y = this.world.walkHeight(this.player.group.position.x, this.player.group.position.z); this.path = []; this.invulnerable = 1.4; this.damage(this.target!, power, skill); this.effects.slash(at, skill.color, this.player.group.rotation.y); break;
      }
      case 'storm': this.zones.push({ at, radius: skill.radius, remaining: 4.1, tick: 0, power, color: skill.color, healing: false }); this.effects.ring(at, skill.color, skill.radius, 4.1, true, true); break;
      case 'song': this.zones.push({ at, radius: skill.radius, remaining: 6.1, tick: 0, power, color: skill.color, healing: true }); this.effects.ring(at, skill.color, skill.radius, 6.1, true, true); break;
      case 'summon': this.makeFamiliar(false); this.effects.burst(at, skill.color, 45, 1.5); break;
      case 'drain': this.damage(this.target!, power, skill); this.heal(power * .6, true); this.effects.projectile(at.clone().add(new THREE.Vector3(0, .8, 0)), this.player.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), skill.color); break;
    }
    this.log(`施放了「${skill.name}」。`, 'combat'); this.emit({ type: 'update' }); return true;
  }
  private areaDamage(at: THREE.Vector3, radius: number, amount: number, skill?: Skill) {
    for (const enemy of this.enemies) if (enemy.hp > 0 && enemy.position.distanceTo(at) <= radius + (enemy.boss ? 1 : .1)) this.damage(enemy, amount, skill);
  }
  private damage(enemy: Enemy, amount: number, skill?: Skill, dot = false) {
    if (enemy.hp <= 0) return;
    const critical = !dot && Math.random() < (this.job.family === 'thief' ? .22 : .10);
    const hit = Math.max(1, Math.round(amount * (this.guard > 0 ? 1.25 : 1) * (critical ? 1.5 : 1) * (dot ? 1 : .94 + Math.random() * .12)));
    enemy.hp = Math.max(0, enemy.hp - hit); enemy.hit = .22; enemy.aggro = !enemy.returning;
    this.emit({ type: 'float', text: `${critical ? '✦ ' : ''}${hit}`, color: dot ? '#b7e19c' : critical ? '#ffe29b' : '#fff8e7', position: enemy.position.clone().add(new THREE.Vector3(0, enemy.boss ? 2.8 : 1.45, 0)), big: critical });
    this.effects.burst(enemy.position.clone().add(new THREE.Vector3(0, enemy.boss ? 1.4 : .6, 0)), skill?.color ?? '#ffe9bd', dot ? 4 : 13, 1.5);
    if (enemy.hp <= 0) this.defeat(enemy);
  }
  private defeat(enemy: Enemy) {
    enemy.aggro = false; enemy.death = .001; enemy.respawn = enemy.boss ? 150 : 24 + Math.random() * 12;
    enemy.returning = false; enemy.returnPath = [];
    this.hero.kills[this.hero.mapId]++; this.hero.jelly += enemy.boss ? 6 : 1;
    const coins = enemy.boss ? 150 : 8 + this.hero.mapId * 5 + Math.floor(Math.random() * 8); this.hero.zeny += coins;
    if (Math.random() < .18 || enemy.boss) this.hero.crystals += enemy.boss ? 3 : 1;
    if (enemy.boss) { this.hero.bossDefeated = true; this.toast('波利女王已经平静下来', '拜访遗迹入口的星语者，完成最后的约定。', 'star'); }
    this.audio.play('slime'); this.gainXP(enemy.xp);
    this.log(`${enemy.name} · EXP +${enemy.xp} · ${coins} Z · 波利凝胶 +${enemy.boss ? 6 : 1}`, 'loot');
    this.effects.projectile(enemy.position.clone().add(new THREE.Vector3(0, .8, 0)), this.player.group.position.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe3a0', .65);
    if (this.hero.kills[this.hero.mapId] === 5 && this.hero.mapId < 2 && !this.hero.claimed[this.hero.mapId]) this.toast('这一页冒险，已经完成', `回到${this.world.map.npcName}身边，按 F 领取旅途的谢礼。`, 'scroll');
    // A spell can finish a target after the player has already chosen a new destination.
    if (this.target === enemy && this.autoAttack) { this.autoAttack = false; this.path = []; }
    this.emit({ type: 'update' }); this.save();
  }
  private gainXP(amount: number) {
    this.hero.xp += amount; let levels = 0;
    while (this.hero.xp >= xpForLevel(this.hero.level) && this.hero.level < 99) { this.hero.xp -= xpForLevel(this.hero.level); this.hero.level++; levels++; }
    if (this.hero.level === 99) this.hero.xp = Math.min(this.hero.xp, xpForLevel(99) - 1);
    if (levels) {
      this.stats = statsFor(this.hero); this.hero.hp = this.stats.hp; this.hero.sp = this.stats.sp;
      this.effects.burst(this.player.group.position.clone().add(new THREE.Vector3(0, 1, 0)), '#fff0b6', 85, 3, 3);
      this.effects.ring(this.player.group.position, '#ffe7a3', 4, 1.3); this.audio.play('level');
      this.toast(`Level Up · Lv. ${this.hero.level}`, '成长了一点，也离远方更近了一点。生命与 SP 已恢复。', 'star');
      this.log(`升到了 ${this.hero.level} 级，生命和 SP 已恢复。`);
    }
  }
  private heal(amount: number, show = false) {
    const gain = Math.min(this.stats.hp - this.hero.hp, Math.round(amount)); this.hero.hp += gain;
    if (show && gain > 0) {
      this.emit({ type: 'float', text: `+${gain}`, color: '#c0edb5', position: this.player.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)) });
      this.effects.burst(this.player.group.position.clone().add(new THREE.Vector3(0, 1, 0)), '#c8efbb', 25, .8, 1.5);
    }
  }
  usePotion(type: 'red' | 'blue'): boolean {
    if (this.dead || this.transitioning) return false;
    const index = type === 'red' ? 0 : 1;
    if (this.potionCooldowns[index] > 0) return false;
    const field = type === 'red' ? 'redPotions' : 'bluePotions';
    if (this.hero[field] <= 0) { this.toast('药水用完了', '到向导身边购买补给，或寻找散落的宝箱。', 'potion'); return false; }
    if (type === 'red' ? this.hero.hp >= this.stats.hp : this.hero.sp >= this.stats.sp) { this.toast(type === 'red' ? '生命已经恢复满了' : 'SP 已经恢复满了', undefined, 'potion'); return false; }
    this.hero[field]--; this.potionCooldowns[index] = 2;
    if (type === 'red') this.heal(Math.round(this.stats.hp * .5), true);
    else { const restored = Math.min(this.stats.sp - this.hero.sp, Math.round(this.stats.sp * .6)); this.hero.sp += restored; this.emit({ type: 'float', text: `SP +${Math.round(restored)}`, color: '#a7ddf0', position: this.player.group.position.clone().add(new THREE.Vector3(0, 2.5, 0)) }); this.effects.burst(this.player.group.position, '#a7ddf0', 22, 1); }
    this.audio.play('heal'); this.emit({ type: 'update' }); this.save(); return true;
  }
  interact() {
    if (this.dead || this.transitioning || this.paused) return;
    const pos = this.player.group.position;
    if (pos.distanceTo(this.world.npcPosition) < 3.4) { this.autoAttack = false; this.path = []; this.emit({ type: 'dialogue' }); this.audio.play('click'); return; }
    const chest = this.world.chests.find(c => !c.opened && Math.hypot(c.x - pos.x, c.z - pos.z) < 2.8);
    if (chest) {
      chest.opened = true; this.hero.openedChests.push(chest.id); this.hero.zeny += 65; this.hero.redPotions += 2; this.hero.bluePotions++; this.hero.crystals++; this.hero.cards++; this.stats = statsFor(this.hero);
      this.effects.burst(chest.group.position.clone().add(new THREE.Vector3(0, 1, 0)), '#ffe4a1', 70, 2.2, 3);
      this.audio.play('loot'); this.toast('找到了旅人的宝箱', '65 Z · 红药水 ×2 · 蓝药水 ×1 · 星之碎片 ×1 · 生命卡片 ×1', 'chest');
      this.log('获得一张「草木之心」卡片，最大生命永久增加 12。', 'loot'); this.save(); this.emit({ type: 'update' }); return;
    }
    this.toast('附近没有可以交谈的旅人', '靠近向导或宝箱后，再按 F。', 'compass');
  }
  claimQuest(): boolean {
    const index = this.hero.mapId;
    if (this.player.group.position.distanceTo(this.world.npcPosition) > 3.4 || !questReady(this.hero, index)) return false;
    const quest = QUESTS[index]; this.hero.claimed[index] = true; this.hero.zeny += quest.reward; this.hero.redPotions += 3; this.hero.bluePotions += 2; this.gainXP(quest.xp);
    this.toast(`完成「${quest.name}」`, `${quest.reward} Z · ${quest.xp} EXP · 红药水 ×3 · 蓝药水 ×2`, 'scroll');
    this.log(`完成了${quest.subtitle}「${quest.name}」。`); this.audio.play('level');
    if (index === 2) { this.makeFamiliar(true); this.emit({ type: 'victory' }); }
    this.save(); this.emit({ type: 'update' }); return true;
  }
  buy(type: 'red' | 'blue'): boolean {
    if (this.player.group.position.distanceTo(this.world.npcPosition) > 3.4) return false;
    const cost = type === 'red' ? 20 : 25;
    if (this.hero.zeny < cost) { this.toast('Zeny 不够了', '波利和旅途中的宝箱里，也许藏着一点惊喜。', 'coin'); return false; }
    this.hero.zeny -= cost; this.hero[type === 'red' ? 'redPotions' : 'bluePotions']++; this.audio.play('loot'); this.save(); this.emit({ type: 'update' }); return true;
  }
  sellJelly(): boolean {
    if (this.player.group.position.distanceTo(this.world.npcPosition) > 3.4 || this.hero.jelly === 0) return false;
    const count = this.hero.jelly; this.hero.zeny += count * 8; this.hero.jelly = 0; this.audio.play('loot'); this.toast('谢谢你带来的凝胶', `${count} 份凝胶换得 ${count * 8} Z。`, 'coin'); this.save(); this.emit({ type: 'update' }); return true;
  }
  upgradeWeapon(): boolean {
    const cost = 50 + this.hero.upgrade * 25;
    if (this.hero.upgrade >= 10) { this.toast('武器已达到最高强化等级', undefined, 'sword'); return false; }
    if (this.hero.zeny < cost || this.hero.jelly < 3) { this.toast('材料还差一点', `需要 ${cost} Z 和 3 份波利凝胶。`, 'hammer'); return false; }
    this.hero.zeny -= cost; this.hero.jelly -= 3; this.hero.upgrade++; this.stats = statsFor(this.hero);
    this.toast(`武器强化 +${this.hero.upgrade}`, '攻击力提高了 4 点。愿它陪你走得更远。', 'hammer'); this.audio.play('level'); this.save(); this.emit({ type: 'update' }); return true;
  }
  respawn() {
    this.dead = false; this.hero.hp = this.stats.hp; this.hero.sp = this.stats.sp;
    const x = this.world.pathX(23); this.player.group.position.set(x, this.world.walkHeight(x, 23), 23); this.hero.x = x; this.hero.z = 23;
    this.target = null; this.path = []; this.autoAttack = false; this.danger = []; this.invulnerable = 4;
    this.enemies.forEach(e => { e.aggro = false; e.returning = false; e.returnPath = []; e.position.set(e.spawn.x, this.world.walkHeight(e.spawn.x, e.spawn.y), e.spawn.y); });
    this.focus.copy(this.player.group.position).add(new THREE.Vector3(0, 0, -2.5)); this.setPaused(false);
    this.effects.ring(this.player.group.position, '#fff0be', 3, 1.2); this.log('温柔的风把你送回了路口。背包与冒险进度都好好地留着。'); this.save();
  }

  private hurt(amount: number) {
    if (this.dead || this.invulnerable > 0 || this.transitioning) return;
    const damage = Math.max(2, Math.round((amount - this.stats.defense * .6) * (this.guard > 0 ? .45 : 1)));
    this.hero.hp = Math.max(0, this.hero.hp - damage); this.lastDamage = this.time;
    this.emit({ type: 'float', text: `−${damage}`, color: '#ffb0a4', position: this.player.group.position.clone().add(new THREE.Vector3(0, 2.3, 0)) });
    this.audio.play('hit');
    if (this.hero.hp <= 0) {
      this.dead = true; this.path = []; this.keys.clear(); this.autoAttack = false; this.target = null;
      this.audio.play('death'); this.log('你暂时倒下了。没关系，冒险总有重新出发的时候。'); this.save(); this.emit({ type: 'death' });
    }
  }

  private makeFamiliar(permanent: boolean) {
    if (this.familiar) { this.scene.remove(this.familiar.model.group); this.familiar.model.dispose(); }
    const model = new Slime(permanent ? '#f2bbca' : this.job.id === 'hunter' ? '#e6d5b1' : '#a6d5bd');
    model.group.scale.setScalar(permanent ? .40 : .47); model.group.position.copy(this.player.group.position).add(new THREE.Vector3(1, .2, 1)); this.scene.add(model.group);
    this.familiar = { model, remaining: permanent ? Infinity : 12, nextAttack: 1.1, permanent };
    if (!permanent && this.job.id === 'hunter') {
      model.body.visible = false;
      const bird = new THREE.Group(); model.group.add(bird);
      const plumage = new THREE.MeshStandardMaterial({ color: '#eee4cd', roughness: .8 });
      const brown = new THREE.MeshStandardMaterial({ color: '#a08361', roughness: .8 });
      const sphere = new THREE.SphereGeometry(1, 12, 8);
      const body = new THREE.Mesh(sphere, brown); body.scale.set(.31, .30, .47); bird.add(body);
      const head = new THREE.Mesh(sphere, plumage); head.position.set(0, .26, .34); head.scale.setScalar(.22); bird.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(.07, .20, 6), new THREE.MeshStandardMaterial({ color: '#d5ac66' })); beak.rotation.x = Math.PI / 2; beak.position.set(0, .22, .56); bird.add(beak);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.027, 8, 6), new THREE.MeshBasicMaterial({ color: '#554636' })); eye.position.set(side * .13, .31, .5); bird.add(eye);
      }
      const wings: THREE.Group[] = [];
      for (const side of [-1, 1]) {
        const wing = new THREE.Group(); wing.position.x = side * .21; bird.add(wing); wings.push(wing);
        for (let i = 0; i < 4; i++) {
          const feather = new THREE.Mesh(sphere, i % 2 ? plumage : brown); feather.position.set(side * (.20 + i * .12), .02, -.08 - i * .06); feather.scale.set(.27, .045, .2 - i * .018); wing.add(feather);
        }
      }
      this.familiar.wings = wings;
    }
  }

  private move(delta: THREE.Vector2, dt: number) {
    const pos = this.player.group.position; const movement = delta.clone().normalize().multiplyScalar(this.stats.speed * dt);
    const x = pos.x + movement.x, z = pos.z + movement.y;
    if (this.world.isWalkable(x, z)) { pos.x = x; pos.z = z; }
    else if (this.world.isWalkable(x, pos.z)) pos.x = x;
    else if (this.world.isWalkable(pos.x, z)) pos.z = z;
    pos.y = this.world.walkHeight(pos.x, pos.z);
    this.player.group.rotation.y = dampAngle(this.player.group.rotation.y, Math.atan2(delta.x, delta.y), Math.min(1, dt * 13));
  }

  private tick(dt: number) {
    this.hero.playtime += dt; this.attackTimer -= dt; this.attackPose = Math.max(0, this.attackPose - dt); this.castPose = Math.max(0, this.castPose - dt);
    this.guard = Math.max(0, this.guard - dt); this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.cooldowns = this.cooldowns.map(c => Math.max(0, c - dt)); this.potionCooldowns = this.potionCooldowns.map(c => Math.max(0, c - dt));
    this.hero.sp = Math.min(this.stats.sp, this.hero.sp + dt * (this.time - this.lastDamage > 5 ? 3.6 : 1.6));
    if (this.time - this.lastDamage > 7) this.hero.hp = Math.min(this.stats.hp, this.hero.hp + dt * (this.stats.hp * .018));
    const pos = this.player.group.position;
    let moving = false;
    const input = this.joystick.clone();
    if (this.keys.has('w') || this.keys.has('arrowup')) input.y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) input.y += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) input.x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) input.x += 1;
    if (input.lengthSq() > .01) {
      const worldMove = new THREE.Vector2(input.x * Math.cos(this.cameraYaw) + input.y * Math.sin(this.cameraYaw), -input.x * Math.sin(this.cameraYaw) + input.y * Math.cos(this.cameraYaw));
      this.path = []; this.autoAttack = false; this.move(worldMove, dt); moving = true;
    } else if (this.autoAttack && this.target && this.target.hp > 0) {
      const distance = this.target.position.distanceTo(pos); const reach = this.stats.range + (this.target.boss ? 1 : .25);
      if (distance > reach) {
        this.pathRefresh -= dt;
        if (this.pathRefresh <= 0) {
          this.pathRefresh = .9; this.path = findPath(this.world, new THREE.Vector2(pos.x, pos.z), new THREE.Vector2(this.target.position.x, this.target.position.z));
        }
      } else {
        this.path = []; this.player.group.rotation.y = dampAngle(this.player.group.rotation.y, Math.atan2(this.target.position.x - pos.x, this.target.position.z - pos.z), Math.min(1, dt * 12));
        if (this.attackTimer <= 0) {
          this.attackTimer = this.job.family === 'thief' ? .62 : this.job.family === 'archer' ? .74 : .86; this.attackPose = .45;
          this.damage(this.target, this.stats.attack); this.audio.play('attack');
          if (this.stats.range > 3) this.effects.projectile(pos.clone().add(new THREE.Vector3(0, 1.35, 0)), this.target.position.clone().add(new THREE.Vector3(0, .65, 0)), this.job.color, .20);
          else this.effects.slash(pos.clone().lerp(this.target.position, .45), '#ffe4b4', this.player.group.rotation.y);
        }
      }
    }
    if (input.lengthSq() < .01 && this.path.length) {
      const next = this.path[0]; const delta = next.clone().sub(new THREE.Vector2(pos.x, pos.z));
      if (delta.length() < .22) this.path.shift();
      else { this.move(delta, dt); moving = true; }
    }
    this.player.update(this.time, dt, moving, this.attackPose, this.castPose, this.dead);

    for (const enemy of this.enemies) this.tickEnemy(enemy, dt);
    this.tickZones(dt);
    if (this.familiar) {
      const f = this.familiar; f.remaining -= dt; f.nextAttack -= dt;
      const desired = pos.clone().add(new THREE.Vector3(1.1, .05, 1));
      f.model.group.position.lerp(desired, Math.min(1, dt * 3.4)); f.model.group.position.y = this.world.walkHeight(f.model.group.position.x, f.model.group.position.z);
      if (f.wings) {
        f.model.group.position.y += 1.6 + Math.sin(this.time * 3) * .12;
        f.model.group.rotation.y = this.cameraYaw;
        f.wings.forEach((wing, i) => wing.rotation.z = Math.sin(this.time * 14) * .65 * (i ? 1 : -1));
      }
      f.model.update(this.time, moving, 0, 0, this.cameraYaw);
      if (f.nextAttack <= 0) {
        f.nextAttack = 1.35;
        const target = this.target?.hp && this.target.hp > 0 ? this.target : !f.permanent ? this.closestEnemy(8) : null;
        if (target && target.position.distanceTo(pos) < 11) {
          this.damage(target, this.stats.attack * (f.permanent ? .42 : .8));
          this.effects.projectile(f.model.group.position.clone().add(new THREE.Vector3(0, .5, 0)), target.position.clone().add(new THREE.Vector3(0, .6, 0)), '#c2ecbf', .3);
        }
      }
      if (f.remaining <= 0) { this.scene.remove(f.model.group); f.model.dispose(); this.familiar = undefined; if (this.hero.claimed[2]) this.makeFamiliar(true); }
    }

    this.interaction = null; this.interactionName = '';
    if (pos.distanceTo(this.world.npcPosition) < 3.4) { this.interaction = 'npc'; this.interactionName = `与${this.world.map.npcName}交谈`; }
    else if (this.world.chests.some(c => !c.opened && Math.hypot(c.x - pos.x, c.z - pos.z) < 2.8)) { this.interaction = 'chest'; this.interactionName = '打开旅人的宝箱'; }
    if (this.time > 1.6) for (const portal of this.world.portals) if (Math.hypot(pos.x - portal.x, pos.z - portal.z) < 1.35) { this.travelTo(portal.to, portal.north); break; }
    this.saveTime += dt; if (this.saveTime >= 8) { this.save(); this.saveTime = 0; }
  }

  private moveEnemy(enemy: Enemy, x: number, z: number, dt: number, speed: number) {
    const pos = enemy.position; const dx = x - pos.x, dz = z - pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .001) return false;
    const step = Math.min(1, dt * speed / distance);
    const nx = pos.x + dx * step, nz = pos.z + dz * step;
    const beforeX = pos.x, beforeZ = pos.z;
    if (this.world.isWalkable(nx, nz, .1)) { pos.x = nx; pos.z = nz; }
    else if (this.world.isWalkable(nx, pos.z, .1)) pos.x = nx;
    else if (this.world.isWalkable(pos.x, nz, .1)) pos.z = nz;
    return pos.x !== beforeX || pos.z !== beforeZ;
  }

  private returnEnemyHome(enemy: Enemy, dt: number) {
    const pos = enemy.position;
    if (Math.hypot(pos.x - enemy.spawn.x, pos.z - enemy.spawn.y) < .22) {
      pos.x = enemy.spawn.x; pos.z = enemy.spawn.y;
      enemy.returning = false; enemy.returnPath = []; enemy.attackTimer = 1;
      // Recover once, at home, only if the player has actually left the fight.
      if (enemy.poison <= 0 && (this.dead || pos.distanceTo(this.player.group.position) > 20)) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * .3);
      return false;
    }
    if (enemy.rooted > 0) return false;
    enemy.returnRefresh -= dt;
    if (enemy.returnRefresh <= 0) {
      enemy.returnRefresh = 1;
      enemy.returnPath = findPath(this.world, new THREE.Vector2(pos.x, pos.z), enemy.spawn);
    }
    while (enemy.returnPath.length && Math.hypot(enemy.returnPath[0].x - pos.x, enemy.returnPath[0].y - pos.z) < .2) enemy.returnPath.shift();
    const next = enemy.returnPath[0];
    return next ? this.moveEnemy(enemy, next.x, next.y, dt, 4) : false;
  }

  private tickEnemy(enemy: Enemy, dt: number) {
    enemy.hit = Math.max(0, enemy.hit - dt); enemy.rooted = Math.max(0, enemy.rooted - dt);
    if (enemy.hp <= 0) {
      enemy.death = Math.min(1, enemy.death + dt * 2.6); enemy.respawn -= dt;
      enemy.model.update(this.time, false, 0, enemy.death, this.cameraYaw);
      if (enemy.respawn <= 0) {
        enemy.hp = enemy.maxHp; enemy.death = 0; enemy.model.group.visible = true; enemy.aggro = false; enemy.poison = 0;
        enemy.returning = false; enemy.returnPath = [];
        enemy.position.set(enemy.spawn.x, this.world.walkHeight(enemy.spawn.x, enemy.spawn.y), enemy.spawn.y);
      }
      return;
    }
    if (enemy.poison > 0) {
      enemy.poison -= dt; enemy.poisonTick -= dt;
      if (enemy.poisonTick <= 0) { enemy.poisonTick = 1; this.damage(enemy, enemy.poisonPower, undefined, true); if (enemy.hp <= 0) return; }
    }
    const player = this.player.group.position; const distance = player.distanceTo(enemy.position);
    const homeDistance = Math.hypot(enemy.position.x - enemy.spawn.x, enemy.position.z - enemy.spawn.y);
    if (!this.dead && !enemy.returning && !enemy.aggro && distance < (enemy.boss ? 7 : this.hero.mapId > 0 ? 2.7 : 0)) enemy.aggro = true;
    if (!enemy.returning && enemy.aggro && (this.dead || distance > 20 || homeDistance > 18)) {
      enemy.aggro = false;
      if (homeDistance > .22) {
        enemy.returning = true; enemy.returnPath = []; enemy.returnRefresh = 0;
        if (enemy.boss) this.emit({ type: 'float', text: '返回领地', color: '#ffe0aa', position: enemy.position.clone().add(new THREE.Vector3(0, 3.4, 0)) });
      }
    }
    let moving = false;
    if (enemy.returning) moving = this.returnEnemyHome(enemy, dt);
    else if (enemy.aggro && !this.dead) {
      enemy.attackTimer -= dt;
      if (distance > (enemy.boss ? 2.6 : 1.25) && enemy.rooted <= 0) moving = this.moveEnemy(enemy, player.x, player.z, dt, enemy.boss ? 1.7 : 2.5 + this.hero.mapId * .25);
      else if (distance < (enemy.boss ? 3 : 1.65) && enemy.attackTimer <= 0) {
        enemy.attackTimer = enemy.boss ? 2.8 : 1.65;
        if (enemy.boss) {
          const at = player.clone(); this.danger.push({ at, remaining: 1.15, radius: 3.5, damage: enemy.attack * 1.7 });
          this.effects.ring(at, '#ef967d', 3.5, 1.15, true, true);
          this.emit({ type: 'float', text: '糖霜冲击 · 离开光圈', color: '#ffe0aa', position: enemy.position.clone().add(new THREE.Vector3(0, 3.4, 0)) });
        } else this.hurt(enemy.attack);
      }
    } else {
      enemy.wanderTimer -= dt;
      if (enemy.wanderTimer <= 0) {
        enemy.wanderTimer = 2 + Math.random() * 4;
        enemy.wander.set(Math.sin(Math.random() * 6) * .55, Math.cos(Math.random() * 6) * .55);
        if (Math.random() < .45) enemy.wander.set(0, 0);
      }
      if (enemy.rooted <= 0 && enemy.wander.lengthSq() > .01 && !enemy.boss) {
        const x = enemy.position.x + enemy.wander.x * dt; const z = enemy.position.z + enemy.wander.y * dt;
        if (Math.hypot(x - enemy.spawn.x, z - enemy.spawn.y) < 3.3 && this.world.isWalkable(x, z, .1)) { enemy.position.x = x; enemy.position.z = z; moving = true; }
        else enemy.wander.multiplyScalar(-1);
      }
    }
    enemy.position.y = this.world.walkHeight(enemy.position.x, enemy.position.z);
    enemy.model.update(this.time, moving, enemy.hit / .22, 0, this.cameraYaw);
  }

  private tickZones(dt: number) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]; z.remaining -= dt; z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 1;
        this.areaDamage(z.at, z.radius, z.power);
        if (z.healing && this.player.group.position.distanceTo(z.at) < z.radius) this.heal(z.power * 1.2, true);
        for (let j = 0; j < 6; j++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * z.radius;
          const at = z.at.clone().add(new THREE.Vector3(Math.sin(a) * r, .2, Math.cos(a) * r));
          this.effects.projectile(at.clone().add(new THREE.Vector3(-.5, 5 + Math.random() * 3, -.8)), at, z.color, .35);
          this.effects.burst(at, z.color, 5, .9);
        }
        this.effects.ring(z.at, z.color, z.radius, .85);
      }
      if (z.remaining <= 0) this.zones.splice(i, 1);
    }
    for (let i = this.danger.length - 1; i >= 0; i--) {
      const d = this.danger[i]; d.remaining -= dt;
      if (d.remaining <= 0) {
        this.effects.burst(d.at.clone().add(new THREE.Vector3(0, .2, 0)), '#f9c2c3', 65, 4, 3);
        this.effects.ring(d.at, '#ffe4be', d.radius, .45);
        if (this.player.group.position.distanceTo(d.at) < d.radius) this.hurt(d.damage);
        this.danger.splice(i, 1);
      }
    }
  }

  private travelTo(to: MapId, north: boolean) {
    if (this.travel || this.dead) return;
    this.transitioning = true; this.travel = { to, north, time: .85, switched: false }; this.path = []; this.keys.clear(); this.autoAttack = false; this.joystick.set(0, 0);
    this.audio.play('portal'); this.emit({ type: 'transition', active: true, name: MAPS[to].name });
  }
  private changeMap(to: MapId, north: boolean) {
    this.target = null; this.hovered = null; this.targetRing.visible = false; this.path = [];
    this.enemies.forEach(e => { this.scene.remove(e.model.group); e.model.dispose(); }); this.enemies = [];
    this.effects.clear(); this.zones = []; this.danger = [];
    this.scene.remove(this.world.root); this.world.dispose(); this.world = new World(to, this.hero.openedChests); this.scene.add(this.world.root);
    this.hero.mapId = to; if (!this.hero.visited.includes(to)) this.hero.visited.push(to);
    this.scene.background = new THREE.Color(this.world.map.sky); this.scene.fog = new THREE.Fog(this.world.map.sky, 50, 112);
    const z = north ? 23 : -24; const x = this.world.pathX(z); this.player.group.position.set(x, this.world.walkHeight(x, z), z);
    this.hero.x = x; this.hero.z = z; this.focus.copy(this.player.group.position).add(new THREE.Vector3(0, 0, -2.5));
    this.populate(); if (this.familiar) this.familiar.model.group.position.copy(this.player.group.position);
    this.invulnerable = 3; this.emit({ type: 'map', id: to }); this.log(`抵达${this.world.map.name}。${this.world.map.subtitle}`); this.save();
  }
  private updateCamera(dt: number, snap = false) {
    const desired = this.player.group.position.clone().add(new THREE.Vector3(0, 0, -2.3));
    this.focus.lerp(desired, snap ? 1 : 1 - Math.exp(-6 * dt));
    this.camera.position.copy(this.focus).add(new THREE.Vector3(Math.sin(this.cameraYaw) * 26, 26, Math.cos(this.cameraYaw) * 26));
    this.camera.lookAt(this.focus); this.camera.updateMatrixWorld();
  }
  private resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    this.renderer.setSize(width, height); const aspect = width / height;
    this.camera.left = -this.viewHeight * aspect / 2; this.camera.right = this.viewHeight * aspect / 2;
    this.camera.top = this.viewHeight / 2; this.camera.bottom = -this.viewHeight / 2; this.camera.updateProjectionMatrix();
  }
  applyQuality(quality: 'high' | 'balanced') {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1));
    this.renderer.shadowMap.enabled = quality === 'high';
    if (this.resizeObserver) this.resize();
  }
  project(position: THREE.Vector3) {
    const p = position.clone().project(this.camera); const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: (p.x * .5 + .5) * rect.width + rect.left, y: (-p.y * .5 + .5) * rect.height + rect.top, visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
  }
  private frame = (now: number) => {
    const realDt = this.previous ? (now - this.previous) / 1000 : .016; const dt = Math.min(.20, realDt); this.previous = now;
    if (!document.hidden) {
      this.time += dt;
      if (this.travel) {
        this.travel.time -= dt;
        if (this.travel.time <= .47 && !this.travel.switched) { this.travel.switched = true; this.changeMap(this.travel.to, this.travel.north); }
        if (this.travel.time <= 0) { this.travel = undefined; this.transitioning = false; this.emit({ type: 'transition', active: false }); }
      } else if (!this.paused && !this.dead) {
        // Small simulation steps keep movement, damage, and collision consistent on slower GPUs.
        let remaining = dt;
        while (remaining > 0 && !this.dead && !this.paused && !this.transitioning) { const step = Math.min(remaining, .04); this.tick(step); remaining -= step; }
      }
      else this.player.update(this.time, dt, false, 0, 0, this.dead);
      this.world.update(this.time, dt); this.effects.update(dt); this.updateCamera(dt);
      this.world.updateCanopyVisibility(this.player.group.position, this.camera, dt, this.target && this.target.hp > 0 ? this.target.position : undefined);
      this.targetRing.visible = Boolean(this.target && this.target.hp > 0);
      if (this.target) { this.targetRing.position.copy(this.target.position); this.targetRing.position.y += .05; this.targetRing.scale.setScalar(this.target.boss ? 1.9 : .85); }
      this.renderer.render(this.scene, this.camera);
      this.updateTime += dt; if (this.updateTime >= .09) { this.emit({ type: 'update' }); this.updateTime = 0; }
      this.frameCount++; this.fpsTime += realDt;
      if (this.fpsTime >= 1) { this.fps = Math.round(this.frameCount / this.fpsTime); this.frameCount = 0; this.fpsTime = 0; }
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  save() {
    this.hero.x = this.player.group.position.x; this.hero.z = this.player.group.position.z;
    const ok = persistHero(this.hero);
    this.saved = ok;
    if (!ok && !this.saveFailed) { this.saveFailed = true; this.toast('浏览器暂时无法保存进度', '当前冒险仍可继续；请检查是否开启了无痕模式或存储已满。', 'save'); }
    return ok;
  }
  private log(message: string, channel: 'world' | 'combat' | 'loot' = 'world') { this.emit({ type: 'log', message, channel }); }
  private toast(title: string, detail?: string, icon?: string) { this.emit({ type: 'toast', title, detail, icon }); }
  dispose() {
    this.save(); cancelAnimationFrame(this.raf); this.abort.abort(); this.resizeObserver.disconnect();
    this.enemies.forEach(e => e.model.dispose()); this.world.dispose(); this.player.dispose(); this.effects.dispose();
    this.familiar?.model.dispose(); this.sunlight.shadow.dispose(); this.targetRing.geometry.dispose(); (this.targetRing.material as THREE.Material).dispose(); this.scene.clear();
  }
}
