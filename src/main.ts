import * as THREE from 'three';
import './styles.css';
import { JOBS, HAIR_COLORS, getJob, type Job } from './data/jobs';
import { CharacterPreview } from './game/Preview';
import type { Appearance } from './game/Character';
import { Game, type GameEvent, type Panel } from './game/Game';
import { GameAudio } from './game/Audio';
import { MAPS } from './game/World';
import { createHero, loadHeroes, loadPreferences, persistHero, persistPreferences, questProgress, questReady, QUESTS, type HeroSave } from './game/state';
import { HUD, drawMinimap } from './ui/HUD';
import { icon, ornament, wingMark, escapeHTML } from './ui/icons';

class DreamRO {
  private app = document.querySelector<HTMLDivElement>('#app')!;
  private interface: HTMLElement;
  private sceneElement: HTMLElement;
  private modal: HTMLDialogElement;
  private toasts: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private preview?: CharacterPreview;
  private hud?: HUD;
  private game?: Game;
  private preferences = loadPreferences();
  private audio = new GameAudio(this.preferences);
  private audioReady = false;
  private selectedJob: Job = JOBS[1];
  private advanced = false;
  private appearance: Appearance = { hair: HAIR_COLORS[0], style: 0, feminine: false };
  private characterName = '';
  private panel: Panel | 'characters' | 'dialogue' | 'death' | 'victory' | null = null;
  private lastFocused?: HTMLElement;
  private toastHistory = new Map<string, number>();
  private beginning = false;

