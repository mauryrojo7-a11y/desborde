export type SkinId =
  | 'solar_spark'
  | 'cyan_plasma'
  | 'crimson_neon'
  | 'purple_void'
  | 'founder_gold';

export interface SkinConfig {
  id: SkinId;
  name: string;
  description: string;
  trailEffectLabel: string;
  priceSparks: number;
  exclusive?: boolean;
  exclusiveLabel?: string;
  coreColor: string;
  innerRingColor: string;
  glowColor: string;
  trailColor: string;
  secondaryTrailColor: string;
}

export type ShapeKind = 'circle' | 'triangle' | 'hexagon';

export interface GeometricShape {
  id: number;
  kind: ShapeKind;
  x: number;
  y: number;
  baseX: number;
  radius: number;
  hp: number;
  maxHp: number;
  rotation: number;
  rotSpeed: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  fallSpeed: number;
  strokeColor: string;
  fillColor: string;
  glowColor: string;
  hitFlash: number;
  squashTimer: number;
  dangerRatio: number;
}

export type OrbKind = 'mult2' | 'mult3' | 'shockwave';

export interface PowerOrb {
  id: number;
  kind: OrbKind;
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
  fallSpeed: number;
  side: 'left' | 'right';
}

export interface SparkBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  cooldownTimer: number;
  maxCooldown: number;
  readyFlashTimer: number;
  magnetTargetX: number | null;
  magnetTargetY: number | null;
  magnetBeamTimer: number;
  invulnTimer: number;
}

export type EnginePhase = 'playing' | 'revive_offer' | 'gameover';

export type DefeatReason = 'abyss' | 'overflow';

export interface HudSnapshot {
  score: number;
  combo: number;
  maxCombo: number;
  runSparks: number;
  shapesDestroyed: number;
  level: number;
  levelKills: number;
  levelTargetKills: number;
  overflowAlert: boolean;
  activeMultiplier: 1 | 2 | 3;
  multiplierTimeLeft: number;
  multiplierMaxTime: number;
  isFever: boolean;
  elapsedTime: number;
  phase: EnginePhase;
}

export interface RunSummary {
  score: number;
  maxCombo: number;
  shapesDestroyed: number;
  runSparks: number;
  durationSec: number;
  level: number;
  defeatReason: DefeatReason;
}
