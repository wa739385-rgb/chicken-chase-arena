export type GameMode = 'normal' | 'theft' | 'invisible' | 'king' | 'challenges' | 'teams' | 'survival' | 'luck' | 'abilities';
export type GamePhase = 'menu' | 'lobby' | 'playing' | 'results';
export type ChickenType = 'normal' | 'fast' | 'teleport' | 'explosive' | 'golden';
export type AbilityType = 'speed' | 'magnet' | 'invisible' | 'freeze';
export type GameMapId = 'farm' | 'desert' | 'snow' | 'night' | 'volcano' | 'space';

export interface MapConfig {
  id: GameMapId;
  name: string;
  icon: string;
  groundColor: string;
  arenaColor: string;
  arenaBorderColor: string;
  treeColor1: string;
  treeColor2: string;
  trunkColor: string;
  skyColor: string;
  ambientIntensity: number;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  grassPatches: string;
  hasTrees: boolean;
  decorationType: 'trees' | 'cacti' | 'snowballs' | 'rocks' | 'lava' | 'crystals';
}

export const GAME_MAPS: MapConfig[] = [
  {
    id: 'farm', name: 'المزرعة', icon: '🌾',
    groundColor: '#4a8c3f', arenaColor: '#9a7030', arenaBorderColor: '#8B6B28',
    treeColor1: '#3a7d32', treeColor2: '#2d6b28', trunkColor: '#6b4226',
    skyColor: '#87ceeb', ambientIntensity: 0.65, grassPatches: '#6b8e23',
    hasTrees: true, decorationType: 'trees',
  },
  {
    id: 'desert', name: 'الصحراء', icon: '🏜️',
    groundColor: '#c2a645', arenaColor: '#d4a537', arenaBorderColor: '#b8912e',
    treeColor1: '#6b8c23', treeColor2: '#8b7d3a', trunkColor: '#8b6914',
    skyColor: '#f0d58c', ambientIntensity: 0.85, grassPatches: '#a89040',
    hasTrees: false, decorationType: 'cacti',
  },
  {
    id: 'snow', name: 'الثلج', icon: '❄️',
    groundColor: '#e8eef5', arenaColor: '#c8d8e8', arenaBorderColor: '#b0c4d8',
    treeColor1: '#2d5a3e', treeColor2: '#1a4a30', trunkColor: '#5a4020',
    skyColor: '#b8c8d8', ambientIntensity: 0.75, grassPatches: '#d0dce8',
    fogColor: '#c0d0e0', fogNear: 20, fogFar: 60,
    hasTrees: false, decorationType: 'snowballs',
  },
  {
    id: 'night', name: 'الليل', icon: '🌙',
    groundColor: '#1a2a1a', arenaColor: '#2a3a20', arenaBorderColor: '#223018',
    treeColor1: '#1a3a22', treeColor2: '#122a18', trunkColor: '#3a2a10',
    skyColor: '#0a0a1a', ambientIntensity: 0.3, grassPatches: '#2a3a1a',
    fogColor: '#0a0a1a', fogNear: 12, fogFar: 35,
    hasTrees: true, decorationType: 'trees',
  },
  {
    id: 'volcano', name: 'البركان', icon: '🌋',
    groundColor: '#3a2020', arenaColor: '#4a2a1a', arenaBorderColor: '#5a3020',
    treeColor1: '#2a1a1a', treeColor2: '#1a1010', trunkColor: '#3a2010',
    skyColor: '#2a1515', ambientIntensity: 0.45, grassPatches: '#4a2a1a',
    hasTrees: false, decorationType: 'lava',
  },
  {
    id: 'space', name: 'الفضاء', icon: '🚀',
    groundColor: '#0a0a2a', arenaColor: '#1a1a3a', arenaBorderColor: '#2a2a4a',
    treeColor1: '#3a2a6a', treeColor2: '#2a1a5a', trunkColor: '#4a3a7a',
    skyColor: '#050510', ambientIntensity: 0.4, grassPatches: '#1a1a3a',
    fogColor: '#050510', fogNear: 25, fogFar: 70,
    hasTrees: false, decorationType: 'crystals',
  },
];

