import * as THREE from 'three';
import type { Game, GameEvent } from '../game/Game';
import type { Job } from '../data/jobs';
import { activeQuest, questProgress, questReady, QUESTS, xpForLevel, type HeroSave } from '../game/state';
import { icon, escapeHTML, ornament } from './icons';

export function hudMarkup(hero: HeroSave, job: Job) {
  return `
    <section class="status-window game-window" aria-label="角色状态">
      <div class="status-avatar" style="--job-color:${job.color}">${icon(job.icon, '', 33)}<span id="status-level">1</span></div>
      <div class="status-content"><div class="status-heading"><strong>${escapeHTML(hero.name)}</strong><span>${job.name}</span><button class="tiny-button" data-action="character" aria-label="打开角色属性">${icon('plus', '', 13)}</button></div>
        <div class="status-bar hp-bar"><span id="hp-fill"></span><b>HP</b><small id="hp-text"></small></div>
        <div class="status-bar sp-bar"><span id="sp-fill"></span><b>SP</b><small id="sp-text"></small></div>
        <div class="status-bottom"><span id="status-base">Base Lv. 1</span><span class="zeny">${icon('coin', '', 12)}<b id="zeny-value">80</b> Z</span></div>
      </div>
      <div id="buff-indicator" class="buff-indicator" hidden>${icon('shield', '', 13)} <span></span></div>
    </section>

    <div class="location-pill"><span class="location-spark">${icon('spark', '', 15)}</span><span id="location-name">晨曦山谷</span><i></i><span class="location-weather">${icon('sun', '', 13)} 晴</span></div>
    <div id="target-window" class="target-window game-window" hidden><div><span id="target-name"></span><small id="target-level"></small></div><div class="target-health"><i id="target-health-fill"></i></div><small id="target-health-text"></small></div>

    <aside class="map-corner">
      <div class="map-topline"><span>${icon('globe', '', 12)} MIDGARD</span><button class="tiny-button" data-action="settings" aria-label="游戏设置">${icon('settings', '', 16)}</button></div>
      <button class="minimap-wrap" data-action="map" aria-label="打开完整地图，快捷键 M"><canvas id="minimap" width="400" height="400"></canvas><span class="compass-n">N</span><span class="minimap-expand">${icon('expand', '', 13)}</span></button>
      <div class="map-coordinates"><span id="map-coordinates">0, 0</span><span id="map-level">Lv. 1 — 5</span></div>
      <button id="quest-tracker" class="quest-tracker game-window" data-action="journal" aria-label="打开冒险手札"></button>
    </aside>

    <section class="chat-window game-window" aria-label="旅途记录"><div class="chat-tabs"><button data-action="log-all" class="active">旅途</button><button data-action="log-combat">战斗</button><span>ADVENTURE LOG</span><button data-action="log-collapse" class="tiny-button" aria-label="收起或展开旅途记录">${icon('minus', '', 12)}</button></div><div id="log-lines" role="log" aria-live="off"></div><div class="chat-footnote">${icon('feather', '', 12)} 把每一次相遇，写进冒险里。</div></section>

    <div id="interaction-hint" class="interaction-hint" hidden><button data-action="interact"><kbd>F</kbd><span></span>${icon('chevron', '', 14)}</button></div>
    <div id="first-tip" class="first-tip"><span>${icon('compass', '', 15)} 点击地面移动 · 点击魔物攻击 · <kbd>1</kbd>—<kbd>4</kbd> 施放技能</span><button class="tiny-button" data-action="dismiss-tip" aria-label="关闭操作提示">${icon('close', '', 13)}</button></div>

    <nav class="skill-dock" aria-label="战斗快捷栏">
      <button class="basic-attack" data-action="attack" aria-label="普通攻击，空格键">${icon(job.weapon === 'bow' ? 'bow' : 'sword', '', 28)}<kbd>SPACE</kbd></button>
      <div class="dock-separator"></div>
      ${job.skills.map((s, i) => `<button class="skill-slot" data-action="skill-${i}" style="--skill-color:${s.color}" aria-label="${s.name}，快捷键 ${i + 1}"><kbd>${i + 1}</kbd><span class="skill-art">${icon(s.icon, '', 30)}</span><span class="cooldown-shade"></span><span class="cooldown-number"></span><span class="skill-name">${s.name}</span><span class="skill-tooltip"><strong>${s.name}</strong><span>${s.description}</span><small>${s.cost} SP <i>·</i> 冷却 ${s.cooldown} 秒</small></span></button>`).join('')}
      <div class="dock-separator"></div>
      <button class="skill-slot potion-slot red-potion" data-action="potion-red" aria-label="红色药水，恢复 50% 生命，快捷键 Q"><kbd>Q</kbd>${icon('potion', '', 29)}<b id="red-count">8</b><span class="skill-name">红色药水</span><span class="skill-tooltip"><strong>红色药水</strong><span>恢复 50% 最大生命。</span><small>冷却 2 秒 · 向导处可补充</small></span></button>
      <button class="skill-slot potion-slot blue-potion" data-action="potion-blue" aria-label="蓝色药水，恢复 60% SP，快捷键 E"><kbd>E</kbd>${icon('potion', '', 29)}<b id="blue-count">5</b><span class="skill-name">蓝色药水</span><span class="skill-tooltip"><strong>蓝色药水</strong><span>恢复 60% 最大 SP。</span><small>冷却 2 秒 · 向导处可补充</small></span></button>
    </nav>

    <nav class="game-menu" aria-label="游戏菜单">${[['bag', 'bag', '背包', 'I'], ['character', 'person', '角色', 'C'], ['journal', 'scroll', '手札', 'J'], ['map', 'map', '地图', 'M']].map(([action, symbol, label, key]) => `<button data-action="${action}" aria-label="打开${label}，快捷键 ${key}">${icon(symbol, '', 21)}<span>${label}</span><kbd>${key}</kbd></button>`).join('')}<button class="menu-settings" data-action="settings" aria-label="游戏设置，Esc">${icon('settings', '', 19)}<span>设置</span></button></nav>
    <div class="experience-track"><div id="xp-fill"></div><span id="xp-label">BASE EXP 0 / 40</span></div>
    <div class="game-footer"><span>DreamRO <i>·</i> 仙境之梦</span><span id="save-indicator">${icon('save', '', 11)} 冒险已保存在此浏览器</span></div>
    <div class="mobile-joystick" id="joystick" aria-label="触屏移动摇杆"><span></span></div>
    <button class="mobile-attack" data-action="attack" aria-label="普通攻击">${icon('sword', '', 29)}</button>
    <div id="region-banner" class="region-banner"><span id="region-eyebrow">THE JOURNEY BEGINS</span><h2 id="region-title"></h2><div class="region-ornament">${ornament}</div><p id="region-subtitle"></p></div>
    <div id="world-labels" class="world-labels"></div>
  `;
}

