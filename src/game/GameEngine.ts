import { ParticleSystem } from './Particles';
import { soundEngine } from './SoundEngine';
import {
  DefeatReason,
  EnginePhase,
  GeometricShape,
  HudSnapshot,
  OrbKind,
  PowerOrb,
  RunSummary,
  ShapeKind,
  SkinConfig,
  SparkBall,
} from './types';
import {
  hapticHeavy,
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
} from '../services/nativeBridge';

export interface GameEngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onReviveOffer: (summary: RunSummary) => void;
  onGameOver: (summary: RunSummary) => void;
}

const GRAVITY = 820;
const MAX_FALL_SPEED = 720;
const IMPULSE_COOLDOWN_SEC = 0.35;
const COMBO_RESET_TIME = 2.6;
const MULTIPLIER_DURATION_SEC = 8.0;
const MAX_DT = 0.033;
const OVERFLOW_WARN_DIST = 80;

const LEVEL_THEMES = [
  { accent: '#22d3ee', tintRgb: '34, 211, 238' },
  { accent: '#a855f7', tintRgb: '168, 85, 247' },
  { accent: '#10b981', tintRgb: '16, 185, 129' },
  { accent: '#f43f5e', tintRgb: '244, 63, 94' },
  { accent: '#f59e0b', tintRgb: '245, 158, 11' },
  { accent: '#e879f9', tintRgb: '232, 121, 249' },
] as const;

const SHAPE_PALETTES = [
  { stroke: '#22d3ee', fill: 'rgba(6, 182, 212, 0.16)', glow: '#06b6d4' },
  { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.16)', glow: '#e11d48' },
  { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.16)', glow: '#9333ea' },
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.16)', glow: '#059669' },
  { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.16)', glow: '#d97706' },
] as const;

interface PolygonCollisionResult {
  hit: boolean;
  nx: number;
  ny: number;
  penetration: number;
  contactX: number;
  contactY: number;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameEngineCallbacks;
  private particles = new ParticleSystem();

  private width = 390;
  private height = 844;
  private safeTop = 16;
  private safeBottom = 20;

  private skin: SkinConfig;
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private disposed = false;

  private phase: EnginePhase = 'playing';
  private elapsedTime = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private runSparks = 0;
  private shapesDestroyed = 0;
  private level = 1;
  private levelKills = 0;
  private levelTargetKills = 15;
  private defeatReason: DefeatReason = 'abyss';
  private revivedUsed = false;

  private activeMultiplier: 1 | 2 | 3 = 1;
  private multiplierTimeLeft = 0;

  private hitstopTimer = 0;
  private slowMoTimer = 0;
  private screenFlashAlpha = 0;
  private screenFlashColor = '#ffffff';
  private shakeTimer = 0;
  private shakeStrength = 0;
  private touchHintAlpha = 1;
  private impulseCount = 0;
  private edgePulseLeft = 0;
  private edgePulseRight = 0;
  private overflowAlert = false;
  private overflowDangerMax = 0;
  private overflowWarnBeepTimer = 0;

  private nextId = 1;
  private spawnTimer = 0.25;
  private orbSpawnTimer = 8.5;
  private shapes: GeometricShape[] = [];
  private orbs: PowerOrb[] = [];
  private shapeHitCooldowns = new Map<number, number>();
  private hudEmitAccumulator = 0;

  private ball: SparkBall = {
    x: 195,
    y: 520,
    vx: 0,
    vy: -420,
    radius: 14,
    cooldownTimer: 0,
    maxCooldown: IMPULSE_COOLDOWN_SEC,
    readyFlashTimer: 0,
    magnetTargetX: null,
    magnetTargetY: null,
    magnetBeamTimer: 0,
    invulnTimer: 0,
  };

  constructor(
    canvas: HTMLCanvasElement,
    initialSkin: SkinConfig,
    callbacks: GameEngineCallbacks
  ) {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('No se pudo inicializar el contexto Canvas 2D.');
    }
    this.canvas = canvas;
    this.ctx = context;
    this.skin = initialSkin;
    this.callbacks = callbacks;