export interface GameConfig {
  mode: GameMode;
  roomCode: string;
  playerName: string;
  maxTime: number;
  botCount: number;
  mapId: GameMapId;
}

export interface PlayerScore {
  id: string;
  name: string;
  color: string;
  score: number;
  team?: number;
}

export interface HudData {
  scores: PlayerScore[];
  localCarried: number;
  modeInfo: string;
  challengeText?: string;
  abilityReady?: boolean;
  abilityCooldown?: number;
  abilityType?: AbilityType;
}

export const GAME_MODES: { id: GameMode; name: string; desc: string; icon: string }[] = [
  { id: 'normal', name: 'الطور العادي', desc: 'اجمع الفراخ وأرجعها لقاعدتك', icon: '🐔' },
  { id: 'theft', name: 'طور السرقة', desc: 'اسرق فراخ الخصوم من قواعدهم', icon: '🦹' },
  { id: 'invisible', name: 'طور الاختفاء', desc: 'الفراخ مخفية! ابحث عنها بلمسها', icon: '👻' },
  { id: 'king', name: 'طور الملك', desc: 'اصطد الفرخة الذهبية!', icon: '👑' },
  { id: 'challenges', name: 'طور التحديات', desc: 'تحدي عشوائي كل 30 ثانية', icon: '🎯' },
  { id: 'teams', name: 'طور الفرق', desc: 'فريقان يتنافسان! تعاون مع فريقك', icon: '🤝' },
  { id: 'survival', name: 'طور البقاء', desc: 'اهرب من الصياد!', icon: '🏃' },
  { id: 'luck', name: 'طور الحظ', desc: 'صناديق عشوائية بتأثيرات', icon: '🎁' },
  { id: 'abilities', name: 'طور القدرات', desc: 'استخدم قدرتك الخاصة', icon: '⚡' },
];

export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
export const PLAYER_NAMES_AR = ['أحمر', 'أزرق', 'أخضر', 'ذهبي'];

export const TEAM_BASE_POSITIONS: [number, number, number][] = [
  [-11, 0, -11], [11, 0, -11],
];

export const BASE_POSITIONS: [number, number, number][] = [
  [-11, 0, -11], [11, 0, -11], [-11, 0, 11], [11, 0, 11],
];

export const ARENA_RADIUS = 12;
export const MAP_EXTENT = 16;
export const BASE_SIZE = 4;
export const CHICKEN_CATCH_DIST = 1.4;
export const BASE_DEPOSIT_DIST = 3.5;
export const DEFAULT_GAME_TIME = 120;
export const MAX_CHICKENS = 20;
export const PLAYER_SPEED = 7;
export const CHICKEN_SPEED_NORMAL = 1.5;
export const CHICKEN_SPEED_FAST = 4;
export const CHICKEN_SPEED_CRAZY = 6;

export const CHALLENGES = [
  'اجمع الفراخ البيضاء فقط!',
  'ممنوع السرقة هذه الجولة!',
  'الخريطة مظلمة... كن حذراً!',
  'فراخ مضاعفة النقاط!',
  'سرعة مخفضة للجميع!',
];

export const ABILITY_NAMES: Record<AbilityType, string> = {
  speed: 'سرعة خارقة',
  magnet: 'مغناطيس الفراخ',
  invisible: 'اختفاء',
  freeze: 'تجميد الخصوم',
};

export const ABILITY_DESCRIPTIONS: Record<AbilityType, string> = {
  speed: 'سرعة مضاعفة لـ 3 ثوانٍ',
  magnet: 'جذب أقرب فرخة إليك',
  invisible: 'اختفِ عن البوتات لـ 4 ثوانٍ',
  freeze: 'جمّد كل الخصوم لـ 3 ثوانٍ',
};
