import { getJob, JOB_BY_ID, type Job } from '../data/jobs';
import type { Appearance } from './Character';
import type { MapId } from './World';

export const SAVE_KEY = 'dreamro.adventurers.v1';
export interface HeroSave {
  version: 1; id: string; name: string; jobId: string; appearance: Appearance;
  level: number; xp: number; hp: number; sp: number; zeny: number;
  redPotions: number; bluePotions: number; jelly: number; crystals: number; upgrade: number; cards: number;
  mapId: MapId; x: number; z: number; kills: [number, number, number];
  claimed: [boolean, boolean, boolean]; bossDefeated: boolean; openedChests: string[]; visited: MapId[];
  playtime: number; createdAt: number; updatedAt: number;
}
export interface Stats { hp: number; sp: number; attack: number; defense: number; speed: number; range: number }
export interface Preferences { music: boolean; sound: boolean; quality: 'high' | 'balanced'; volume: number }
export const DEFAULT_PREFERENCES: Preferences = { music: true, sound: true, quality: 'high', volume: .55 };

export function statsFor(hero: HeroSave, job: Job = getJob(hero.jobId)): Stats {
  return { hp: job.hp + (hero.level - 1) * 25 + hero.cards * 12, sp: job.sp + (hero.level - 1) * 8,
    attack: job.attack + (hero.level - 1) * 3 + hero.upgrade * 4,
    defense: job.defense + (hero.level - 1) * 1.1, speed: job.speed, range: job.range };
}
export function xpForLevel(level: number) { return 40 + (level - 1) * 24; }
export function createHero(name: string, jobId: string, appearance: Appearance): HeroSave {
  const job = getJob(jobId);
  return { version: 1, id: crypto.randomUUID(), name: name.trim(), jobId: job.id, appearance: { ...appearance },
    level: 1, xp: 0, hp: job.hp, sp: job.sp, zeny: 80, redPotions: 8, bluePotions: 5, jelly: 0, crystals: 0, upgrade: 0, cards: 0,
    mapId: 0, x: .75, z: 22, kills: [0, 0, 0], claimed: [false, false, false], bossDefeated: false,
    openedChests: [], visited: [0], playtime: 0, createdAt: Date.now(), updatedAt: Date.now() };
}

const finite = (v: unknown, fallback: number, min = 0, max = 1e8) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
export function validateSave(raw: unknown): HeroSave | null {
  if (!raw || typeof raw !== 'object') return null;
  const h = raw as Record<string, unknown>;
  if (h.version !== 1 || typeof h.id !== 'string' || typeof h.name !== 'string' || typeof h.jobId !== 'string' || !JOB_BY_ID.has(h.jobId)) return null;
  const a = (h.appearance && typeof h.appearance === 'object' ? h.appearance : {}) as Record<string, unknown>;
  const appearance: Appearance = { hair: typeof a.hair === 'string' && /^#[0-9a-f]{6}$/i.test(a.hair) ? a.hair : '#805339', style: Math.floor(finite(a.style, 0, 0, 2)), feminine: a.feminine === true };
  const mapId = Math.floor(finite(h.mapId, 0, 0, 2)) as MapId;
  const array = (key: string) => Array.isArray(h[key]) ? h[key] as unknown[] : [];
  const hero: HeroSave = {
    version: 1, id: h.id.slice(0, 100), name: Array.from(h.name).slice(0, 12).join('') || '旅人', jobId: h.jobId, appearance,
    level: Math.floor(finite(h.level, 1, 1, 99)), xp: Math.floor(finite(h.xp, 0)), hp: finite(h.hp, 1), sp: finite(h.sp, 1),
    zeny: Math.floor(finite(h.zeny, 80)), redPotions: Math.floor(finite(h.redPotions, 8)), bluePotions: Math.floor(finite(h.bluePotions, 5)),
    jelly: Math.floor(finite(h.jelly, 0)), crystals: Math.floor(finite(h.crystals, 0)), upgrade: Math.floor(finite(h.upgrade, 0, 0, 10)), cards: Math.floor(finite(h.cards, 0, 0, 20)),
    mapId, x: finite(h.x, .75, -31, 31), z: finite(h.z, 22, -31, 31),
    kills: [0, 1, 2].map(i => Math.floor(finite(array('kills')[i], 0))) as HeroSave['kills'],
    claimed: [0, 1, 2].map(i => array('claimed')[i] === true) as HeroSave['claimed'], bossDefeated: h.bossDefeated === true,
    openedChests: array('openedChests').filter((v): v is string => typeof v === 'string' && /^[0-2]-[01]$/.test(v)),
    visited: [...new Set([0, mapId, ...array('visited').filter((v): v is MapId => v === 0 || v === 1 || v === 2)])] as MapId[],
    playtime: finite(h.playtime, 0), createdAt: finite(h.createdAt, Date.now()), updatedAt: finite(h.updatedAt, Date.now()),
  };
  const stats = statsFor(hero); hero.hp = Math.min(stats.hp, hero.hp); hero.sp = Math.min(stats.sp, hero.sp);
  hero.xp = Math.min(hero.xp, xpForLevel(hero.level) - 1);
  return hero;
}
export function loadHeroes(): HeroSave[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    return data.map(validateSave).filter((s): s is HeroSave => s !== null).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return []; }
}
export function persistHero(hero: HeroSave): boolean {
  try {
    hero.updatedAt = Date.now();
    const heroes = loadHeroes().filter(h => h.id !== hero.id);
    localStorage.setItem(SAVE_KEY, JSON.stringify([hero, ...heroes])); return true;
  } catch { return false; }
}
export function loadPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem('dreamro.preferences.v1') || '{}');
    return { music: p.music !== false, sound: p.sound !== false, quality: p.quality === 'balanced' ? 'balanced' : 'high', volume: finite(p.volume, .55, 0, 1) };
  } catch { return { ...DEFAULT_PREFERENCES }; }
}
export function persistPreferences(preferences: Preferences) {
  try { localStorage.setItem('dreamro.preferences.v1', JSON.stringify(preferences)); } catch { /* Settings remain available for this visit. */ }
}

export const QUESTS = [
  { name: '山谷里的初次问候', subtitle: '冒险手札 · 第一章', description: '帮莉露驱散 5 只软糖波利，让山谷的小路重新热闹起来。', objective: '击败软糖波利', need: 5, reward: 100, xp: 75 },
  { name: '一封来自森林的信', subtitle: '冒险手札 · 第二章', description: '穿过北面的光门，在萤语森林击败 5 只露珠波利，然后拜访信使菲恩。', objective: '击败露珠波利', need: 5, reward: 180, xp: 140 },
  { name: '星光从未远去', subtitle: '冒险手札 · 最终章', description: '前往星落遗迹，击败波利女王。星语者会为你讲述最后一段故事。', objective: '击败波利女王', need: 1, reward: 350, xp: 240 },
];
export function activeQuest(hero: HeroSave): number { return hero.claimed.findIndex(c => !c); }
export function questProgress(hero: HeroSave, index: number) { return index === 2 ? Number(hero.bossDefeated) : Math.min(hero.kills[index], 5); }
export function questReady(hero: HeroSave, index: number) { return !hero.claimed[index] && questProgress(hero, index) >= QUESTS[index].need && (index === 0 || hero.claimed[index - 1]); }
