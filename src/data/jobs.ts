export type Family = 'novice' | 'swordsman' | 'mage' | 'archer' | 'acolyte' | 'merchant' | 'thief';
export type Weapon = 'sword' | 'staff' | 'bow' | 'mace' | 'axe' | 'dagger' | 'spear' | 'book' | 'lute' | 'fan' | 'fist' | 'hammer' | 'flask';
export type SkillKind = 'strike' | 'burst' | 'heal' | 'guard' | 'dash' | 'poison' | 'storm' | 'song' | 'trap' | 'summon' | 'drain';
export interface Skill {
  name: string; icon: string; description: string; kind: SkillKind;
  color: string; cost: number; cooldown: number; power: number; radius: number; range: number;
}
export interface Job {
  id: string; name: string; en: string; family: Family; advanced: boolean;
  role: string; description: string; quote: string; icon: string;
  color: string; cloth: string; trim: string; hair: string; weapon: Weapon;
  hp: number; sp: number; attack: number; defense: number; speed: number; range: number;
  ratings: [number, number, number]; skills: [Skill, Skill, Skill, Skill];
}

const skill = (name: string, icon: string, kind: SkillKind, color: string, description: string,
  cost = 8, cooldown = 4, power = 1.7, radius = 0, range = 7): Skill =>
  ({ name, icon, kind, color, description, cost, cooldown, power, radius, range });

const physical = '#daa954';
const holy = '#efd18a';
const arcane = '#9f98ee';
const green = '#80bd96';
const red = '#e8959a';
const blue = '#83c5e4';

const guard = (name = '坚守', color = physical) => skill(name, 'shield', 'guard', color, '8 秒内受到的伤害降低 55%，攻击提高 25%。', 12, 14, 0);
const heal = (name = '治愈术', power = 3) => skill(name, 'cross', 'heal', holy, '以温暖的圣光恢复生命。', 16, 8, power);
const burst = (name: string, color = physical, icon = 'spark', power = 2.2) => skill(name, icon, 'burst', color, '释放范围冲击，伤害目标周围的魔物。', 18, 7, power, 4);
const strike = (name: string, icon = 'sword', color = physical, power = 1.7) => skill(name, icon, 'strike', color, '向选中的魔物施展一次强力攻击。', 6, 2.5, power);
const storm = (name: string, color = arcane, icon = 'star') => skill(name, icon, 'storm', color, '在目标周围召唤持续 4 秒的魔法领域。', 28, 13, 1.1, 5);
const dash = (name: string, color = red) => skill(name, 'wind', 'dash', color, '迅速接近目标，造成伤害并短暂免伤。', 10, 6, 2.1, 0, 10);
const poison = (name: string, color = green) => skill(name, 'drop', 'poison', color, '使目标中毒，持续 6 秒受到额外伤害。', 12, 6, 1.2);
const song = (name: string, color = holy) => skill(name, 'music', 'song', color, '音符环绕自身，持续治疗并伤害附近的魔物。', 24, 14, .9, 5);
const trap = (name: string, color = blue) => skill(name, 'target', 'trap', color, '束缚目标附近的魔物 4 秒，并造成范围伤害。', 15, 9, 1.9, 3.5);
const summon = (name: string, color = green) => skill(name, 'feather', 'summon', color, '召唤一位精灵伙伴，自动攻击附近魔物 12 秒。', 26, 18, .8, 0, 10);
const drain = (name: string, color = red) => skill(name, 'moon', 'drain', color, '吸取目标生命，同时恢复自身生命。', 14, 6, 2);

const make = (id: string, name: string, en: string, family: Family, advanced: boolean,
  role: string, description: string, quote: string, icon: string, color: string, cloth: string,
  weapon: Weapon, stats: [number, number, number, number, number, number], ratings: [number, number, number],
  skills: Job['skills'], trim = '#e5c57d', hair = '#9b6845'): Job => ({
    id, name, en, family, advanced, role, description, quote, icon, color, cloth, weapon,
    hp: stats[0], sp: stats[1], attack: stats[2], defense: stats[3], speed: stats[4], range: stats[5],
    ratings, skills, trim, hair,
  });