  constructor() {
    this.app.innerHTML = `<div class="creation-backdrop"><img src="/art/dawnlight.webp" alt="晨光中的幻想山谷，河流蜿蜒流向远方的白色城堡"/><div></div></div><div class="petals" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i};--x:${(i * 37 + 13) % 100}%"></i>`).join('')}</div><div id="scene" class="scene-viewport"></div><div id="interface"></div><div id="toast-container" aria-live="polite" aria-atomic="false"></div><div id="map-veil" class="map-veil"><div>${wingMark}<span></span><small>风正在带你去往新的地方</small></div></div><dialog class="fantasy-modal" id="modal" aria-labelledby="modal-title"></dialog>`;
    this.interface = this.app.querySelector('#interface')!; this.sceneElement = this.app.querySelector('#scene')!; this.modal = this.app.querySelector('#modal')!; this.toasts = this.app.querySelector('#toast-container')!;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.preferences.quality === 'high' ? 2 : 1));
    this.renderer.shadowMap.enabled = this.preferences.quality === 'high'; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.02;
    this.renderer.domElement.setAttribute('aria-label', '可拖动旋转的三维角色预览'); this.sceneElement.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); this.game?.setPaused(true); this.toast('画面暂时离开了一下', '冒险进度已保存，请刷新页面继续。', 'save'); });
    this.app.addEventListener('click', e => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (target && !target.hasAttribute('disabled')) this.action(target.dataset.action!, target);
    });
    this.modal.addEventListener('cancel', e => { e.preventDefault(); this.closeModal(); });
    this.modal.addEventListener('click', e => {
      if (e.target !== this.modal) return; const rect = this.modal.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) this.closeModal();
    });
    window.addEventListener('keydown', e => {
      if (!this.game || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.ctrlKey || e.metaKey || e.altKey) return;
      const panels: Record<string, Panel> = { i: 'bag', c: 'character', j: 'journal', m: 'map' };
      const key = e.key.toLowerCase();
      if (this.panel === 'death' || this.panel === 'victory') return;
      if (panels[key]) { e.preventDefault(); this.panel === panels[key] ? this.closeModal() : this.openPanel(panels[key]); }
      else if (e.key === 'Escape' && !this.modal.open) { e.preventDefault(); this.openPanel('settings'); }
    });
    document.addEventListener('visibilitychange', () => void this.audio.suspend(document.hidden));
    this.showCreation();
    this.toasts.setAttribute('popover', 'manual');
    if (import.meta.env.DEV) {
      Object.defineProperty(window, '__dreamro', { configurable: true, get: () => ({ game: this.game, app: this, jobs: JOBS, selectedJob: this.selectedJob.id, renderer: this.renderer }) });
    }
  }

  private showCreation() {
    if (this.modal.open) this.closeModal(true);
    this.game?.dispose(); this.game = undefined; this.hud?.dispose(); this.hud = undefined;
    this.preview?.dispose(); this.app.className = 'creating'; this.renderer.setClearColor(0x000000, 0);
    const heroes = loadHeroes();
    this.interface.innerHTML = `
      <header class="creation-header"><a class="brand" href="/" aria-label="仙境之梦 DreamRO 首页"><span class="brand-wings">${wingMark}</span><span class="brand-wordmark"><b>DREAM<span>RO</span></b><small>仙 境 之 梦</small></span></a><div class="header-center"><i></i>A LITTLE WORLD. A GRAND ADVENTURE.<i></i></div><nav><button class="header-button music-toggle" data-action="music">${icon(this.preferences.music && this.audioReady ? 'sound' : 'mute', '', 17)}<span>${this.audioReady && this.preferences.music ? '音乐已开启' : '开启音乐'}</span></button><span class="nav-divider"></span><button class="header-button" data-action="help">${icon('book', '', 17)}<span>世界手札</span></button>${heroes.length ? `<button class="header-button continue-button" data-action="characters">继续旅途 ${icon('arrow', '', 16)}</button>` : ''}</nav></header>

      <section class="creation-intro"><div class="eyebrow"><span></span> A NEW CHAPTER AWAITS</div><h1>重逢这个世界，<br>遇见新的自己<span>。</span></h1><p>风还在吹，波利还在等你。<br>带上最初的勇气，我们再出发一次。</p></section>

      <section class="job-selector parchment-panel" aria-labelledby="job-selector-title"><div class="panel-corner top-left"></div><div class="panel-corner bottom-right"></div><div class="section-label"><span class="step-number">01</span><h2 id="job-selector-title">选择你的职业</h2><span class="tiny-star">✦</span></div><div class="job-tabs" role="tablist" aria-label="职业分类"><button type="button" data-action="base-jobs" role="tab" aria-selected="true" class="active">基础职业 <small>07</small></button><button type="button" data-action="advanced-jobs" role="tab" aria-selected="false">进阶职业 <small>13</small></button></div><div id="job-grid" class="job-grid" role="group" aria-label="选择职业"></div><div class="job-selector-foot">${icon('feather', '', 12)} 二十种命运，等你写下自己的那一种。</div></section>

      <section id="job-details" class="job-details" aria-live="polite"></section>

      <div class="hero-signature"><span class="signature-line"></span><span id="hero-display-name">尚未写下的名字</span><span class="signature-line"></span><small id="hero-job-label">SWORDSMAN · BASE Lv. 1</small></div>
      <section class="appearance-bar" aria-label="角色外观"><div class="appearance-label">${icon('person', '', 15)}<span>你的模样</span></div><div class="appearance-type"><button type="button" class="active" data-action="body-0" aria-label="少年体型" aria-pressed="true">少年</button><button type="button" data-action="body-1" aria-label="少女体型" aria-pressed="false">少女</button></div><i></i><div class="hair-colors" aria-label="发色">${HAIR_COLORS.map((color, i) => `<button type="button" data-action="hair-${i}" aria-label="${['栗棕', '浅金', '赤茶', '丁香', '银白', '蓝灰'][i]}发色" aria-pressed="${i === 0}" class="${i === 0 ? 'active' : ''}" style="--swatch:${color}"></button>`).join('')}</div><button class="hairstyle-button" data-action="hairstyle" aria-label="切换发型">${icon('rotate', '', 14)}<span id="hairstyle-label">短发</span></button></section>

      <form id="creation-form" class="creation-form"><div class="name-heading"><label for="hero-name"><span class="step-number">02</span>写下你的名字</label><span id="name-count">0 / 12</span></div><div class="creation-form-controls"><div class="name-input-wrap">${icon('feather', '', 18)}<input id="hero-name" name="heroName" type="text" maxlength="24" placeholder="你的名字，会被风记住" autocomplete="off" aria-describedby="name-error" value="${escapeHTML(this.characterName)}"/><button type="button" data-action="random-name" aria-label="随机取一个名字">${icon('dice', '', 18)}</button></div><button class="primary-button begin-button" type="submit"><span>启程，去冒险</span>${icon('arrow', '', 20)}</button></div><div class="name-feedback"><span id="name-error" role="alert"></span><span class="save-note">${icon('save', '', 11)} 冒险会保存在当前浏览器</span></div></form>

      <div class="preview-hint"><button data-action="rotate-left" aria-label="向左旋转角色">${icon('chevron', '', 15)}</button><span>拖动角色 · 换个角度看看</span><button data-action="rotate-right" aria-label="向右旋转角色">${icon('chevron', '', 15)}</button></div>
      <footer class="creation-footer"><span>献给那些一起打波利的日子。</span><div><i class="world-dot"></i> 米德加尔特 <span>·</span> 风和日丽</div><span>EST. IN OUR MEMORIES <i>✦</i> V 1.0</span></footer>
    `;
    this.renderJobs(); this.renderJobDetails(); this.syncAppearance();
    this.preview = new CharacterPreview(this.renderer, this.sceneElement, this.selectedJob, this.appearance);
    const form = this.interface.querySelector<HTMLFormElement>('#creation-form')!;
    form.addEventListener('submit', e => { e.preventDefault(); void this.beginAdventure(); });
    this.interface.querySelector<HTMLInputElement>('#hero-name')!.addEventListener('input', e => {
      this.characterName = (e.target as HTMLInputElement).value;
      this.interface.querySelector('#name-count')!.textContent = `${Array.from(this.characterName).length} / 12`;
      this.interface.querySelector('#hero-display-name')!.textContent = this.characterName.trim() || '尚未写下的名字'; this.interface.querySelector('#name-error')!.textContent = '';
    });
  }
  private renderJobs() {
    const jobs = JOBS.filter(j => j.advanced === this.advanced).sort((a, b) => a.id === 'novice' ? 1 : b.id === 'novice' ? -1 : 0);
    this.interface.querySelector('#job-grid')!.innerHTML = jobs.map(j => `<button type="button" class="job-card${j.id === this.selectedJob.id ? ' selected' : ''}${j.id === 'novice' ? ' novice-card' : ''}" data-action="job-${j.id}" data-job="${j.id}" aria-label="选择${j.name}" aria-pressed="${j.id === this.selectedJob.id}" style="--job-color:${j.color}"><span class="job-emblem">${icon(j.icon, '', 25)}</span><span class="job-card-label"><strong>${j.name}</strong><small>${j.en}</small></span><span class="job-check">${icon('check', '', 11)}</span>${j.id === 'novice' ? '<span class="novice-note">从最初的心意出发</span>' : ''}</button>`).join('');
    for (const [action, active] of [['base-jobs', !this.advanced], ['advanced-jobs', this.advanced]] as const) {
      const button = this.interface.querySelector<HTMLElement>(`[data-action="${action}"]`)!; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    }
  }
  private renderJobDetails() {
    const job = this.selectedJob;
    this.interface.querySelector('#job-details')!.innerHTML = `<div class="job-detail-crest" style="--job-color:${job.color}">${icon(job.icon, '', 34)}<span></span></div><div class="job-detail-index">${job.advanced ? 'ADVANCED' : job.id === 'novice' ? 'THE BEGINNING' : 'FIRST CLASS'}</div><h2>${job.name}</h2><div class="job-english">${job.en}</div><div class="job-role">${job.role}</div><div class="detail-divider">${ornament}</div><p>${job.description}</p><div class="job-ratings">${['攻击能力', '生存能力', '辅助能力'].map((label, i) => `<div><span>${label}</span><i>${Array.from({ length: 5 }, (_, k) => `<b class="${k < job.ratings[i] ? 'filled' : ''}"></b>`).join('')}</i></div>`).join('')}</div><div class="starting-skills"><span>你的初始技能</span><div>${job.skills.map(s => `<span class="mini-skill" style="--skill-color:${s.color}" tabindex="0" aria-label="${s.name}：${s.description}">${icon(s.icon, '', 22)}<span class="mini-skill-tooltip"><b>${s.name}</b>${s.description}</span></span>`).join('')}</div></div><p class="job-quote">${job.quote}</p>`;
    this.interface.querySelector('#hero-job-label')!.textContent = `${job.en.toUpperCase()} · BASE Lv. 1`;
  }
  private syncAppearance() {
    this.interface.querySelectorAll<HTMLElement>('[data-action^="hair-"]').forEach((b, i) => { const active = this.appearance.hair === HAIR_COLORS[i]; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    this.interface.querySelectorAll<HTMLElement>('[data-action^="body-"]').forEach((b, i) => { const active = Number(this.appearance.feminine) === i; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
    this.interface.querySelector('#hairstyle-label')!.textContent = ['短发', '侧分', '长发'][this.appearance.style];
  }
  private selectJob(id: string) {
    this.selectedJob = getJob(id); this.renderJobs(); this.renderJobDetails(); this.preview?.setCharacter(this.selectedJob, this.appearance);
    void this.unlockAudio(); this.audio.play('click');
  }
  private async unlockAudio() {
    await this.audio.unlock(); this.audioReady = true; this.updateMusicButton();
  }
  private updateMusicButton() {
    const button = this.interface.querySelector('.music-toggle');
    if (button) button.innerHTML = `${icon(this.preferences.music && this.audioReady ? 'sound' : 'mute', '', 17)}<span>${this.preferences.music && this.audioReady ? '音乐已开启' : '开启音乐'}</span>`;
  }
  private async beginAdventure() {
    if (this.beginning) return;
    const name = this.characterName.trim();
    if (!name || Array.from(name).length > 12 || !/^[\p{L}\p{N}_· \-]+$/u.test(name)) {
      this.interface.querySelector('#name-error')!.textContent = !name ? '先写下你的名字，让这个世界记住你。' : '请使用 1–12 个汉字、字母或数字，也可以加入空格、·、_、-。';
      this.interface.querySelector<HTMLInputElement>('#hero-name')!.focus(); return;
    }
    this.beginning = true;
    const button = this.interface.querySelector<HTMLButtonElement>('.begin-button')!; button.disabled = true; button.innerHTML = `<span>正在启程…</span>${icon('spark', '', 19)}`;
    await this.unlockAudio();
    const hero = createHero(name, this.selectedJob.id, this.appearance); persistHero(hero);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    this.launch(hero); this.beginning = false;
  }
  private launch(hero: HeroSave) {
    this.closeModal(true); this.preview?.dispose(); this.preview = undefined; this.game?.dispose(); this.hud?.dispose();
    this.app.className = 'playing'; this.renderer.setClearColor(MAPS[hero.mapId].sky, 1);
    this.hud = new HUD(this.interface, hero, getJob(hero.jobId));
    this.game = new Game(this.renderer, this.sceneElement, hero, this.audio, e => this.onGameEvent(e), this.preferences);
    this.hud.attach(this.game); this.game.start(); this.renderer.domElement.focus({ preventScroll: true });
  }
  private onGameEvent(event: GameEvent) {
    this.hud?.handle(event);
    if (event.type === 'toast') this.toast(event.title, event.detail, event.icon);
    if (event.type === 'panel') this.openPanel(event.panel);
    if (event.type === 'dialogue') this.openDialogue();
    if (event.type === 'death') this.openDeath();
    if (event.type === 'victory') this.openVictory();
    if (event.type === 'transition') { const veil = this.app.querySelector('#map-veil')!; veil.classList.toggle('active', event.active); if (event.name) veil.querySelector('span')!.textContent = event.name; }
  }
  private action(action: string, button?: HTMLElement) {
    if (action.startsWith('job-')) return this.selectJob(action.slice(4));
    if (action.startsWith('hair-')) { this.appearance.hair = HAIR_COLORS[Number(action.slice(5))]; this.syncAppearance(); this.preview?.setCharacter(this.selectedJob, this.appearance); return; }
    if (action.startsWith('body-')) { this.appearance.feminine = action.endsWith('1'); this.syncAppearance(); this.preview?.setCharacter(this.selectedJob, this.appearance); return; }
    if (action.startsWith('skill-')) { this.game?.cast(Number(action.slice(6))); this.renderer.domElement.focus({ preventScroll: true }); return; }
    if (action.startsWith('load-')) { const hero = loadHeroes().find(h => h.id === action.slice(5)); if (hero) { void this.unlockAudio(); this.launch(hero); } return; }
    switch (action) {
      case 'base-jobs': case 'advanced-jobs': {
        this.advanced = action === 'advanced-jobs';
        if (this.selectedJob.advanced !== this.advanced) this.selectedJob = JOBS.find(j => j.advanced === this.advanced && j.family === this.selectedJob.family) ?? JOBS.find(j => j.advanced === this.advanced)!;
        this.renderJobs(); this.renderJobDetails(); this.preview?.setCharacter(this.selectedJob, this.appearance); break;
      }
      case 'hairstyle': this.appearance.style = (this.appearance.style + 1) % 3; this.syncAppearance(); this.preview?.setCharacter(this.selectedJob, this.appearance); break;
      case 'random-name': {
        const names = ['风里的旅人', '晚风与星', '栗子不迷路', '月光邮差', '小小冒险家', '向阳而行', '山谷来信', '薄荷与风', '一颗软糖', '昨日晴空'];
        this.characterName = names[Math.floor(Math.random() * names.length)]; const input = this.interface.querySelector<HTMLInputElement>('#hero-name')!; input.value = this.characterName; input.dispatchEvent(new Event('input')); this.audio.play('click'); break;
      }
      case 'rotate-left': this.preview?.rotate(-Math.PI / 4); break;
      case 'rotate-right': this.preview?.rotate(Math.PI / 4); break;
      case 'music':
        if (!this.audioReady) this.preferences.music = true; else this.preferences.music = !this.preferences.music;
        this.applyPreferences(); void this.unlockAudio(); break;
      case 'help': case 'bag': case 'character': case 'journal': case 'map': case 'settings': this.openPanel(action); break;
      case 'characters': this.openCharacters(); break;
      case 'close-modal': this.closeModal(); break;
      case 'attack': this.game?.startAttack(); this.renderer.domElement.focus({ preventScroll: true }); break;
      case 'interact': this.game?.interact(); break;
      case 'potion-red': this.game?.usePotion('red'); if (this.panel === 'bag') this.renderBag(); else this.renderer.domElement.focus({ preventScroll: true }); break;
      case 'potion-blue': this.game?.usePotion('blue'); if (this.panel === 'bag') this.renderBag(); else this.renderer.domElement.focus({ preventScroll: true }); break;
      case 'claim-quest': if (this.game?.claimQuest() && this.panel !== 'victory') this.openDialogue(); break;
      case 'buy-red': this.game?.buy('red'); this.openDialogue(); break;
      case 'buy-blue': this.game?.buy('blue'); this.openDialogue(); break;
      case 'sell-jelly': this.game?.sellJelly(); this.openDialogue(); break;
      case 'upgrade': this.game?.upgradeWeapon(); if (this.panel === 'bag') this.renderBag(); else this.openPanel('character'); break;
      case 'respawn': this.closeModal(true); this.game?.respawn(); break;
      case 'keep-playing': this.closeModal(true); break;
      case 'return-creation': this.showCreation(); break;
      case 'save': { const success = this.game?.save(); this.toast(success ? '已记下这段冒险' : '暂时无法写入浏览器存档', success ? '下次回来，旅途会从这里继续。' : '当前冒险仍可继续，请检查浏览器存储。', 'save'); break; }
      case 'fullscreen': {
        const unavailable = () => this.toast('这个浏览器暂不支持全屏', '游戏仍然可以正常游玩。', 'expand');
        if (!document.documentElement.requestFullscreen) unavailable();
        else void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(unavailable);
        break;
      }
      case 'toggle-music': this.preferences.music = !this.preferences.music; this.applyPreferences(); void this.unlockAudio(); this.openPanel('settings'); break;
      case 'toggle-sound': this.preferences.sound = !this.preferences.sound; this.applyPreferences(); this.openPanel('settings'); break;
      case 'quality-high': case 'quality-balanced': this.preferences.quality = action === 'quality-high' ? 'high' : 'balanced'; this.applyPreferences(); this.openPanel('settings'); break;
      case 'log-all': this.hud?.filterLog(false); break;
      case 'log-combat': this.hud?.filterLog(true); break;
      case 'log-collapse': this.interface.querySelector('.chat-window')?.classList.toggle('collapsed'); break;
      case 'dismiss-tip': this.interface.querySelector('#first-tip')?.classList.add('dismissed'); this.renderer.domElement.focus({ preventScroll: true }); break;
      case 'new-character': this.closeModal(); this.interface.querySelector<HTMLInputElement>('#hero-name')?.focus(); break;
      default: if (button) this.audio.play('click');
    }
  }
  private applyPreferences() {
    persistPreferences(this.preferences); this.audio.setPreferences(this.preferences); this.updateMusicButton();
    if (this.game) this.game.applyQuality(this.preferences.quality);
    else { this.renderer.shadowMap.enabled = this.preferences.quality === 'high'; this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.preferences.quality === 'high' ? 2 : 1)); }
  }
  private showModal(panel: typeof this.panel, title: string, eyebrow: string, content: string, className = '') {
    if (!this.modal.open) this.lastFocused = document.activeElement as HTMLElement;
    this.panel = panel; this.game?.setPaused(true);
    this.modal.className = `fantasy-modal ${className}`;
    this.modal.innerHTML = `<div class="modal-corner corner-a"></div><div class="modal-corner corner-b"></div><header class="modal-header"><div><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2></div>${panel !== 'death' && panel !== 'victory' ? `<button class="modal-close" data-action="close-modal" aria-label="关闭窗口">${icon('close', '', 21)}</button>` : ''}</header>${content}`;
    if (!this.modal.open) this.modal.showModal();
  }
  private closeModal(force = false) {
    if (!force && (this.panel === 'death' || this.panel === 'victory')) return;
    if (this.modal.open) this.modal.close(); this.panel = null; this.game?.setPaused(false);
    if (this.lastFocused?.isConnected) this.lastFocused.focus({ preventScroll: true }); else this.renderer.domElement.focus({ preventScroll: true });
  }
  private openPanel(panel: Panel) {
    if (panel === 'help') return this.openHelp();
    if (panel === 'settings') return this.openSettings();
    if (!this.game) return;
    if (panel === 'bag') return this.renderBag();
    if (panel === 'character') return this.openCharacter();
    if (panel === 'journal') return this.openJournal();
    if (panel === 'map') return this.openMap();
  }
  private renderBag() {
    const h = this.game!.hero;
    const items = [
      ['potion', 'red', '红色药水', '恢复 50% 最大生命', h.redPotions, 'potion-red', '使用'],
      ['potion', 'blue', '蓝色药水', '恢复 60% 最大 SP', h.bluePotions, 'potion-blue', '使用'],
      ['drop', 'pink', '波利凝胶', '强化武器的材料，也能卖给旅人', h.jelly, '', ''],
      ['diamond', 'purple', '星之碎片', '从波利与宝箱里收集的纪念品', h.crystals, '', ''],
      ['leaf', 'green', '草木之心卡片', `已装备 · 最大生命 +${h.cards * 12}`, h.cards, '', ''],
    ];
    this.showModal('bag', '旅人的背包', 'LITTLE THINGS, GREAT MEMORIES', `<div class="bag-balance">${icon('coin', '', 20)}<strong>${h.zeny.toLocaleString()}</strong><span>Zeny</span><small>拾起的每一点，都算数。</small></div><div class="inventory-list">${items.map(([symbol, color, name, description, count, action, label]) => `<div class="inventory-row"><span class="item-emblem ${color}">${icon(String(symbol), '', 28)}</span><div><strong>${name}</strong><small>${description}</small></div><b>× ${count}</b>${action ? `<button class="small-button" data-action="${action}" ${Number(count) === 0 ? 'disabled' : ''}>${label}</button>` : '<span class="item-passive">随身</span>'}</div>`).join('')}</div><div class="upgrade-block"><span class="item-emblem gold">${icon('sword', '', 30)}</span><div><strong>旅人的武器 <em>+${h.upgrade}</em></strong><small>3 份凝胶 + ${50 + h.upgrade * 25} Z · 攻击力 +4</small></div><button class="small-button" data-action="upgrade" ${h.upgrade >= 10 ? 'disabled' : ''}>${h.upgrade >= 10 ? '已满级' : '强化'}</button></div><p class="modal-note">${icon('leaf', '', 13)} 生命卡片拾取后自动装备，所有掉落都会自动放进背包。</p>`, 'inventory-modal');
  }
  private openCharacter() {
    const game = this.game!, h = game.hero, job = game.job, stats = game.stats;
    this.showModal('character', escapeHTML(h.name), `${job.en.toUpperCase()} · BASE LEVEL ${h.level}`, `<div class="character-summary"><div class="large-class-emblem" style="--job-color:${job.color}">${icon(job.icon, '', 51)}</div><div><h3>${job.name}</h3><p>${job.role}</p><span>${h.claimed[2] ? '✦ 山谷的守望者' : '一位正在书写故事的旅人'}</span></div></div><div class="stat-grid">${[['heart', '最大生命', stats.hp], ['drop', '最大 SP', stats.sp], ['sword', '攻击力', stats.attack], ['shield', '防御力', Math.round(stats.defense)], ['wind', '移动速度', stats.speed.toFixed(1)], ['target', '攻击距离', stats.range.toFixed(1)]].map(([symbol, label, value]) => `<div>${icon(String(symbol), '', 20)}<span>${label}</span><b>${value}</b></div>`).join('')}</div><h3 class="modal-subheading">你的战斗方式</h3><div class="skill-list">${job.skills.map((s, i) => `<div><span class="item-emblem" style="--item-color:${s.color}">${icon(s.icon, '', 25)}</span><div><strong><kbd>${i + 1}</kbd>${s.name}<small>${s.cost} SP · ${s.cooldown}s</small></strong><p>${s.description}</p></div></div>`).join('')}</div><p class="modal-note">${icon('spark', '', 13)} 每次升级都会提高属性，并恢复全部生命与 SP。</p>`);
  }
  private openJournal() {
    const h = this.game!.hero;
    this.showModal('journal', '风与星的手札', 'EVERY LITTLE ADVENTURE MATTERS', `<p class="journal-intro">有些路，走着走着，就成了记忆里的故乡。</p><div class="journal-chapters">${QUESTS.map((q, i) => {
      const locked = i > 0 && !h.claimed[i - 1]; const done = h.claimed[i]; const ready = questReady(h, i);
      return `<article class="journal-chapter ${done ? 'completed' : locked ? 'locked' : 'current'}"><div class="chapter-marker">${done ? icon('check', '', 18) : `0${i + 1}`}</div><div><span>${q.subtitle}<b>${done ? '已完成' : ready ? '可领取谢礼' : locked ? '等待开启' : '进行中'}</b></span><h3>${q.name}</h3><p>${q.description}</p><div class="chapter-objective">${icon(done ? 'check' : 'target', '', 14)}${q.objective}<strong>${questProgress(h, i)} / ${q.need}</strong></div><small>${q.reward} Z · ${q.xp} EXP · 补给药水${i === 2 ? ' · 限定称号与波利伙伴' : ''}</small></div></article>`;
    }).join('')}</div><div class="journal-bottom">${ornament}<span>已游历 ${h.visited.length} / 3 张地图 · 相处了 ${this.playtime(h.playtime)}</span></div>`, 'journal-modal');
  }
  private openMap() {
    const game = this.game!;
    this.showModal('map', game.world.map.name, game.world.map.en.toUpperCase(), `<div class="world-route">${MAPS.map((m, i) => `<div class="${i === game.hero.mapId ? 'here' : game.hero.visited.includes(m.id) ? 'visited' : ''}"><span>${icon(i === 0 ? 'sun' : i === 1 ? 'leaf' : 'star', '', 18)}</span><strong>${m.name}</strong><small>${m.level}</small></div>${i < 2 ? '<i>·····</i>' : ''}`).join('')}</div><div class="large-map-wrap"><canvas id="large-map" width="740" height="640" aria-label="当前地图，点击位置即可开始寻路"></canvas><b>N</b><span>点击地图，沿小路前往标记位置</span></div><div class="map-legend"><span><i class="legend-you"></i>你的位置</span><span><i class="legend-monster"></i>魔物</span><span><i class="legend-npc"></i>旅人</span><span><i class="legend-portal"></i>传送门</span></div>`, 'map-modal');
    const canvas = this.modal.querySelector<HTMLCanvasElement>('#large-map')!; drawMinimap(canvas, game, true);
    canvas.addEventListener('click', e => { const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width * 70 - 35; const z = (e.clientY - rect.top) / rect.height * 70 - 35; this.closeModal(); game.moveTo(x, z); });
  }
  private openDialogue() {
    const game = this.game!, h = game.hero, map = game.world.map, index = h.mapId;
    const ready = questReady(h, index); const done = h.claimed[index]; const locked = index > 0 && !h.claimed[index - 1];
    const greetings = [
      done ? '小路又安静下来了，谢谢你。北面的光门后是萤语森林，我的朋友菲恩一直在等一封信。你愿意替我去看看吗？' : ready ? '原来是你！山谷的小波利安静了许多，真是帮了大忙。收下这些补给吧，去看一看更远的世界。' : '欢迎回来，旅人。你听，风里的声音和从前一样。最近软糖波利占满了小路，帮我驱散五只，好吗？准备好了再出发，我会在这里等你。',
      done ? '谢谢你把莉露的心意带来。森林北边的遗迹最近有些不安宁，波利女王似乎被旧日的星光惊扰了。请小心脚下的魔法光圈。' : ready ? '森林终于能安心睡一会儿了。你做得很好。这封信和这些补给，都是送给勇敢的旅人的。' : '萤火会照亮愿意倾听的人。露珠波利最近有些顽皮，帮我安抚五只吧。沿着小路走，你不会迷路。',
      done ? '你看，星光又回到了它原来的位置。那个跟着你的小家伙，好像很喜欢你。接下来，愿你一直保有出发时的那颗心。' : ready ? '星光已经平静。原来最古老的魔法，是有人愿意勇敢又温柔地伸出手。这份星光，和这个新朋友，都属于你。' : '波利女王守着这片遗迹太久了，连自己也忘了最初的约定。请帮她找回安宁。她施法时，记得离开地上的光圈。',
    ];
    this.showModal('dialogue', map.npcName, index === 0 ? 'YOUR FIRST FRIEND IN THE VALLEY' : index === 1 ? 'A LETTER FROM THE WOODS' : 'THE KEEPER OF OLD STARLIGHT', `<div class="dialogue-portrait" style="--job-color:${getJob(map.npcJob).color}">${icon(index === 0 ? 'flower' : index === 1 ? 'feather' : 'star', '', 42)}<span>${index === 0 ? '山谷向导' : index === 1 ? '林间信使' : '遗迹守望者'}</span></div><p class="dialogue-speech">“${greetings[index]}”</p>${locked ? '<div class="dialogue-quest muted">上一章的约定还没有完成。别忘了回去看看等着你的朋友。</div>' : !done ? `<div class="dialogue-quest">${icon('scroll', '', 20)}<div><strong>${QUESTS[index].name}</strong><span>${QUESTS[index].objective} ${questProgress(h, index)} / ${QUESTS[index].need}</span></div>${ready ? '<button class="small-button" data-action="claim-quest">领取谢礼</button>' : '<span class="quest-pending">进行中</span>'}</div>` : '<div class="dialogue-quest completed">✦ 这一页的约定，已经好好完成。</div>'}<div class="shop-header"><h3>给旅途添一点补给</h3><span>${icon('coin', '', 13)} ${h.zeny} Z</span></div><div class="shop-items"><button data-action="buy-red"><span class="item-emblem red">${icon('potion', '', 25)}</span><strong>红色药水<small>已有 ${h.redPotions} 瓶</small></strong><b>20 Z ${icon('plus', '', 13)}</b></button><button data-action="buy-blue"><span class="item-emblem blue">${icon('potion', '', 25)}</span><strong>蓝色药水<small>已有 ${h.bluePotions} 瓶</small></strong><b>25 Z ${icon('plus', '', 13)}</b></button></div><div class="dialogue-bottom"><button class="text-button" data-action="sell-jelly" ${h.jelly === 0 ? 'disabled' : ''}>出售凝胶 ×${h.jelly} <span>+${h.jelly * 8} Z</span></button><button class="primary-button" data-action="close-modal">${done ? '我们还会再见' : '我准备好了'} ${icon('arrow', '', 16)}</button></div>`, 'dialogue-modal');
  }
  private openSettings() {
    const p = this.preferences;
    this.showModal('settings', '让旅途刚刚好', 'A MOMENT OF PEACE', `<div class="settings-list"><div><span>${icon('music', '', 21)}<strong>山谷的旋律<small>原创竖琴与轻柔的和弦</small></strong></span><button class="toggle ${p.music ? 'on' : ''}" role="switch" aria-checked="${p.music}" data-action="toggle-music" aria-label="背景音乐"><i></i></button></div><div><span>${icon('sound', '', 21)}<strong>冒险的声音<small>技能、波利和每一次拾取</small></strong></span><button class="toggle ${p.sound ? 'on' : ''}" role="switch" aria-checked="${p.sound}" data-action="toggle-sound" aria-label="游戏音效"><i></i></button></div><div><span>${icon('sun', '', 21)}<strong>画面细节<small>精致光影，或更轻快的冒险</small></strong></span><div class="segmented"><button data-action="quality-high" class="${p.quality === 'high' ? 'active' : ''}">精致</button><button data-action="quality-balanced" class="${p.quality === 'balanced' ? 'active' : ''}">流畅</button></div></div><div class="volume-row"><label for="volume-slider">音量</label><input id="volume-slider" type="range" min="0" max="100" value="${p.volume * 100}"/><output id="volume-value">${Math.round(p.volume * 100)}%</output></div></div><div class="settings-actions"><button class="secondary-button" data-action="fullscreen">${icon('expand', '', 17)}全屏漫游</button><button class="secondary-button" data-action="help">${icon('book', '', 17)}操作手札</button>${this.game ? '<button class="secondary-button" data-action="save">' + icon('save', '', 17) + '保存进度</button>' : ''}</div>${this.game ? '<div class="settings-return"><p>稍作休息也很好。你的冒险会自动保存。</p><button class="text-button" data-action="return-creation">' + icon('leave', '', 17) + '返回角色界面</button></div>' : ''}<p class="modal-note centered">DreamRO · 仙境之梦 <span>✦</span> 献给那些一起打波利的日子</p>`, 'settings-modal');
    this.modal.querySelector<HTMLInputElement>('#volume-slider')!.addEventListener('input', e => { this.preferences.volume = Number((e.target as HTMLInputElement).value) / 100; this.modal.querySelector('#volume-value')!.textContent = `${Math.round(this.preferences.volume * 100)}%`; this.applyPreferences(); });
  }
  private openHelp() {
    this.showModal('help', '出发前的小小手札', 'WELCOME BACK, ADVENTURER', `<p class="help-intro">一个献给经典 RO 与青春记忆的原创小世界。<br>选一份职业，取一个名字，跟着风去冒险。</p><div class="controls-grid">${[['W A S D / 方向键', '自由行走'], ['点击地面', '自动寻路'], ['点击魔物 / 空格', '普通攻击'], ['1 — 4', '施放职业技能'], ['Q / E', '红药水 / 蓝药水'], ['F', '交谈、打开宝箱'], ['Tab', '切换附近目标'], ['鼠标右键拖动', '旋转镜头'], ['滚轮 / R', '缩放 / 重置镜头'], ['I / C / J / M', '背包 / 角色 / 手札 / 地图']].map(([key, label]) => `<div><kbd>${key}</kbd><span>${label}</span></div>`).join('')}</div><div class="help-story"><span>${icon('compass', '', 28)}</span><p><strong>跟着小路，往北走。</strong>发光的石门会带你去下一张地图。三位旅人、三章约定，以及一位守着星光的波利女王，都在等你。</p></div><p class="modal-note">触屏可使用左下角摇杆与底部技能按钮。打开窗口时，战斗会暂停。</p><p class="modal-note">这是单人冒险。进度保存在当前浏览器，可在角色界面继续旅途。</p><button class="primary-button modal-wide-button" data-action="close-modal">记住了，出发吧 ${icon('arrow', '', 17)}</button>`, 'help-modal');
  }
  private openCharacters() {
    const heroes = loadHeroes();
    this.showModal('characters', '他们一直在等你', 'YOUR ADVENTURE CONTINUES', `<div class="saved-characters">${heroes.map(h => { const job = getJob(h.jobId); return `<button class="saved-character" data-action="load-${escapeHTML(h.id)}"><span class="saved-avatar" style="--job-color:${job.color}">${icon(job.icon, '', 29)}</span><span><strong>${escapeHTML(h.name)}<small>Lv. ${h.level}</small></strong><span>${job.name} · ${MAPS[h.mapId].name}</span><small>${this.playtime(h.playtime)}的冒险</small></span>${icon('arrow', '', 20)}</button>`; }).join('')}</div><button class="secondary-button modal-wide-button" data-action="new-character">${icon('plus', '', 17)}写下新的故事</button>`, 'characters-modal');
  }
  private openDeath() {
    this.showModal('death', '歇一会儿，再出发', 'THE WIND WILL BRING YOU HOME', `<div class="ending-symbol">${icon('leaf', '', 64)}</div><p class="ending-message">勇敢的旅人也需要休息。<br>向导已经替你准备好了新的补给。<br>背包、等级和完成的约定都会保留。</p><button class="primary-button modal-wide-button" data-action="respawn">回到路口，重新出发 ${icon('arrow', '', 18)}</button>`, 'ending-modal');
  }
  private openVictory() {
    const h = this.game!.hero;
    this.showModal('victory', '有些冒险，会陪我们很久', 'THE END OF A CHAPTER. THE START OF A MEMORY.', `<div class="ending-symbol victory-symbol">${wingMark}</div><p class="ending-message">${escapeHTML(h.name)}，谢谢你带回山谷的星光。<br>你成为了「山谷的守望者」，<br>一只小小的波利，也决定陪你继续走下去。</p><div class="ending-stats"><div><b>${h.level}</b><span>冒险等级</span></div><div><b>${h.kills.reduce((a, b) => a + b, 0)}</b><span>击败魔物</span></div><div><b>3</b><span>完成的约定</span></div></div><div class="ending-quote">${ornament}<p>风还在吹。我们还会再见。</p></div><button class="primary-button modal-wide-button" data-action="keep-playing">带上新朋友，继续漫游 ${icon('arrow', '', 17)}</button>`, 'ending-modal victory-modal');
  }
  private playtime(seconds: number) { return seconds < 60 ? '不到一分钟' : seconds < 3600 ? `${Math.floor(seconds / 60)} 分钟` : `${Math.floor(seconds / 3600)} 小时 ${Math.floor(seconds % 3600 / 60)} 分钟`; }
  private toast(title: string, detail?: string, symbol = 'spark') {
    const now = performance.now(); if (now - (this.toastHistory.get(title) ?? -10000) < 1800) return; this.toastHistory.set(title, now);
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<span class="toast-icon">${icon(symbol, '', 23)}</span><div><strong>${escapeHTML(title)}</strong>${detail ? `<p>${escapeHTML(detail)}</p>` : ''}</div>`; this.toasts.append(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => { el.classList.add('leaving'); window.setTimeout(() => el.remove(), 400); }, 4100);
    if (typeof this.toasts.showPopover === 'function') {
      if (this.toasts.matches(':popover-open')) this.toasts.hidePopover();
      this.toasts.showPopover();
    }
  }
}

try { new DreamRO(); }
catch (error) {
  console.error('DreamRO could not start', error);
  const root = document.querySelector('#app')!;
  root.innerHTML = `<main class="startup-error">${wingMark}<h1>山谷还没能亮起来</h1><p>请使用支持 WebGL 2 的现代浏览器，并开启硬件加速。<br>准备好后，刷新页面再来见一见这个世界。</p><button onclick="location.reload()">再试一次</button></main>`;
}