export function drawMinimap(canvas: HTMLCanvasElement, game: Game, large = false) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const w = canvas.width, h = canvas.height, sx = w / 70, sy = h / 70;
  const x = (v: number) => (v + 35) * sx, y = (v: number) => (v + 35) * sy;
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = game.hero.mapId === 1 ? '#b2c6b5' : game.hero.mapId === 2 ? '#d7d0af' : '#c3cd9e'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(244,240,198,.22)';
  for (let i = 0; i < 15; i++) { ctx.beginPath(); ctx.ellipse(x(Math.sin(i * 8) * 25), y(Math.cos(i * 6) * 24), sx * 8, sy * 3, i, 0, Math.PI * 2); ctx.fill(); }
  if (game.hero.mapId < 2) {
    ctx.strokeStyle = '#87bdbc'; ctx.lineWidth = sy * 5.4; ctx.beginPath();
    for (let i = -36; i <= 36; i++) { const xx = x(i), yy = y(game.world.riverZ(i)); if (i === -36) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); } ctx.stroke();
    ctx.strokeStyle = 'rgba(234,249,220,.45)'; ctx.lineWidth = sy * .35; ctx.stroke();
  }
  ctx.strokeStyle = '#e5d4ac'; ctx.lineWidth = sx * 3.4; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = -35; i <= 35; i++) { if (i === -35) ctx.moveTo(x(game.world.pathX(i)), y(i)); else ctx.lineTo(x(game.world.pathX(i)), y(i)); } ctx.stroke();
  if (game.hero.mapId < 2) { ctx.fillStyle = '#b29e7c'; ctx.fillRect(x(game.world.pathX(3) - 2), y(-1.3), sx * 4, sy * 9); }
  if (game.hero.mapId === 0) {
    for (const [xx, zz, s] of [[-13, 25, 4.8], [-20, 19, 3.8], [24, -12, 5]]) { ctx.fillStyle = '#a28b73'; ctx.fillRect(x(xx - s / 2), y(zz - s / 2), s * sx, s * sy * .8); ctx.fillStyle = '#c3a181'; ctx.fillRect(x(xx - s / 2), y(zz - s / 2), s * sx, sy); }
  }
  if (game.hero.mapId === 2) { ctx.strokeStyle = '#e8dfc6'; ctx.lineWidth = sx; ctx.beginPath(); ctx.arc(x(game.world.pathX(-16)), y(-16), sx * 8, 0, Math.PI * 2); ctx.stroke(); }
  for (const tree of game.world.trees) {
    ctx.fillStyle = game.hero.mapId === 1 ? '#7e9e87' : '#97ad7d'; ctx.beginPath(); ctx.arc(x(tree.x), y(tree.z), tree.size * sx * .63, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(74,116,85,.18)'; ctx.beginPath(); ctx.arc(x(tree.x) - sx * .35, y(tree.z) + sy * .4, tree.size * sx * .55, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(107,121,91,.12)'; ctx.lineWidth = 1;
  for (let i = -30; i <= 30; i += 10) { ctx.beginPath(); ctx.moveTo(x(i), 0); ctx.lineTo(x(i), h); ctx.moveTo(0, y(i)); ctx.lineTo(w, y(i)); ctx.stroke(); }
  for (const e of game.enemies) if (e.hp > 0) {
    ctx.fillStyle = e.boss ? '#a9709e' : e === game.target ? '#d47f72' : '#d999a4'; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = sx * .15;
    ctx.beginPath(); ctx.arc(x(e.position.x), y(e.position.z), sx * (e.boss ? 1.35 : .53), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (e.boss && large) { ctx.font = `${Math.round(w / 40)}px "PingFang SC", sans-serif`; ctx.textAlign = 'center'; ctx.fillText('波利女王', x(e.position.x), y(e.position.z) - 15); }
  }
  for (const c of game.world.chests) if (!c.opened) { ctx.fillStyle = '#efd79b'; ctx.strokeStyle = '#aa8550'; ctx.lineWidth = 1.5; ctx.fillRect(x(c.x) - sx * .6, y(c.z) - sy * .5, sx * 1.2, sy); ctx.strokeRect(x(c.x) - sx * .6, y(c.z) - sy * .5, sx * 1.2, sy); }
  for (const portal of game.world.portals) {
    ctx.strokeStyle = '#f8f7da'; ctx.lineWidth = sx * .7; ctx.beginPath(); ctx.arc(x(portal.x), y(portal.z), sx * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#6bb7bc'; ctx.lineWidth = sx * .3; ctx.stroke();
    if (large) { ctx.fillStyle = '#577e7c'; ctx.font = `500 ${Math.round(w / 39)}px "PingFang SC", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(portal.north ? '向北 · 下一站' : '归途 · 上一站', x(portal.x), y(portal.z) + (portal.north ? 24 : -17)); }
  }
  const npc = game.world.npcPosition;
  ctx.save(); ctx.translate(x(npc.x), y(npc.z)); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#d4af63'; ctx.strokeStyle = '#ffefbf'; ctx.lineWidth = sx * .3; ctx.fillRect(-sx * .65, -sy * .65, sx * 1.3, sy * 1.3); ctx.strokeRect(-sx * .65, -sy * .65, sx * 1.3, sy * 1.3); ctx.restore();
  if (large) { ctx.fillStyle = '#7d704b'; ctx.font = `500 ${Math.round(w / 37)}px "PingFang SC", sans-serif`; ctx.textAlign = 'right'; ctx.fillText(game.world.map.npcName, x(npc.x) - 12, y(npc.z) + 4); }
  const pos = game.player.group.position;
  ctx.save(); ctx.translate(x(pos.x), y(pos.z)); ctx.rotate(-game.player.group.rotation.y);
  ctx.fillStyle = 'rgba(255,253,222,.4)'; ctx.beginPath(); ctx.arc(0, 0, sx * 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fffcdf'; ctx.strokeStyle = '#628b83'; ctx.lineWidth = sx * .30; ctx.beginPath(); ctx.moveTo(0, sy * 1.4); ctx.lineTo(-sx * .92, -sy * .84); ctx.lineTo(0, -sy * .4); ctx.lineTo(sx * .92, -sy * .84); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

export class HUD {
  private game?: Game;
  private labelsRoot: HTMLElement;
  private playerLabel: HTMLElement;
  private enemyLabels: HTMLElement[] = [];
  private nodes = new Map<string, HTMLElement>();
  private floats: { element: HTMLElement; position: THREE.Vector3; start: number; duration: number }[] = [];
  private logs: { message: string; channel: string; time: string }[] = [];
  private logFilter = 'all';
  private questKey = '';
  private raf = 0;
  private lastMap = 0;
  private regionTimer?: number;
  private tipTimer?: number;

  constructor(private root: HTMLElement, hero: HeroSave, job: Job) {
    root.innerHTML = hudMarkup(hero, job);
    root.querySelectorAll<HTMLElement>('[id]').forEach(el => this.nodes.set(el.id, el));
    this.labelsRoot = this.nodes.get('world-labels')!;
    this.playerLabel = document.createElement('div'); this.playerLabel.className = 'player-world-label'; this.playerLabel.innerHTML = `<span>${escapeHTML(hero.name)}</span><small>${job.name}</small>`; this.labelsRoot.append(this.playerLabel);
  }
  attach(game: Game) {
    this.game = game; this.makeEnemyLabels(); this.update(); this.raf = requestAnimationFrame(this.frame);
    this.tipTimer = window.setTimeout(() => this.nodes.get('first-tip')!.classList.add('dismissed'), 14000);
    const joystick = this.root.querySelector<HTMLElement>('#joystick')!; const nub = joystick.querySelector('span')!;
    let joystickPointer = -1;
    const update = (e: PointerEvent) => {
      if (e.pointerId !== joystickPointer) return;
      const rect = joystick.getBoundingClientRect(); const vector = new THREE.Vector2((e.clientX - rect.left - rect.width / 2) / 34, (e.clientY - rect.top - rect.height / 2) / 34);
      if (vector.length() > 1) vector.normalize(); nub.style.transform = `translate(${vector.x * 27}px,${vector.y * 27}px)`; game.setJoystick(vector.x, vector.y);
    };
    joystick.addEventListener('pointerdown', e => { joystickPointer = e.pointerId; joystick.setPointerCapture(e.pointerId); update(e); });
    joystick.addEventListener('pointermove', update);
    const release = () => { joystickPointer = -1; game.setJoystick(0, 0); nub.style.transform = ''; };
    joystick.addEventListener('pointerup', release); joystick.addEventListener('pointercancel', release);
  }
  private makeEnemyLabels() {
    this.enemyLabels.forEach(e => e.remove()); this.enemyLabels = [];
    this.game!.enemies.forEach(enemy => {
      const el = document.createElement('div'); el.className = 'enemy-world-label'; el.innerHTML = `<span>${escapeHTML(enemy.name)}</span><i><b></b></i>`;
      this.labelsRoot.append(el); this.enemyLabels.push(el);
    });
  }
  handle(event: GameEvent) {
    if (event.type === 'update') this.update();
    else if (event.type === 'float') {
      const element = document.createElement('span'); element.className = `floating-number${event.big ? ' critical' : ''}`; element.textContent = event.text; element.style.color = event.color; this.labelsRoot.append(element);
      this.floats.push({ element, position: event.position, start: performance.now(), duration: event.big ? 1350 : 1150 });
    } else if (event.type === 'log') {
      const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      this.logs.push({ ...event, time }); if (this.logs.length > 70) this.logs.shift(); this.renderLog();
    } else if (event.type === 'map') {
      const map = this.game!.world.map;
      this.nodes.get('location-name')!.textContent = map.name; this.nodes.get('map-level')!.textContent = map.level;
      this.nodes.get('region-title')!.textContent = map.name; this.nodes.get('region-subtitle')!.textContent = map.subtitle;
      this.nodes.get('region-eyebrow')!.textContent = map.en.toUpperCase();
      const banner = this.nodes.get('region-banner')!; banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
      if (this.regionTimer) clearTimeout(this.regionTimer); this.regionTimer = window.setTimeout(() => banner.classList.remove('show'), 5200);
      this.makeEnemyLabels(); this.questKey = ''; this.update();
    }
  }
  private text(id: string, value: string) { const el = this.nodes.get(id)!; if (el.textContent !== value) el.textContent = value; }
  update() {
    const game = this.game; if (!game) return;
    const h = game.hero, stats = game.stats;
    this.text('status-level', String(h.level)); this.text('status-base', `Base Lv. ${h.level}`);
    this.text('hp-text', `${Math.ceil(h.hp)} / ${stats.hp}`); this.text('sp-text', `${Math.floor(h.sp)} / ${stats.sp}`);
    this.nodes.get('hp-fill')!.style.width = `${h.hp / stats.hp * 100}%`; this.nodes.get('sp-fill')!.style.width = `${h.sp / stats.sp * 100}%`;
    this.text('zeny-value', h.zeny.toLocaleString()); this.text('red-count', String(h.redPotions)); this.text('blue-count', String(h.bluePotions));
    this.nodes.get('xp-fill')!.style.width = `${h.xp / xpForLevel(h.level) * 100}%`; this.text('xp-label', `BASE EXP  ${h.xp} / ${xpForLevel(h.level)}  (${Math.floor(h.xp / xpForLevel(h.level) * 100)}%)`);
    const pos = game.player.group.position; this.text('map-coordinates', `${Math.round(pos.x + 35)}, ${Math.round(35 - pos.z)}`);
    const buff = this.nodes.get('buff-indicator')!; buff.hidden = game.guard <= 0;
    if (game.guard > 0) buff.querySelector('span')!.textContent = `守护 ${Math.ceil(game.guard)}s`;
    this.root.querySelectorAll<HTMLElement>('[data-action^="skill-"]').forEach((button, i) => {
      const remaining = game.cooldowns[i]; button.style.setProperty('--cooldown', `${remaining / game.job.skills[i].cooldown * 100}%`);
      const number = button.querySelector('.cooldown-number')!; number.textContent = remaining > 0 ? String(Math.ceil(remaining)) : '';
      button.classList.toggle('on-cooldown', remaining > 0); button.classList.toggle('no-mana', h.sp < game.job.skills[i].cost);
    });
    const target = game.target; const targetWindow = this.nodes.get('target-window')!; targetWindow.hidden = !target || target.hp <= 0;
    if (target && target.hp > 0) { this.text('target-name', target.name); this.text('target-level', target.returning ? '返回领地' : target.boss ? 'MVP · BOSS' : `Lv. ${h.mapId * 3 + 1}`); this.nodes.get('target-health-fill')!.style.width = `${target.hp / target.maxHp * 100}%`; this.text('target-health-text', `${target.hp} / ${target.maxHp}`); }
    const hint = this.nodes.get('interaction-hint')!; hint.hidden = !game.interaction || game.paused || game.dead;
    if (game.interaction) hint.querySelector('span')!.textContent = game.interactionName;
    const index = activeQuest(h); const key = `${index}-${index < 0 ? 0 : questProgress(h, index)}-${h.mapId}-${h.claimed.join()}`;
    if (key !== this.questKey) {
      this.questKey = key;
      const tracker = this.nodes.get('quest-tracker')!;
      if (index < 0) tracker.innerHTML = `<div class="quest-tracker-head">${icon('star', '', 16)} <span>山谷的守望者</span>${icon('check', '', 13)}</div><p>故事有了一个温柔的结尾，<br>而冒险，还可以继续。</p><small>打开手札，重温这段旅程 ${icon('chevron', '', 12)}</small>`;
      else {
        const q = QUESTS[index], count = questProgress(h, index), ready = questReady(h, index);
        tracker.innerHTML = `<div class="quest-tracker-head">${icon('scroll', '', 16)}<span>冒险手札</span><kbd>J</kbd></div><h3>${q.name}</h3><p>${ready ? `回到${['莉露', '菲恩', '星语者'][index]}身边领取谢礼` : h.mapId !== index ? `前往${['晨曦山谷', '萤语森林', '星落遗迹'][index]}` : q.objective}<b>${ready ? icon('check', '', 14) : `${count}<em> / ${q.need}</em>`}</b></p><div class="quest-progress"><i style="width:${count / q.need * 100}%"></i></div><small>${ready ? '靠近旅人后，按 F 交谈' : index === 0 ? '每个传说，都始于小小的一步' : '沿北边的小路，穿过发光的石门'} ${icon('chevron', '', 12)}</small>`;
      }
    }
  }
  filterLog(combat: boolean) {
    this.logFilter = combat ? 'combat' : 'all'; this.root.querySelector('[data-action="log-all"]')!.classList.toggle('active', !combat); this.root.querySelector('[data-action="log-combat"]')!.classList.toggle('active', combat); this.renderLog();
  }
  private renderLog() {
    const element = this.nodes.get('log-lines')!;
    element.innerHTML = this.logs.filter(l => this.logFilter === 'all' || l.channel === 'combat').slice(-20).map(l => `<p class="log-${l.channel}"><time>${l.time}</time><span>${escapeHTML(l.message)}</span></p>`).join(''); element.scrollTop = element.scrollHeight;
  }
  private frame = (now: number) => {
    const game = this.game;
    if (game && !document.hidden) {
      const point = game.project(game.player.group.position.clone().add(new THREE.Vector3(0, game.player.height * game.player.group.scale.y + .26, 0)));
      this.playerLabel.style.transform = `translate(${point.x}px,${point.y}px)`; this.playerLabel.hidden = !point.visible;
      this.enemyLabels.forEach((el, i) => {
        const enemy = game.enemies[i]; if (!enemy) return;
        const selected = enemy === game.target || enemy === game.hovered; const visible = enemy.hp > 0 && (selected || enemy.aggro || enemy.position.distanceTo(game.player.group.position) < 10);
        const p = game.project(enemy.position.clone().add(new THREE.Vector3(0, enemy.boss ? 3.3 : 1.32, 0)));
        el.hidden = !visible || !p.visible; if (el.hidden) return;
        el.style.transform = `translate(${p.x}px,${p.y}px)`; el.classList.toggle('selected', selected); el.querySelector('i')!.hidden = !selected && !enemy.aggro; (el.querySelector('b') as HTMLElement).style.width = `${enemy.hp / enemy.maxHp * 100}%`;
      });
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i]; const progress = (now - f.start) / f.duration;
        if (progress >= 1) { f.element.remove(); this.floats.splice(i, 1); continue; }
        const p = game.project(f.position.clone().add(new THREE.Vector3(0, progress * .9, 0)));
        f.element.style.transform = `translate(${p.x}px,${p.y}px) scale(${1 + Math.max(0, .15 - progress) * 2})`; f.element.style.opacity = String(Math.min(1, (1 - progress) * 4));
      }
      if (now - this.lastMap > 140) { drawMinimap(this.nodes.get('minimap') as HTMLCanvasElement, game); this.lastMap = now; }
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  dispose() {
    cancelAnimationFrame(this.raf); if (this.regionTimer) clearTimeout(this.regionTimer); if (this.tipTimer) clearTimeout(this.tipTimer);
    this.floats.forEach(f => f.element.remove()); this.root.innerHTML = '';
  }
}