    this.resize(canvas.clientWidth || 390, canvas.clientHeight || 844);
    this.resetState();
  }

  public setSkin(skin: SkinConfig): void {
    this.skin = skin;
  }

  public setSafeInsets(safeTop: number, safeBottom: number): void {
    this.safeTop = Math.max(8, safeTop);
    this.safeBottom = Math.max(12, safeBottom);
  }

  public resize(cssWidth: number, cssHeight: number): void {
    const safeW = Math.max(280, Math.floor(cssWidth));
    const safeH = Math.max(460, Math.floor(cssHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    this.width = safeW;
    this.height = safeH;

    this.canvas.width = Math.floor(safeW * dpr);
    this.canvas.height = Math.floor(safeH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Keep ball horizontally bounded on resize
    this.ball.x = Math.max(
      this.ball.radius + 8,
      Math.min(this.width - this.ball.radius - 8, this.ball.x)
    );
  }

  public start(): void {
    if (this.rafId !== null || this.disposed) return;
    this.lastFrameMs = performance.now();
    this.emitHud();
    this.rafId = window.requestAnimationFrame(this.loop);
  }

  public stop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.stop();
    this.particles.clear();
  }

  public restartImmediate(): void {
    this.resetState();
    this.emitHud();
    if (this.rafId === null && !this.disposed) {
      this.lastFrameMs = performance.now();
      this.rafId = window.requestAnimationFrame(this.loop);
    }
  }

  private getOverflowLineY(): number {
    return Math.min(this.height * 0.79, this.height - this.safeBottom - 108);
  }

  private getLevelTheme(): { accent: string; tintRgb: string } {
    return LEVEL_THEMES[(this.level - 1) % LEVEL_THEMES.length];
  }

  private getLevelTargetKills(lvl: number): number {
    return 15 + (lvl - 1) * 5;
  }

  private getShapeBottomY(shape: GeometricShape): number {
    if (shape.kind === 'circle') {
      return shape.y + shape.radius;
    }
    const sides = shape.kind === 'triangle' ? 3 : 6;
    let maxY = shape.y;
    for (let i = 0; i < sides; i += 1) {
      const angle = shape.rotation + (Math.PI * 2 * i) / sides;
      const vy = shape.y + Math.sin(angle) * shape.radius;
      if (vy > maxY) {
        maxY = vy;
      }
    }
    return maxY;
  }

  public revivePlayer(): void {
    if (this.phase !== 'revive_offer' || this.revivedUsed) return;
    this.revivedUsed = true;
    this.phase = 'playing';
    this.overflowAlert = false;
    this.overflowDangerMax = 0;

    const overflowY = this.getOverflowLineY();
    this.ball.x = this.width * 0.5;
    this.ball.y = Math.min(this.height * 0.62, overflowY - 62);
    this.ball.vx = 0;
    this.ball.vy = -590;
    this.ball.cooldownTimer = 0;
    this.ball.invulnTimer = 2.0;
    this.comboTimer = COMBO_RESET_TIME;

    // Shockwave destroys shapes near the overflow line and pushes remaining ones upward
    const destroyThresholdY = overflowY - 170;
    const minTopY = this.safeTop + 92;

    for (let i = this.shapes.length - 1; i >= 0; i -= 1) {
      const s = this.shapes[i];
      const bottomY = this.getShapeBottomY(s);
      if (bottomY >= destroyThresholdY) {
        this.particles.emitShapeExplosion(
          s.x,
          s.y,
          s.strokeColor,
          '#ffffff',
          s.radius,
          false
        );
        this.shapes.splice(i, 1);
      } else {
        s.y = Math.max(minTopY + s.radius, s.y - 110);
        s.dangerRatio = 0;
      }
    }

    this.particles.emitShockwave(this.width * 0.5, overflowY, 240);
    this.particles.addFloatingText(
      this.ball.x,
      this.ball.y - 38,
      '¡REVIVIDO! ESCUDO 2s',
      '#4ade80',
      18,
      1.05
    );
    this.triggerShake(8, 0.28);
    soundEngine.playRevive();
    hapticSuccess();

    this.lastFrameMs = performance.now();
    this.emitHud();
  }

  public declineRevive(): void {
    if (this.phase !== 'revive_offer') return;
    this.phase = 'gameover';
    soundEngine.playGameOver();
    hapticWarning();
    this.emitHud();
    this.callbacks.onGameOver(this.buildSummary());
  }

  public handlePointerDown(clientX: number, clientY: number): void {
    if (this.phase !== 'playing') return;

    soundEngine.unlock();
    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    // Ignore accidental touches inside the top HUD bar
    if (localY < this.safeTop + 74) {
      return;
    }

    if (this.ball.cooldownTimer > 0) {
      return;
    }

    this.applyMagneticImpulse(localX);
  }

  private resetState(): void {
    this.phase = 'playing';
    this.elapsedTime = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.runSparks = 0;
    this.shapesDestroyed = 0;
    this.level = 1;
    this.levelKills = 0;
    this.levelTargetKills = this.getLevelTargetKills(1);
    this.defeatReason = 'abyss';
    this.revivedUsed = false;

    this.activeMultiplier = 1;
    this.multiplierTimeLeft = 0;

    this.hitstopTimer = 0;
    this.slowMoTimer = 0;
    this.screenFlashAlpha = 0;
    this.screenFlashColor = '#ffffff';
    this.shakeTimer = 0;
    this.shakeStrength = 0;
    this.touchHintAlpha = 1;
    this.impulseCount = 0;
    this.edgePulseLeft = 0;
    this.edgePulseRight = 0;
    this.overflowAlert = false;
    this.overflowDangerMax = 0;
    this.overflowWarnBeepTimer = 0;

    this.shapes = [];
    this.orbs = [];
    this.shapeHitCooldowns.clear();
    this.particles.clear();

    this.spawnTimer = 0.35;
    this.orbSpawnTimer = 7.5;

    const overflowY = this.getOverflowLineY();
    this.ball = {
      x: this.width * 0.5,
      y: Math.min(this.height * 0.62, overflowY - 62),
      vx: (Math.random() - 0.5) * 90,
      vy: -510,
      radius: 14,
      cooldownTimer: 0,
      maxCooldown: IMPULSE_COOLDOWN_SEC,
      readyFlashTimer: 0,
      magnetTargetX: null,
      magnetTargetY: null,
      magnetBeamTimer: 0,
      invulnTimer: 0.75,
    };

    // Pre-populate opening wave so action begins immediately with zero dead air
    this.spawnWaveRow(this.safeTop + 135, 3, 1, 2);
    this.spawnWaveRow(this.safeTop + 225, 2, 1, 2);
  }

  private applyMagneticImpulse(touchX: number): void {
    this.ball.cooldownTimer = IMPULSE_COOLDOWN_SEC;
    this.impulseCount += 1;

    // Direction biased by touch X position relative to screen center & ball position
    const normTouchOffset = ((touchX / this.width) - 0.5) * 2; // -1 to +1
    const deltaToTouchX = touchX - this.ball.x;
    let desiredVx = deltaToTouchX * 2.1 + normTouchOffset * 140;
    desiredVx = Math.max(-440, Math.min(440, desiredVx));
    let desiredVy = -585;

    // Magnetic auto-assist toward closest shape or power orb in range (215px)
    let bestTarget: { x: number; y: number; dist: number; isOrb: boolean } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.orbs.length; i += 1) {
      const orb = this.orbs[i];
      const dx = orb.x - this.ball.x;
      const dy = orb.y - this.ball.y;
      if (dy > 75) continue;
      const dist = Math.hypot(dx, dy);
      if (dist <= 220 && Math.abs(orb.x - touchX) < 165) {
        const weighted = dist * 0.75;
        if (weighted < bestScore) {
          bestScore = weighted;
          bestTarget = { x: orb.x, y: orb.y, dist, isOrb: true };
        }
      }
    }

    for (let i = 0; i < this.shapes.length; i += 1) {
      const shape = this.shapes[i];
      const dx = shape.x - this.ball.x;
      const dy = shape.y - this.ball.y;
      if (dy > 65) continue;
      const dist = Math.hypot(dx, dy);
      if (dist <= 215 && Math.abs(shape.x - touchX) < 155) {
        const weighted = dist + Math.abs(shape.x - touchX) * 0.35;
        if (weighted < bestScore) {
          bestScore = weighted;
          bestTarget = { x: shape.x, y: shape.y, dist, isOrb: false };
        }
      }
    }

    let assisted = false;
    if (bestTarget && bestTarget.dist > 6) {
      assisted = true;
      const nx = (bestTarget.x - this.ball.x) / bestTarget.dist;
      const ny = (bestTarget.y - this.ball.y) / bestTarget.dist;
      const speed = bestTarget.isOrb ? 640 : 615;
      const blend = 0.68;

      desiredVx = desiredVx * (1 - blend) + nx * speed * blend;
      desiredVy = Math.min(-480, desiredVy * (1 - blend) + ny * speed * blend);

      this.ball.magnetTargetX = bestTarget.x;
      this.ball.magnetTargetY = bestTarget.y;
      this.ball.magnetBeamTimer = 0.14;
    } else {
      this.ball.magnetTargetX = null;
      this.ball.magnetTargetY = null;
      this.ball.magnetBeamTimer = 0;
    }

    this.ball.vx = Math.max(-480, Math.min(480, desiredVx));
    this.ball.vy = desiredVy;

    this.particles.emitImpulseBurst(this.ball.x, this.ball.y, this.skin, assisted);
    soundEngine.playImpulse(assisted);
    hapticLight();
  }

  private loop = (nowMs: number): void => {
    if (this.disposed) return;

    const rawDt = (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;
    const dt = Math.min(Math.max(rawDt, 0), MAX_DT);

    if (this.phase === 'playing') {
      this.update(dt);
    }

    this.render();

    if (this.phase === 'playing') {
      this.rafId = window.requestAnimationFrame(this.loop);
    } else {
      this.rafId = null;
    }
  };

  private update(dt: number): void {
    this.elapsedTime += dt;

    if (this.impulseCount >= 2 && this.touchHintAlpha > 0) {
      this.touchHintAlpha = Math.max(0, this.touchHintAlpha - dt * 1.8);
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 1.45);
    }

    if (this.edgePulseLeft > 0) this.edgePulseLeft = Math.max(0, this.edgePulseLeft - dt * 3);
    if (this.edgePulseRight > 0) this.edgePulseRight = Math.max(0, this.edgePulseRight - dt * 3);

    // Hitstop pauses movement integration for 25-35ms for weighty impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.particles.update(dt * 0.25);
      return;
    }

    let simDt = dt;
    if (this.slowMoTimer > 0) {
      this.slowMoTimer = Math.max(0, this.slowMoTimer - dt);
      simDt = dt * 0.3;
    }

    // Cooldown & power-up timers
    if (this.ball.cooldownTimer > 0) {
      const prev = this.ball.cooldownTimer;
      this.ball.cooldownTimer = Math.max(0, prev - simDt);
      if (prev > 0 && this.ball.cooldownTimer === 0) {
        this.ball.readyFlashTimer = 0.16;
      }
    }
    if (this.ball.readyFlashTimer > 0) {
      this.ball.readyFlashTimer = Math.max(0, this.ball.readyFlashTimer - dt);
    }
    if (this.ball.magnetBeamTimer > 0) {
      this.ball.magnetBeamTimer = Math.max(0, this.ball.magnetBeamTimer - dt);
    }
    if (this.ball.invulnTimer > 0) {
      this.ball.invulnTimer = Math.max(0, this.ball.invulnTimer - dt);
    }

    if (this.combo > 0) {
      this.comboTimer -= simDt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }

    if (this.activeMultiplier > 1) {
      this.multiplierTimeLeft -= simDt;
      if (this.multiplierTimeLeft <= 0) {
        this.activeMultiplier = 1;
        this.multiplierTimeLeft = 0;
      }
    }

    // Tick per-shape hit cooldowns
    this.shapeHitCooldowns.forEach((remaining, shapeId) => {
      const next = remaining - simDt;
      if (next <= 0) {
        this.shapeHitCooldowns.delete(shapeId);
      } else {
        this.shapeHitCooldowns.set(shapeId, next);
      }
    });

    // Procedural wave & risk-reward orb spawning
    this.spawnTimer -= simDt;
    if (this.spawnTimer <= 0) {
      this.spawnProceduralWave();
    }

    this.orbSpawnTimer -= simDt;
    if (this.orbSpawnTimer <= 0) {
      this.spawnEdgeOrb();
    }

    // Move shapes & orbs and evaluate Overflow Line proximity
    this.updateShapesAndOrbs(simDt);
    if (this.phase !== 'playing') {
      return;
    }

    // 2 deterministic physics substeps per frame
    const subDt = simDt * 0.5;
    for (let step = 0; step < 2; step += 1) {
      if (this.phase !== 'playing') break;
      this.stepBallPhysics(subDt);
    }

    // Trail & particle updates
    this.particles.addTrailSample(
      this.ball.x,
      this.ball.y,
      this.ball.radius,
      this.skin,
      this.combo >= 5,
      simDt
    );
    this.particles.update(simDt);

    this.hudEmitAccumulator += dt;
    if (this.hudEmitAccumulator >= 0.05) {
      this.hudEmitAccumulator = 0;
      this.emitHud();
    }
  }

  private updateShapesAndOrbs(dt: number): void {
    const abyssLine = this.height + 55;
    const overflowLineY = this.getOverflowLineY();
    let maxDanger = 0;

    for (let i = this.shapes.length - 1; i >= 0; i -= 1) {
      const s = this.shapes[i];
      s.y += s.fallSpeed * dt;
      s.rotation += s.rotSpeed * dt;

      if (s.swayAmp > 0) {
        s.swayPhase += s.swayFreq * dt;
        const margin = s.radius + 14;
        const nextX = s.baseX + Math.sin(s.swayPhase) * s.swayAmp;
        s.x = Math.max(margin, Math.min(this.width - margin, nextX));
      }

      if (s.hitFlash > 0) {
        s.hitFlash = Math.max(0, s.hitFlash - dt * 6);
      }
      if (s.squashTimer > 0) {
        s.squashTimer = Math.max(0, s.squashTimer - dt * 5);
      }

      const bottomY = this.getShapeBottomY(s);
      const distToOverflow = overflowLineY - bottomY;

      if (distToOverflow <= 0) {
        s.dangerRatio = 1;
        this.particles.emitShapeExplosion(
          s.x,
          overflowLineY,
          '#ef4444',
          '#f59e0b',
          s.radius,
          true
        );
        this.overflowAlert = true;
        this.overflowDangerMax = 1;
        this.triggerDefeat('overflow');
        return;
      }

      if (distToOverflow < OVERFLOW_WARN_DIST) {
        s.dangerRatio = Math.max(0, Math.min(1, 1 - distToOverflow / OVERFLOW_WARN_DIST));
        if (s.dangerRatio > maxDanger) {
          maxDanger = s.dangerRatio;
        }
      } else {
        s.dangerRatio = 0;
      }

      if (s.y - s.radius > abyssLine) {
        this.shapes.splice(i, 1);
      }
    }

    this.overflowDangerMax = maxDanger;
    this.overflowAlert = maxDanger > 0;
    if (this.overflowAlert) {
      this.overflowWarnBeepTimer -= dt;
      if (this.overflowWarnBeepTimer <= 0) {
        soundEngine.playOverflowWarning(maxDanger);
        this.overflowWarnBeepTimer = Math.max(0.28, 0.58 - maxDanger * 0.24);
      }
    } else {
      this.overflowWarnBeepTimer = 0.05;
    }

    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      orb.y += orb.fallSpeed * dt;
      orb.pulsePhase += dt * 5.2;
      if (orb.y - orb.radius > abyssLine) {
        this.orbs.splice(i, 1);
      }
    }
  }

  private stepBallPhysics(subDt: number): void {
    this.ball.vy = Math.min(MAX_FALL_SPEED, this.ball.vy + GRAVITY * subDt);
    this.ball.x += this.ball.vx * subDt;
    this.ball.y += this.ball.vy * subDt;

    // Wall bounces
    const leftLimit = this.ball.radius + 4;
    const rightLimit = this.width - this.ball.radius - 4;
    if (this.ball.x < leftLimit) {
      this.ball.x = leftLimit;
      this.ball.vx = Math.abs(this.ball.vx) * 0.88 + 25;
      this.edgePulseLeft = 1;
    } else if (this.ball.x > rightLimit) {
      this.ball.x = rightLimit;
      this.ball.vx = -Math.abs(this.ball.vx) * 0.88 - 25;
      this.edgePulseRight = 1;
    }

    // Soft ceiling below HUD + level bar
    const topLimit = this.safeTop + 82 + this.ball.radius;
    if (this.ball.y < topLimit) {
      this.ball.y = topLimit;
      this.ball.vy = Math.max(120, Math.abs(this.ball.vy) * 0.65);
    }

    // Power orbs pickup (Circle vs Circle)
    for (let i = this.orbs.length - 1; i >= 0; i -= 1) {
      const orb = this.orbs[i];
      const dx = this.ball.x - orb.x;
      const dy = this.ball.y - orb.y;
      const minDist = this.ball.radius + orb.radius;
      if (dx * dx + dy * dy <= minDist * minDist) {
        this.collectOrb(orb);
        this.orbs.splice(i, 1);
      }
    }

    // Shape collisions (Circle vs Circle / Convex Polygon)
    for (let i = this.shapes.length - 1; i >= 0; i -= 1) {
      const shape = this.shapes[i];
      const result = this.checkShapeCollision(shape);
      if (!result.hit) continue;

      // Push ball outside overlapping volume
      this.ball.x += result.nx * (result.penetration + 0.6);
      this.ball.y += result.ny * (result.penetration + 0.6);

      // Reflect velocity and guarantee upward arcade bounce
      const dot = this.ball.vx * result.nx + this.ball.vy * result.ny;
      if (dot < 0) {
        this.ball.vx -= 1.85 * dot * result.nx;
        this.ball.vy -= 1.85 * dot * result.ny;
      }

      if (result.ny <= 0.25) {
        // Upper/side bounce: strong upward lift
        this.ball.vy = Math.min(this.ball.vy, -455);
      } else {
        // Hit from underneath: push laterally and keep momentum flowing
        this.ball.vy = Math.max(this.ball.vy, 180);
        if (Math.abs(this.ball.vx) < 120) {
          this.ball.vx += (this.ball.x >= shape.x ? 1 : -1) * 185;
        }
      }
      this.ball.vx = Math.max(-520, Math.min(520, this.ball.vx));

      if (!this.shapeHitCooldowns.has(shape.id)) {
        this.shapeHitCooldowns.set(shape.id, 0.085);
        this.onShapeHit(shape, i, result.contactX, result.contactY);
      }
    }

    // Bottom abyss defeat check
    if (this.ball.y - this.ball.radius > this.height + 16) {
      if (this.ball.invulnTimer > 0) {
        // Invulnerability grace rescue after revive
        this.ball.y = this.height - this.ball.radius - 10;
        this.ball.vy = -560;
        return;
      }
      this.triggerDefeat('abyss');
    }
  }

  private checkShapeCollision(shape: GeometricShape): PolygonCollisionResult {
    if (shape.kind === 'circle') {
      const dx = this.ball.x - shape.x;
      const dy = this.ball.y - shape.y;
      const minDist = this.ball.radius + shape.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist) {
        return { hit: false, nx: 0, ny: -1, penetration: 0, contactX: shape.x, contactY: shape.y };
      }
      const dist = Math.sqrt(distSq) || 0.0001;
      const nx = dx / dist;
      const ny = dy / dist;
      return {
        hit: true,
        nx,
        ny,
        penetration: minDist - dist,
        contactX: shape.x + nx * shape.radius,
        contactY: shape.y + ny * shape.radius,
      };
    }

    const sides = shape.kind === 'triangle' ? 3 : 6;
    const vertices = this.getPolygonVertices(shape, sides);
    return this.circleVsConvexPolygon(
      this.ball.x,
      this.ball.y,
      this.ball.radius,
      shape.x,
      shape.y,
      vertices
    );
  }

  private getPolygonVertices(shape: GeometricShape, sides: number): Array<{ x: number; y: number }> {
    const verts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < sides; i += 1) {
      const angle = shape.rotation + (Math.PI * 2 * i) / sides;
      verts.push({
        x: shape.x + Math.cos(angle) * shape.radius,
        y: shape.y + Math.sin(angle) * shape.radius,
      });
    }
    return verts;
  }

  private circleVsConvexPolygon(
    cx: number,
    cy: number,
    r: number,
    polyX: number,
    polyY: number,
    verts: Array<{ x: number; y: number }>
  ): PolygonCollisionResult {
    let minDistSq = Number.POSITIVE_INFINITY;
    let closestX = polyX;
    let closestY = polyY;

    for (let i = 0; i < verts.length; i += 1) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const abLenSq = abx * abx + aby * aby || 0.0001;
      const t = Math.max(0, Math.min(1, ((cx - a.x) * abx + (cy - a.y) * aby) / abLenSq));
      const px = a.x + abx * t;
      const py = a.y + aby * t;
      const dx = cx - px;
      const dy = cy - py;
      const dSq = dx * dx + dy * dy;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestX = px;
        closestY = py;
      }
    }

    const inside = this.isPointInsideConvexPolygon(cx, cy, verts);
    if (!inside && minDistSq >= r * r) {
      return { hit: false, nx: 0, ny: -1, penetration: 0, contactX: closestX, contactY: closestY };
    }

    const dist = Math.sqrt(minDistSq);
    if (inside) {
      const dx = cx - polyX;
      const dy = cy - polyY;
      const centerLen = Math.hypot(dx, dy) || 0.0001;
      return {
        hit: true,
        nx: dx / centerLen,
        ny: dy / centerLen,
        penetration: r + dist,
        contactX: closestX,
        contactY: closestY,
      };
    }

    const nx = dist > 0.0001 ? (cx - closestX) / dist : 0;
    const ny = dist > 0.0001 ? (cy - closestY) / dist : -1;
    return {
      hit: true,
      nx,
      ny,
      penetration: r - dist,
      contactX: closestX,
      contactY: closestY,
    };
  }

  private isPointInsideConvexPolygon(
    px: number,
    py: number,
    verts: Array<{ x: number; y: number }>
  ): boolean {
    let sign = 0;
    for (let i = 0; i < verts.length; i += 1) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
      if (Math.abs(cross) < 1e-4) continue;
      const currentSign = cross > 0 ? 1 : -1;
      if (sign === 0) {
        sign = currentSign;
      } else if (sign !== currentSign) {
        return false;
      }
    }
    return true;
  }

  private onShapeHit(
    shape: GeometricShape,
    index: number,
    contactX: number,
    contactY: number
  ): void {
    shape.hp -= 1;
    shape.hitFlash = 1;
    shape.squashTimer = 1;

    this.combo += 1;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
    this.comboTimer = COMBO_RESET_TIME;

    // Reset impulse cooldown slightly faster on clean chain hits for snappy flow
    this.ball.cooldownTimer = Math.min(this.ball.cooldownTimer, 0.14);

    const points = 10 * this.combo * this.activeMultiplier;
    this.score += points;

    this.particles.emitHitSparks(contactX, contactY, shape.strokeColor, 8);
    this.particles.addFloatingText(
      contactX,
      contactY - 12,
      `+${points}`,
      this.combo >= 5 ? '#fde047' : '#f4f4f5',
      this.combo >= 5 ? 17 : 14
    );

    if (this.combo >= 5 && (this.combo === 5 || this.combo % 5 === 0)) {
      this.particles.addFloatingText(
        this.ball.x,
        this.ball.y - 32,
        `COMBO x${this.combo}!`,
        '#fb923c',
        19
      );
    }

    soundEngine.playComboHit(this.combo);

    if (shape.hp <= 0) {
      const leveledUp = this.destroyShapeAt(index, true);
      if (!leveledUp && this.elapsedTime > 5.0 && this.shapes.length === 0) {
        this.triggerAllClear();
      }
    } else {
      this.triggerShake(Math.min(5, 1.5 + this.combo * 0.25), 0.08);
      hapticLight();
    }

    this.emitHud();
  }

  private destroyShapeAt(index: number, countForProgression: boolean): boolean {
    const shape = this.shapes[index];
    if (!shape) return false;
    this.shapes.splice(index, 1);

    this.shapesDestroyed += 1;
    const isHeavy = shape.maxHp >= 3;

    const bonusScore = 25 * shape.maxHp * this.activeMultiplier;
    this.score += bonusScore;

    const earnedSparks = (1 + Math.floor(shape.maxHp / 2)) * this.activeMultiplier;
    this.runSparks += earnedSparks;

    this.particles.emitShapeExplosion(
      shape.x,
      shape.y,
      shape.strokeColor,
      '#fde047',
      shape.radius,
      isHeavy
    );
    this.particles.addFloatingText(
      shape.x,
      shape.y - 16,
      `+${earnedSparks} CHISPAS`,
      '#fde047',
      14
    );

    if (isHeavy) {
      // 25-35ms Hitstop on larger geometric figures
      this.hitstopTimer = 0.03;
      hapticHeavy();
    } else {
      hapticMedium();
    }

    this.triggerShake(Math.min(12, 3.2 + this.combo * 0.45 + shape.maxHp * 0.4), 0.16);
    soundEngine.playDestroy(shape.maxHp);

    if (countForProgression) {
      this.levelKills += 1;
      if (this.levelKills >= this.levelTargetKills) {
        this.triggerLevelUp();
        return true;
      }
    }

    return false;
  }

  private triggerLevelUp(): void {
    this.level += 1;
    this.levelKills = 0;
    this.levelTargetKills = this.getLevelTargetKills(this.level);
    this.overflowAlert = false;
    this.overflowDangerMax = 0;

    const theme = this.getLevelTheme();
    const cx = this.width * 0.5;
    const cy = this.height * 0.44;

    this.particles.emitLevelUpWave(cx, cy, Math.max(this.width, this.height) * 0.85, theme.accent);
    this.screenFlashColor = theme.accent;
    this.screenFlashAlpha = 0.26;
    this.triggerShake(9, 0.26);

    // Clear all remaining shapes on screen and grant their destruction points
    for (let i = this.shapes.length - 1; i >= 0; i -= 1) {
      const s = this.shapes[i];
      this.score += 25 * s.maxHp * this.activeMultiplier;
      this.shapesDestroyed += 1;
      this.particles.emitShapeExplosion(
        s.x,
        s.y,
        s.strokeColor,
        theme.accent,
        s.radius,
        false
      );
      this.shapes.splice(i, 1);
    }

    this.particles.addFloatingText(
      cx,
      cy - 14,
      `NIVEL ${this.level}`,
      theme.accent,
      28,
      1.25
    );
    this.particles.addFloatingText(
      cx,
      cy + 20,
      `OLEADA ACELERADA`,
      '#fafafa',
      13,
      1.05
    );

    this.spawnTimer = Math.max(this.spawnTimer, 1.15);
    soundEngine.playLevelUp(this.level);
    hapticSuccess();
  }

  private triggerAllClear(): void {
    const clearBonus = 500 * this.level;
    const sparkBonus = 15;

    this.score += clearBonus;
    this.runSparks += sparkBonus;
    this.slowMoTimer = 0.35;
    this.screenFlashColor = '#fef08a';
    this.screenFlashAlpha = 0.34;
    this.overflowAlert = false;
    this.overflowDangerMax = 0;

    const cx = this.width * 0.5;
    const cy = this.height * 0.42;

    this.particles.emitAllClearBurst(cx, cy);
    this.particles.addFloatingText(
      cx,
      cy - 12,
      `¡DESPEJE TOTAL! +${clearBonus}`,
      '#fef08a',
      22,
      1.15
    );
    this.particles.addFloatingText(
      cx,
      cy + 20,
      `+${sparkBonus} CHISPAS`,
      '#fbbf24',
      16,
      1.05
    );

    this.triggerShake(10, 0.22);
    this.spawnTimer = Math.min(this.spawnTimer, 0.75);
    soundEngine.playAllClear();
    hapticSuccess();
  }

  private collectOrb(orb: PowerOrb): void {
    if (orb.kind === 'mult2' || orb.kind === 'mult3') {
      const mult = orb.kind === 'mult3' ? 3 : 2;
      this.activeMultiplier = mult;
      this.multiplierTimeLeft = MULTIPLIER_DURATION_SEC;
      this.score += 75 * mult;

      this.particles.emitShapeExplosion(
        orb.x,
        orb.y,
        mult === 3 ? '#f43f5e' : '#facc15',
        '#ffffff',
        orb.radius,
        false
      );
      this.particles.addFloatingText(
        orb.x,
        orb.y - 18,
        `MULTIPLICADOR x${mult}!`,
        mult === 3 ? '#fda4af' : '#fef08a',
        18
      );
      soundEngine.playMultiplierPickup(mult);
      hapticSuccess();
      this.emitHud();
      return;
    }

    // Shockwave bomb: blasts every shape on screen (-3 HP)
    this.particles.emitShockwave(orb.x, orb.y, Math.max(this.width, this.height) * 0.72);
    this.particles.addFloatingText(orb.x, orb.y - 22, '¡ONDA EXPANSIVA!', '#38bdf8', 19);
    this.hitstopTimer = 0.035;
    this.triggerShake(11, 0.28);
    soundEngine.playShockwave();
    hapticHeavy();

    let destroyedByShockwave = false;
    let leveledUp = false;

    for (let i = this.shapes.length - 1; i >= 0; i -= 1) {
      const s = this.shapes[i];
      s.hp -= 3;
      s.hitFlash = 1;
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.comboTimer = COMBO_RESET_TIME;
      this.score += 20 * this.activeMultiplier;
      this.particles.emitHitSparks(s.x, s.y, '#38bdf8', 7);

      if (s.hp <= 0) {
        destroyedByShockwave = true;
        if (this.destroyShapeAt(i, true)) {
          leveledUp = true;
          break;
        }
      }
    }

    if (
      destroyedByShockwave &&
      !leveledUp &&
      this.elapsedTime > 5.0 &&
      this.shapes.length === 0
    ) {
      this.triggerAllClear();
    }

    this.emitHud();
  }

  private spawnProceduralWave(): void {
    const levelBoost = this.level - 1;
    const difficulty = Math.min(1, this.elapsedTime / 95 + levelBoost * 0.1);
    const minHp = 1 + Math.floor(this.elapsedTime / 28) + Math.floor(levelBoost * 0.75);
    const maxHp = Math.min(16, 2 + Math.floor(this.elapsedTime / 12) + levelBoost);

    // Prevent excessive crowding
    if (this.shapes.length < 16) {
      const count = difficulty > 0.42 ? (Math.random() < 0.65 ? 3 : 2) : 2;
      this.spawnWaveRow(this.safeTop - 36, count, minHp, maxHp);
    }

    const baseInterval = 2.85 - difficulty * 1.15;
    this.spawnTimer = Math.max(1.32, baseInterval + (Math.random() - 0.5) * 0.32);
  }

  private spawnWaveRow(y: number, count: number, minHp: number, maxHp: number): void {
    const padding = 44;
    const usableW = Math.max(120, this.width - padding * 2);
    const slotW = usableW / count;
    const kinds: ShapeKind[] = ['circle', 'triangle', 'hexagon'];

    for (let i = 0; i < count; i += 1) {
      const slotCenter = padding + slotW * (i + 0.5);
      const jitterX = (Math.random() - 0.5) * Math.min(28, slotW * 0.35);
      const x = Math.max(40, Math.min(this.width - 40, slotCenter + jitterX));
      const hp = minHp + Math.floor(Math.random() * (maxHp - minHp + 1));
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const palette = SHAPE_PALETTES[Math.floor(Math.random() * SHAPE_PALETTES.length)];
      const radius = 24 + Math.min(14, hp * 1.3);

      // Gentle lateral sway unlocks as levels or waves advance
      const enableSway = (this.level >= 2 || this.elapsedTime > 12) && Math.random() < 0.65;
      const swayAmp = enableSway ? 14 + Math.random() * 20 : 0;
      const levelSpeedBonus = Math.min(36, (this.level - 1) * 6.5);
      const fallSpeed =
        34 + Math.min(30, this.elapsedTime * 0.35) + levelSpeedBonus + Math.random() * 10;

      this.shapes.push({
        id: this.nextId++,
        kind,
        x,
        y: y + (Math.random() - 0.5) * 18,
        baseX: x,
        radius,
        hp,
        maxHp: hp,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 1.2,
        swayAmp,
        swayFreq: 1.4 + Math.random() * 1.1,
        swayPhase: Math.random() * Math.PI * 2,
        fallSpeed,
        strokeColor: palette.stroke,
        fillColor: palette.fill,
        glowColor: palette.glow,
        hitFlash: 0,
        squashTimer: 0,
        dangerRatio: 0,
      });
    }
  }

  private spawnEdgeOrb(): void {
    const side: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
    const x = side === 'left' ? 32 : this.width - 32;
    const y = this.safeTop - 30;

    const roll = Math.random();
    const kind: OrbKind = roll < 0.46 ? 'mult2' : roll < 0.78 ? 'mult3' : 'shockwave';

    this.orbs.push({
      id: this.nextId++,
      kind,
      x,
      y,
      radius: 19,
      pulsePhase: 0,
      fallSpeed: 64,
      side,
    });

    this.orbSpawnTimer = 8.5 + Math.random() * 3.5;
  }

  private triggerDefeat(reason: DefeatReason): void {
    this.defeatReason = reason;
    if (!this.revivedUsed) {
      this.phase = 'revive_offer';
      hapticWarning();
      this.emitHud();
      this.callbacks.onReviveOffer(this.buildSummary());
      return;
    }

    this.phase = 'gameover';
    soundEngine.playGameOver();
    hapticWarning();
    this.emitHud();
    this.callbacks.onGameOver(this.buildSummary());
  }

  private triggerShake(strength: number, duration: number): void {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  private buildSummary(): RunSummary {
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      shapesDestroyed: this.shapesDestroyed,
      runSparks: this.runSparks,
      durationSec: Math.round(this.elapsedTime),
      level: this.level,
      defeatReason: this.defeatReason,
    };
  }

  private emitHud(): void {
    this.callbacks.onHudUpdate({
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      runSparks: this.runSparks,
      shapesDestroyed: this.shapesDestroyed,
      level: this.level,
      levelKills: this.levelKills,
      levelTargetKills: this.levelTargetKills,
      overflowAlert: this.overflowAlert,
      activeMultiplier: this.activeMultiplier,
      multiplierTimeLeft: this.multiplierTimeLeft,
      multiplierMaxTime: MULTIPLIER_DURATION_SEC,
      isFever: this.combo >= 5,
      elapsedTime: this.elapsedTime,
      phase: this.phase,
    });
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();

    // Base zinc-950 backdrop
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, this.width, this.height);

    // Apply proportional screen shake
    if (this.shakeTimer > 0) {
      const intensity = this.shakeStrength * Math.min(1, this.shakeTimer / 0.14);
      const sx = (Math.random() - 0.5) * 2 * intensity;
      const sy = (Math.random() - 0.5) * 2 * intensity;
      ctx.translate(sx, sy);
    }

    this.renderBackdropGrid(ctx);
    this.renderDangerEdgesAndTouchZone(ctx);
    this.renderShapes(ctx);
    this.renderOrbs(ctx);
    this.particles.renderTrail(ctx, this.skin, this.combo >= 5, this.elapsedTime);
    this.renderMagnetBeam(ctx);
    this.renderSparkBall(ctx);
    this.particles.renderParticlesAndRings(ctx);
    this.particles.renderFloatingTexts(ctx);

    if (this.screenFlashAlpha > 0.005) {
      ctx.globalAlpha = this.screenFlashAlpha;
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(-16, -16, this.width + 32, this.height + 32);
    }

    ctx.restore();
  }

  private renderBackdropGrid(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const theme = this.getLevelTheme();

    // Subtle ambient level tint over zinc-950
    const ambientGrad = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.25,
      20,
      this.width * 0.5,
      this.height * 0.45,
      this.height * 0.85
    );
    ambientGrad.addColorStop(0, `rgba(${theme.tintRgb}, 0.085)`);
    ambientGrad.addColorStop(1, 'rgba(9, 9, 11, 0)');
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = `rgba(${theme.tintRgb}, 0.055)`;
    ctx.lineWidth = 1;

    const spacing = 48;
    const offsetY = (this.elapsedTime * 18) % spacing;

    for (let x = spacing; x < this.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    for (let y = offsetY; y < this.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Fever mode subtle glow
    if (this.combo >= 5) {
      const feverGrad = ctx.createRadialGradient(
        this.ball.x,
        this.ball.y,
        10,
        this.ball.x,
        this.ball.y,
        210
      );
      feverGrad.addColorStop(0, 'rgba(249, 115, 22, 0.14)');
      feverGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = feverGrad;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  private renderDangerEdgesAndTouchZone(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Subtle risk-reward side margin indicators
    const hasLeftOrb = this.orbs.some((o) => o.side === 'left');
    const hasRightOrb = this.orbs.some((o) => o.side === 'right');

    const leftAlpha = Math.max(hasLeftOrb ? 0.22 : 0.05, this.edgePulseLeft * 0.45);
    const rightAlpha = Math.max(hasRightOrb ? 0.22 : 0.05, this.edgePulseRight * 0.45);

    const leftGrad = ctx.createLinearGradient(0, 0, 22, 0);
    leftGrad.addColorStop(0, `rgba(244, 63, 94, ${leftAlpha})`);
    leftGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 22, this.height);

    const rightGrad = ctx.createLinearGradient(this.width, 0, this.width - 22, 0);
    rightGrad.addColorStop(0, `rgba(244, 63, 94, ${rightAlpha})`);
    rightGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(this.width - 22, 0, 22, this.height);

    // Overflow Laser Line (fixed in lower quarter, above thumb touch zone)
    const overflowY = this.getOverflowLineY();
    const pulseSpeed = this.overflowAlert ? 14 + this.overflowDangerMax * 8 : 3.6;
    const pulseWave = 0.5 + 0.5 * Math.sin(this.elapsedTime * pulseSpeed);
    const lineAlpha = this.overflowAlert ? 0.72 + pulseWave * 0.28 : 0.48 + pulseWave * 0.24;

    // Danger zone aura immediately above the laser line when alert is active
    if (this.overflowAlert) {
      const alertGrad = ctx.createLinearGradient(0, overflowY - 78, 0, overflowY);
      alertGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      alertGrad.addColorStop(
        1,
        `rgba(239, 68, 68, ${(0.14 + this.overflowDangerMax * 0.18) * (0.65 + pulseWave * 0.35)})`
      );
      ctx.fillStyle = alertGrad;
      ctx.fillRect(0, overflowY - 78, this.width, 78);
    }

    // Ergonomic one-touch zone below the Overflow Line (anti-occlusion)
    const zoneGrad = ctx.createLinearGradient(0, overflowY, 0, this.height);
    zoneGrad.addColorStop(0, 'rgba(34, 211, 238, 0.02)');
    zoneGrad.addColorStop(1, 'rgba(34, 211, 238, 0.085)');
    ctx.fillStyle = zoneGrad;
    ctx.fillRect(0, overflowY, this.width, this.height - overflowY);

    // Laser beam itself (amber/red glow)
    ctx.save();
    ctx.shadowBlur = this.overflowAlert ? 18 + pulseWave * 8 : 10;
    ctx.shadowColor = this.overflowAlert ? '#ef4444' : '#f59e0b';
    const laserGrad = ctx.createLinearGradient(0, overflowY, this.width, overflowY);
    laserGrad.addColorStop(0, `rgba(245, 158, 11, ${lineAlpha * 0.75})`);
    laserGrad.addColorStop(0.5, `rgba(239, 68, 68, ${lineAlpha})`);
    laserGrad.addColorStop(1, `rgba(245, 158, 11, ${lineAlpha * 0.75})`);
    ctx.strokeStyle = laserGrad;
    ctx.lineWidth = this.overflowAlert ? 2.8 : 2;
    ctx.beginPath();
    ctx.moveTo(10, overflowY);
    ctx.lineTo(this.width - 10, overflowY);
    ctx.stroke();

    // Inner bright core hairline
    ctx.strokeStyle = this.overflowAlert
      ? `rgba(254, 202, 202, ${0.65 + pulseWave * 0.35})`
      : 'rgba(253, 230, 138, 0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(12, overflowY);
    ctx.lineTo(this.width - 12, overflowY);
    ctx.stroke();
    ctx.restore();

    // Crisp laser label pill on right edge
    ctx.save();
    ctx.font = '800 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = this.overflowAlert
      ? `rgba(252, 165, 165, ${0.75 + pulseWave * 0.25})`
      : 'rgba(251, 191, 36, 0.55)';
    ctx.fillText(
      this.overflowAlert ? '¡ALERTA DE DESBORDE!' : 'LÍNEA DE DESBORDE',
      this.width - 14,
      overflowY - 5
    );
    ctx.restore();

    // Bottom abyss warning line
    const abyssGlow = ctx.createLinearGradient(0, this.height - 22, 0, this.height);
    abyssGlow.addColorStop(0, 'rgba(244, 63, 94, 0)');
    abyssGlow.addColorStop(1, 'rgba(244, 63, 94, 0.32)');
    ctx.fillStyle = abyssGlow;
    ctx.fillRect(0, this.height - 22, this.width, 22);

    if (this.touchHintAlpha > 0.02) {
      ctx.globalAlpha = this.touchHintAlpha * 0.65;
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '700 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        'TOCA LA ZONA INFERIOR PARA IMPULSARTE',
        this.width * 0.5,
        this.height - this.safeBottom - 26
      );
    }

    ctx.restore();
  }

  private renderShapes(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.shapes.length; i += 1) {
      const s = this.shapes[i];
      const scale = 1 + s.squashTimer * 0.14;
      const dangerBlink =
        s.dangerRatio > 0 &&
        Math.sin(this.elapsedTime * (12 + s.dangerRatio * 14)) > 0;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(scale, scale);

      ctx.save();
      ctx.rotate(s.rotation);
      ctx.shadowBlur = s.hitFlash > 0.1 ? 22 : dangerBlink ? 20 : 12;
      ctx.shadowColor =
        s.hitFlash > 0.1 ? '#ffffff' : dangerBlink ? '#ef4444' : s.glowColor;
      ctx.fillStyle =
        s.hitFlash > 0.1
          ? 'rgba(255, 255, 255, 0.35)'
          : dangerBlink
          ? 'rgba(239, 68, 68, 0.32)'
          : s.fillColor;
      ctx.strokeStyle =
        s.hitFlash > 0.1 ? '#ffffff' : dangerBlink ? '#ef4444' : s.strokeColor;
      ctx.lineWidth = dangerBlink ? 3.3 : 2.8;

      ctx.beginPath();
      if (s.kind === 'circle') {
        ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
      } else {
        const sides = s.kind === 'triangle' ? 3 : 6;
        for (let k = 0; k < sides; k += 1) {
          const angle = (Math.PI * 2 * k) / sides;
          const vx = Math.cos(angle) * s.radius;
          const vy = Math.sin(angle) * s.radius;
          if (k === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Upright crisp HP numeral
      ctx.fillStyle = dangerBlink ? '#fee2e2' : '#fafafa';
      ctx.font = `800 ${Math.round(Math.max(14, s.radius * 0.62))}px "JetBrains Mono", Inter, sans-serif`;
      ctx.fillText(String(s.hp), 0, 1);

      ctx.restore();
    }

    ctx.restore();
  }

  private renderOrbs(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.orbs.length; i += 1) {
      const orb = this.orbs[i];
      const pulse = 1 + Math.sin(orb.pulsePhase) * 0.1;
      const r = orb.radius * pulse;

      let primary = '#facc15';
      let label = 'x2';
      if (orb.kind === 'mult3') {
        primary = '#fb7185';
        label = 'x3';
      } else if (orb.kind === 'shockwave') {
        primary = '#38bdf8';
        label = 'ONDA';
      }

      ctx.save();
      ctx.translate(orb.x, orb.y);
      ctx.shadowBlur = 18;
      ctx.shadowColor = primary;
      ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2.6;

      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Outer dashed rotating halo
      ctx.rotate(this.elapsedTime * 2.4);
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.rotate(-this.elapsedTime * 2.4);

      ctx.fillStyle = primary;
      ctx.font = `800 ${orb.kind === 'shockwave' ? 9 : 13}px Inter, sans-serif`;
      ctx.fillText(label, 0, 0.5);
      ctx.restore();
    }

    ctx.restore();
  }

  private renderMagnetBeam(ctx: CanvasRenderingContext2D): void {
    if (
      this.ball.magnetBeamTimer <= 0 ||
      this.ball.magnetTargetX === null ||
      this.ball.magnetTargetY === null
    ) {
      return;
    }

    ctx.save();
    const alpha = Math.min(1, this.ball.magnetBeamTimer / 0.14);
    ctx.globalAlpha = alpha * 0.72;
    ctx.strokeStyle = this.skin.innerRingColor;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(this.ball.x, this.ball.y);
    ctx.lineTo(this.ball.magnetTargetX, this.ball.magnetTargetY);
    ctx.stroke();
    ctx.restore();
  }

  private renderSparkBall(ctx: CanvasRenderingContext2D): void {
    const b = this.ball;
    const isFever = this.combo >= 5;

    ctx.save();
    ctx.translate(b.x, b.y);

    // Temporary 2s shield aura after revive
    if (b.invulnTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.78)';
      ctx.fillStyle = 'rgba(74, 222, 128, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius + 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (Math.floor(b.invulnTimer * 14) % 2 === 0) {
        ctx.globalAlpha = 0.72;
      }
    }

    // Cooldown charge ring around the ball (0.35s)
    const chargeProgress = 1 - b.cooldownTimer / b.maxCooldown;
    const ringRadius = b.radius + 7;

    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      0,
      0,
      ringRadius,
      -Math.PI * 0.5,
      -Math.PI * 0.5 + Math.PI * 2 * Math.max(0.02, chargeProgress)
    );
    ctx.strokeStyle =
      chargeProgress >= 0.99
        ? isFever
          ? '#fb923c'
          : this.skin.innerRingColor
        : 'rgba(244, 244, 245, 0.7)';
    ctx.lineWidth = b.readyFlashTimer > 0 ? 3.5 : 2.4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Skin-specific outer geometry aura
    if (this.skin.id === 'purple_void') {
      ctx.save();
      ctx.rotate(this.elapsedTime * 3.5);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.radius + 4, b.radius - 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.skin.id === 'crimson_neon') {
      ctx.save();
      ctx.rotate(-this.elapsedTime * 4);
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      const d = b.radius + 3;
      ctx.strokeRect(-d * 0.7, -d * 0.7, d * 1.4, d * 1.4);
      ctx.restore();
    } else if (this.skin.id === 'founder_gold') {
      ctx.save();
      ctx.rotate(this.elapsedTime * 2.5);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      const s = b.radius + 5;
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(s, 0);
      ctx.moveTo(0, -s);
      ctx.lineTo(0, s);
      ctx.stroke();
      ctx.restore();
    }

    // Core sphere glow + gradient
    ctx.shadowBlur = isFever ? 26 : 18;
    ctx.shadowColor = isFever ? '#f97316' : this.skin.glowColor;

    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, b.radius);
    grad.addColorStop(0, this.skin.coreColor);
    grad.addColorStop(0.58, this.skin.innerRingColor);
    grad.addColorStop(1, isFever ? '#f97316' : this.skin.glowColor);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
    ctx.fill();

    // Bright center highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-b.radius * 0.25, -b.radius * 0.25, b.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
