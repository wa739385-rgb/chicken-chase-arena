export type GameMode = 'normal' | 'theft' | 'invisible' | 'crazy' | 'king' | 'challenges' | 'teams' | 'survival' | 'luck' | 'abilities';
export type GamePhase = 'menu' | 'lobby' | 'playing' | 'results';
export type ChickenType = 'normal' | 'fast' | 'teleport' | 'explosive' | 'golden';
export type AbilityType = 'speed' | 'magnet' | 'invisible' | 'freeze';

export interface GameConfig {
  mode: GameMode;
  roomCode: string;
  playerName: string;
  maxTime: number;
  botCount: number;
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
}

export const GAME_MODES: { id: GameMode; name: string; desc: string; icon: string }[] = [
  { id: 'normal', name: 'الطور العادي', desc: 'اجمع الفراخ وأرجعها لقاعدتك', icon: '🐔' },
  { id: 'theft', name: 'طور السرقة', desc: 'اسرق فراخ الخصوم من قواعدهم', icon: '🦹' },
  { id: 'invisible', name: 'طور الاختفاء', desc: 'اللاعبون شبه مخفيين', icon: '👻' },
  { id: 'crazy', name: 'الفراخ المجنونة', desc: 'فراخ سريعة وعشوائية', icon: '🤪' },
  { id: 'king', name: 'طور الملك', desc: 'اصطد الفرخة الذهبية!', icon: '👑' },
  { id: 'challenges', name: 'طور التحديات', desc: 'تحدي عشوائي كل 30 ثانية', icon: '🎯' },
  { id: 'teams', name: 'طور الفرق', desc: 'تعاون مع فريقك للفوز', icon: '🤝' },
  { id: 'survival', name: 'طور البقاء', desc: 'اهرب من الصياد!', icon: '🏃' },
  { id: 'luck', name: 'طور الحظ', desc: 'صناديق عشوائية بتأثيرات', icon: '🎁' },
  { id: 'abilities', name: 'طور القدرات', desc: 'استخدم قدرتك الخاصة', icon: '⚡' },
];

export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
export const PLAYER_NAMES_AR = ['أحمر', 'أزرق', 'أخضر', 'ذهبي'];

export const BASE_POSITIONS: [number, number, number][] = [
  [-11, 0, -11], [11, 0, -11], [-11, 0, 11], [11, 0, 11],
];

export const ARENA_RADIUS = 10;
export const MAP_EXTENT = 14;
export const BASE_SIZE = 3.5;
export const CHICKEN_CATCH_DIST = 1.2;
export const BASE_DEPOSIT_DIST = 3;
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