export const JOBS: Job[] = [
  make('novice', '初心者', 'Novice', 'novice', false, '自由成长 · 轻装冒险',
    '带上一点勇气，和对世界的好奇。所有伟大的传说，都曾从这小小的一步开始。',
    '「世界很大，慢慢长大。」', 'star', '#af9463', '#dac9a1', 'sword', [160, 100, 16, 4, 5, 2], [3, 3, 3],
    [strike('奋力一击'), heal('紧急治疗', 2.6), guard('勇气之心'), burst('幸运星光', holy, 'star')]),
  make('swordsman', '剑士', 'Swordsman', 'swordsman', false, '近战物理 · 坚韧守护',
    '以长剑开辟前路，以盾牌守护同伴。坚定而纯粹的力量，是每一段冒险中最安心的依靠。',
    '「剑之所向，便是心之所往。」', 'sword', '#ae8153', '#799aab', 'sword', [220, 80, 21, 8, 4.7, 2.2], [4, 5, 2],
    [strike('狂击'), burst('怒爆', red, 'flame'), guard('霸体'), dash('冲锋斩', physical)]),
  make('mage', '魔法师', 'Mage', 'mage', false, '远程魔法 · 元素掌控',
    '聆听风与火的低语，将星辰的秘密写成咒文。小小的法杖，也能唤醒整个天空。',
    '「每一束星光，都是未读的咒语。」', 'flame', '#9983b4', '#8f78b0', 'staff', [140, 150, 24, 3, 4.8, 8], [5, 2, 4],
    [strike('火箭术', 'flame', red), trap('冰冻术'), burst('雷击术', arcane, 'bolt'), storm('火焰之壁', red, 'flame')]),
  make('archer', '弓箭手', 'Archer', 'archer', false, '远程物理 · 灵巧追猎',
    '从树梢上的微风中辨认方向。在弓弦轻响的一瞬，把心意交给远方。',
    '「风会告诉我，下一站在哪里。」', 'bow', '#739578', '#79936c', 'bow', [165, 100, 21, 4, 5.6, 9], [5, 3, 2],
    [strike('二连矢', 'bow', green, 2), burst('箭雨', green, 'bow'), trap('定位陷阱', green), guard('风之步', green)]),
  make('acolyte', '服事', 'Acolyte', 'acolyte', false, '神圣辅助 · 治疗祝福',
    '温柔也是一种力量。在冒险者疲惫的时候，点亮一盏永不熄灭的灯。',
    '「愿每个远行的人，都平安归来。」', 'cross', '#bd9b59', '#e9dfc3', 'mace', [175, 140, 18, 6, 4.8, 6], [3, 4, 5],
    [strike('神圣之光', 'cross', holy), heal(), guard('天使之护', holy), burst('神圣新星', holy, 'sun')]),
  make('merchant', '商人', 'Merchant', 'merchant', false, '近战物理 · 旅途补给',
    '背包里装着补给，也装着关于远方的故事。一枚小小的金币，能串起整个世界的相遇。',
    '「最珍贵的宝物，往往不在价目表里。」', 'bag', '#b18862', '#b68466', 'axe', [200, 90, 20, 7, 4.6, 2.2], [4, 4, 3],
    [strike('金钱攻击', 'coin'), burst('手推车撞击', physical, 'bag'), heal('特制补给', 3), guard('购物车掩护')]),
  make('thief', '盗贼', 'Thief', 'thief', false, '近战物理 · 迅捷突袭',
    '穿过树影与人群，收集无人发现的秘密。脚步要轻，胆子要大，笑容也要藏好。',
    '「嘘，宝藏正在等着我们。」', 'dagger', '#ae7c83', '#856b89', 'dagger', [170, 100, 22, 4, 6, 2], [5, 3, 2],
    [strike('二刀连击', 'dagger', red, 2), poison('施毒'), dash('隐匿突袭'), drain('掠夺之刃')]),

  make('knight', '骑士', 'Knight', 'swordsman', true, '重装近战 · 无畏冲锋',
    '披上风尘与荣光，向遥远的地平线前进。骑士的誓言，永远比盔甲更坚固。',
    '「为了那些值得守护的名字。」', 'shield', '#839cbb', '#6989a8', 'spear', [260, 90, 24, 10, 4.7, 3], [5, 5, 2],
    [strike('连刺攻击', 'spear', physical, 2.2), burst('怪物互击', physical, 'sword'), guard('钢铁意志'), dash('骑士冲锋', blue)]),
  make('crusader', '十字军', 'Crusader', 'swordsman', true, '神圣近战 · 圣盾守护',
    '晨光镀亮盾牌，也照见前方的阴影。以信念为刃，为旅人留下一条平安的路。',
    '「我的盾，会接住每一次风雨。」', 'crossShield', '#b69b66', '#f0e3c2', 'sword', [275, 120, 21, 12, 4.5, 2.5], [4, 5, 4],
    [strike('圣十字攻击', 'cross', holy), burst('圣十字审判', holy, 'sun'), guard('自动防御', holy), heal('圣光祈愿', 4)]),
  make('wizard', '巫师', 'Wizard', 'mage', true, '范围魔法 · 天象支配',
    '让霜雪与陨星应召而来。世界的秘密，在你翻开魔导书时又多揭开了一页。',
    '「天空，是我的另一页魔导书。」', 'star', '#8e79bc', '#7565a1', 'staff', [150, 185, 28, 3, 4.6, 9], [5, 2, 5],
    [strike('雷鸣术', 'bolt', arcane, 2), storm('暴风雪', blue, 'snow'), burst('崩裂术', physical, 'diamond', 2.6), storm('陨石术', red, 'flame')]),
  make('sage', '贤者', 'Sage', 'mage', true, '元素魔法 · 结界辅助',
    '探寻魔法背后的规律，让知识成为温柔的庇护。智慧与好奇，都是永不枯竭的泉水。',
    '「答案之外，总有更有趣的问题。」', 'book', '#729da0', '#6e9a96', 'book', [180, 165, 23, 6, 4.9, 8], [4, 3, 5],
    [strike('元素箭', 'bolt', blue), guard('魔法护壁', arcane), trap('地元素领域', green), storm('四象共鸣', arcane)]),
  make('hunter', '猎人', 'Hunter', 'archer', true, '远程追猎 · 猎鹰伙伴',
    '与猎鹰分享天空，与森林分享秘密。无论山谷多深，总能找到回家的方向。',
    '「我的伙伴，会替我看见更远的地方。」', 'feather', '#83916b', '#7c9060', 'bow', [180, 115, 25, 5, 5.7, 10], [5, 3, 3],
    [strike('精准射击', 'target', green, 2.3), trap('霜冻陷阱'), summon('猎鹰突击', physical), burst('漫天箭雨', green, 'bow', 2.5)]),
  make('bard', '诗人', 'Bard', 'archer', true, '音律辅助 · 远程共鸣',
    '把相遇写进诗里，把离别唱成歌。篝火旁拨动琴弦，冒险便又多了一个值得怀念的夜晚。',
    '「愿多年后，你还记得这段旋律。」', 'music', '#7e9ca5', '#638a9b', 'lute', [185, 160, 20, 5, 5.1, 8], [3, 3, 5],
    [strike('乐器攻击', 'music', blue), song('布莱奇之诗', arcane), heal('苹果树之歌', 3.5), burst('不协和音', blue, 'music')]),
  make('dancer', '舞娘', 'Dancer', 'archer', true, '舞步辅助 · 灵巧控场',
    '裙摆划过花瓣与星光，每一个转身都是送给世界的祝福。让风，也跟着轻轻起舞。',
    '「起舞吧，今天的风刚刚好。」', 'fan', '#c38a9e', '#cb8da5', 'fan', [175, 160, 21, 4, 5.8, 7], [4, 3, 5],
    [strike('缎带之舞', 'wind', red), trap('月光魅舞', arcane), song('为你服务', red), burst('落花圆舞曲', red, 'flower', 2.4)]),
  make('priest', '牧师', 'Priest', 'acolyte', true, '神圣魔法 · 治愈守护',
    '愿圣歌越过长夜，愿善意抵达每一颗心。真正的奇迹，往往来自不曾放弃的陪伴。',
    '「别担心，我一直都在。」', 'sun', '#c5aa75', '#f1e8d6', 'mace', [205, 185, 21, 7, 4.8, 8], [3, 4, 5],
    [strike('神圣审判', 'cross', holy, 2), heal('高阶治愈术', 4.5), song('光耀之堂', holy), storm('十字驱魔', holy, 'sun')]),
  make('monk', '武僧', 'Monk', 'acolyte', true, '近战格斗 · 气功爆发',
    '一呼一吸间感受山川的力量。把修行化成拳风，让信念在每一次出拳中回响。',
    '「心静下来，便能听见自己的力量。」', 'fist', '#bc9165', '#c19a6c', 'fist', [240, 110, 26, 8, 5.5, 2], [5, 4, 3],
    [strike('连环全身掌', 'fist', physical, 2), guard('金刚不坏'), dash('弓身弹影', holy), skill('阿修罗霸凰拳', 'fist', 'burst', holy, '凝聚气力，向周围释放威力极强的一击。', 36, 16, 4.8, 4)]),
  make('blacksmith', '铁匠', 'Blacksmith', 'merchant', true, '近战制造 · 重锤猛攻',
    '火星从铁砧上跃起，一件新的杰作正在诞生。好装备的背后，总有一双可靠的手。',
    '「把梦想，锻造成趁手的模样。」', 'hammer', '#9c806b', '#9e775d', 'hammer', [245, 100, 27, 9, 4.6, 2.6], [5, 5, 2],
    [strike('大地之击', 'hammer', physical, 2.2), guard('武器保有'), burst('雷霆重锤', physical, 'hammer', 2.6), storm('烈焰锻炉', red, 'flame')]),
  make('alchemist', '炼金术士', 'Alchemist', 'merchant', true, '药剂魔法 · 生命创造',
    '把花露、月光和一点突发奇想装进玻璃瓶。实验的结果，常常比计划更加有趣。',
    '「再加一滴……嗯，这次一定没问题！」', 'flask', '#a590b2', '#8a81aa', 'flask', [200, 150, 23, 6, 4.9, 7], [4, 3, 5],
    [poison('强酸投掷'), heal('药水投掷', 4), burst('火烟瓶', red, 'flask'), summon('生命体召唤', green)]),
  make('assassin', '刺客', 'Assassin', 'thief', true, '近战爆发 · 双刃毒术',
    '月光落在双刃之间，脚步消失在夜色里。安静，是暴风来临之前最后的礼貌。',
    '「你看见的，只是我的影子。」', 'dagger', '#9887ac', '#736485', 'dagger', [185, 125, 29, 4, 6.3, 2.2], [5, 3, 2],
    [strike('音速投掷', 'dagger', arcane, 2.4), poison('毒性感染', arcane), dash('无影之牙', arcane), burst('十字斩', red, 'dagger', 3)]),
  make('rogue', '流氓', 'Rogue', 'thief', true, '灵巧近战 · 机变掠夺',
    '在街角留下笑声，在地图上画满捷径。规矩之外的世界，也有自己的温柔与正义。',
    '「别太认真，冒险就是要开心一点。」', 'mask', '#ac8174', '#aa7669', 'dagger', [205, 115, 25, 6, 6, 2.3], [5, 3, 3],
    [strike('背刺', 'dagger', red, 2.2), dash('潜击'), drain('偷袭掠夺'), trap('涂鸦陷阱', physical)]),
];

export const JOB_BY_ID = new Map(JOBS.map(job => [job.id, job]));
export const HAIR_COLORS = ['#805339', '#d8ae69', '#b66858', '#777293', '#d9d7c6', '#465a65'];
export const FAMILIES: Record<Family, string> = { novice: '初心', swordsman: '剑士系', mage: '法师系', archer: '弓手系', acolyte: '服事系', merchant: '商人系', thief: '盗贼系' };

export function getJob(id: string): Job { return JOB_BY_ID.get(id) ?? JOBS[1]; }
