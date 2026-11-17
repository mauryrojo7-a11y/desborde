import type { SkinConfig, SkinId } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  shape: 'circle' | 'diamond' | 'star' | 'flame';
  rotation: number;
  rotSpeed: number;
}

interface ShockRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  lineWidth: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private rings: ShockRing[] = [];
  private trail: TrailPoint[] = [];
  private texts: FloatingText[] = [];
  private trailSpawnAccumulator = 0;

  public clear(): void {
    this.particles.length = 0;
    this.rings.length = 0;
    this.trail.length = 0;
    this.texts.length = 0;
    this.trailSpawnAccumulator = 0;
  }

  public emitHitSparks(x: number, y: number, color: string, count = 8): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 210;
      const life = 0.22 + Math.random() * 0.18;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2.5,
        alpha: 1,
        life,
        maxLife: life,
        color,
        shape: 'circle',
        rotation: angle,
        rotSpeed: 0,
      });
    }
  }

  public emitShapeExplosion(
    x: number,
    y: number,
    color: string,
    secondaryColor: string,
    radius: number,
    isHeavy: boolean
  ): void {
    const count = isHeavy ? 28 : 18;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const speed = (isHeavy ? 150 : 110) + Math.random() * 260;
      const life = 0.34 + Math.random() * 0.26;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2.5 + Math.random() * 3.8,
        alpha: 1,
        life,
        maxLife: life,
        color: i % 3 === 0 ? '#ffffff' : i % 2 === 0 ? color : secondaryColor,
        shape: i % 2 === 0 ? 'diamond' : 'circle',
        rotation: angle,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }

    this.rings.push({
      x,
      y,
      radius: radius * 0.55,
      maxRadius: radius * (isHeavy ? 3.2 : 2.5),
      life: 0.32,
      maxLife: 0.32,
      color,
      lineWidth: isHeavy ? 4 : 3,
    });
  }

  public emitShockwave(x: number, y: number, maxRadius: number): void {
    this.rings.push({
      x,
      y,
      radius: 16,
      maxRadius,
      life: 0.45,
      maxLife: 0.45,
      color: '#38bdf8',
      lineWidth: 6,
    });
    this.rings.push({
      x,
      y,
      radius: 8,
      maxRadius: maxRadius * 0.78,
      life: 0.36,
      maxLife: 0.36,
      color: '#e0f2fe',
      lineWidth: 3,
    });
    this.emitShapeExplosion(x, y, '#38bdf8', '#facc15', 38, true);
  }

  public emitImpulseBurst(x: number, y: number, skin: SkinConfig, assisted: boolean): void {
    this.rings.push({
      x,
      y,
      radius: 10,
      maxRadius: assisted ? 54 : 42,
      life: 0.22,
      maxLife: 0.22,
      color: assisted ? '#fef08a' : skin.trailColor,
      lineWidth: 2.5,
    });

    const count = assisted ? 10 : 7;
    for (let i = 0; i < count; i += 1) {
      const spread = (Math.random() - 0.5) * 1.4;
      const angle = Math.PI * 0.5 + spread;
      const speed = 80 + Math.random() * 140;
      const life = 0.2 + Math.random() * 0.14;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 2,
        alpha: 0.9,
        life,
        maxLife: life,
        color: i % 2 === 0 ? skin.trailColor : skin.secondaryTrailColor,
        shape: skin.id === 'founder_gold' ? 'star' : 'circle',
        rotation: Math.random() * Math.PI,
        rotSpeed: 4,
      });
    }
  }

  public addTrailSample(
    x: number,
    y: number,
    ballRadius: number,
    skin: SkinConfig,
    isFever: boolean,
    dt: number
  ): void {
    this.trail.push({
      x,
      y,
      life: isFever ? 0.28 : 0.2,
      maxLife: isFever ? 0.28 : 0.2,
      radius: ballRadius * (isFever ? 1.05 : 0.88),
    });
    if (this.trail.length > 26) {
      this.trail.shift();
    }

    this.trailSpawnAccumulator += dt;
    const spawnInterval = isFever ? 0.016 : 0.036;

    while (this.trailSpawnAccumulator >= spawnInterval) {
      this.trailSpawnAccumulator -= spawnInterval;

      if (isFever) {
        // Dynamic neon fire particles when combo >= 5
        const life = 0.26 + Math.random() * 0.2;
        this.particles.push({
          x: x + (Math.random() - 0.5) * ballRadius * 1.1,
          y: y + (Math.random() - 0.5) * ballRadius * 0.8,
          vx: (Math.random() - 0.5) * 48,
          vy: -40 - Math.random() * 75,
          radius: 3.5 + Math.random() * 4.5,
          alpha: 0.9,
          life,
          maxLife: life,
          color: Math.random() < 0.45 ? '#fde047' : Math.random() < 0.7 ? '#f97316' : '#ef4444',
          shape: 'flame',
          rotation: Math.random() * Math.PI,
          rotSpeed: 2,
        });
      }

      this.emitSkinAmbientParticle(x, y, ballRadius, skin);
    }
  }

  private emitSkinAmbientParticle(
    x: number,
    y: number,
    ballRadius: number,
    skin: SkinConfig
  ): void {
    const id: SkinId = skin.id;
    const life = 0.24 + Math.random() * 0.12;
    const offsetX = (Math.random() - 0.5) * ballRadius * 1.1;
    const offsetY = (Math.random() - 0.5) * ballRadius * 1.1;

    if (id === 'founder_gold') {
      this.particles.push({
        x: x + offsetX,
        y: y + offsetY,
        vx: (Math.random() - 0.5) * 35,
        vy: (Math.random() - 0.5) * 35,
        radius: 3.2 + Math.random() * 2.4,
        alpha: 0.95,
        life: life + 0.08,
        maxLife: life + 0.08,
        color: Math.random() < 0.5 ? '#fef08a' : '#fbbf24',
        shape: 'star',
        rotation: Math.random() * Math.PI,
        rotSpeed: 5,
      });
      return;
    }

    if (id === 'crimson_neon') {
      this.particles.push({
        x: x + offsetX,
        y: y + offsetY,
        vx: (Math.random() - 0.5) * 55,
        vy: 25 + Math.random() * 40,
        radius: 2.6 + Math.random() * 2,
        alpha: 0.85,
        life,
        maxLife: life,
        color: Math.random() < 0.5 ? '#fb7185' : '#f43f5e',
        shape: 'diamond',
        rotation: Math.random() * Math.PI,
        rotSpeed: 7,
      });
      return;
    }

    this.particles.push({
      x: x + offsetX,
      y: y + offsetY,
      vx: (Math.random() - 0.5) * 32,
      vy: (Math.random() - 0.5) * 32,
      radius: 1.8 + Math.random() * 2,
      alpha: 0.78,
      life,
      maxLife: life,
      color: Math.random() < 0.5 ? skin.trailColor : skin.secondaryTrailColor,
      shape: 'circle',
      rotation: 0,
      rotSpeed: 0,
    });
  }

  public addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    size = 16
  ): void {
    this.texts.push({
      x,
      y,
      vy: -56,
      text,
      color,
      size,
      life: 0.72,
      maxLife: 0.72,
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 2.5);
      p.vy *= 1 - Math.min(1, dt * 2.5);
      p.rotation += p.rotSpeed * dt;
    }

    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
      }
    }

    for (let i = this.trail.length - 1; i >= 0; i -= 1) {
      const t = this.trail[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.trail.splice(i, 1);
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const ft = this.texts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.vy *= 1 - Math.min(1, dt * 2.2);
    }
  }

  public renderTrail(
    ctx: CanvasRenderingContext2D,
    skin: SkinConfig,
    isFever: boolean,
    elapsed: number
  ): void {
    if (this.trail.length < 2) return;

    ctx.save();
    for (let i = 0; i < this.trail.length - 1; i += 1) {
      const curr = this.trail[i];
      const next = this.trail[i + 1];
      const progress = Math.max(0, curr.life / curr.maxLife);

      ctx.beginPath();
      ctx.moveTo(curr.x, curr.y);
      ctx.lineTo(next.x, next.y);
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, curr.radius * 1.45 * progress);
      ctx.globalAlpha = progress * (isFever ? 0.65 : 0.45);
      ctx.strokeStyle = isFever ? '#f97316' : skin.trailColor;
      ctx.stroke();

      // Secondary electric/energy wave for Cyan Plasma and Purple Void
      if (skin.id === 'cyan_plasma' || skin.id === 'purple_void') {
        const wave = Math.sin(elapsed * 22 + i * 0.9) * 5 * progress;
        ctx.beginPath();
        ctx.moveTo(curr.x + wave, curr.y);
        ctx.lineTo(next.x - wave, next.y);
        ctx.lineWidth = Math.max(1.5, curr.radius * 0.45 * progress);
        ctx.globalAlpha = progress * 0.65;
        ctx.strokeStyle = skin.secondaryTrailColor;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  public renderParticlesAndRings(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (let i = 0; i < this.rings.length; i += 1) {
      const r = this.rings[i];
      const t = 1 - r.life / r.maxLife;
      const eased = 1 - Math.pow(1 - t, 3);
      const radius = r.radius + (r.maxRadius - r.radius) * eased;

      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth * (1 - t * 0.65);
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      const ratio = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = p.alpha * ratio;
      ctx.fillStyle = p.color;

      if (p.shape === 'circle' || p.shape === 'flame') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.8, p.radius * ratio), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'diamond') {
        const s = Math.max(1.2, p.radius * ratio * 1.25);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.72, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.72, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // 4-point star sparkle for Founder Gold
        const s = Math.max(1.5, p.radius * ratio * 1.35);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.28, -s * 0.28);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.28, s * 0.28);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.28, s * 0.28);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.28, -s * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  public renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    if (this.texts.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.texts.length; i += 1) {
      const ft = this.texts[i];
      const ratio = Math.max(0, ft.life / ft.maxLife);
      const scale = ratio > 0.78 ? 1 + (1 - ratio) * 1.1 : 1;

      ctx.save();
      ctx.translate(ft.x, ft.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(1, ratio * 1.45);
      ctx.font = `800 ${ft.size}px Inter, system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(9, 9, 11, 0.9)';
      ctx.strokeText(ft.text, 0, 0);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }
}
