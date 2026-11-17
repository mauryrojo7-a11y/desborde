import React, { useEffect, useState } from 'react';
import {
  Film,
  Flame,
  Home,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import type { RunSummary } from '../game/types';
import { useStore } from '../services/monetization';

interface GameOverModalProps {
  phase: 'revive_offer' | 'gameover';
  summary: RunSummary;
  isNewHighScore: boolean;
  doubleSparksClaimed: boolean;
  onReviveWithToken: () => void;
  onReviveWithAd: () => void;
  onDeclineRevive: () => void;
  onDoubleSparksWithAd: () => void;
  onRetry: () => void;
  onOpenShop: () => void;
  onGoHome: () => void;
}

const REVIVE_COUNTDOWN_SEC = 3.0;

export const GameOverModal: React.FC<GameOverModalProps> = ({
  phase,
  summary,
  isNewHighScore,
  doubleSparksClaimed,
  onReviveWithToken,
  onReviveWithAd,
  onDeclineRevive,
  onDoubleSparksWithAd,
  onRetry,
  onOpenShop,
  onGoHome,
}) => {
  const { reviveTokens, noAdsUnlocked, pendingAd } = useStore();
  const [countdown, setCountdown] = useState(REVIVE_COUNTDOWN_SEC);

  useEffect(() => {
    if (phase === 'revive_offer') {
      setCountdown(REVIVE_COUNTDOWN_SEC);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'revive_offer') return;
    // Pause countdown while the simulated 3s rewarded ad is playing
    if (pendingAd !== null) return;

    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        const next = Math.max(0, prev - 0.05);
        if (next <= 0) {
          window.clearInterval(interval);
          window.setTimeout(() => onDeclineRevive(), 0);
        }
        return next;
      });
    }, 50);

    return () => window.clearInterval(interval);
  }, [phase, pendingAd, onDeclineRevive]);

  if (phase === 'revive_offer') {
    const pct = Math.max(0, Math.min(1, countdown / REVIVE_COUNTDOWN_SEC));
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeOffset = circumference * (1 - pct);

    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/85 backdrop-blur-md px-5">
        <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 text-center shadow-2xl">
          {/* 3-Second Countdown Ring */}
          <div className="relative mx-auto mb-4 w-24 h-24 flex items-center justify-center">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="7"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <span className="absolute font-mono text-2xl font-black text-white">
              {Math.ceil(countdown)}
            </span>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            {summary.defeatReason === 'overflow'
              ? '¡DESBORDE DETECTADO!'
              : '¿SEGUIR EN CADENA?'}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {summary.defeatReason === 'overflow'
              ? 'Una figura cruzó la línea láser'
              : 'Caída al vacío'}{' '}
            · Nv. <span className="font-mono font-bold text-cyan-300">{summary.level}</span> ·{' '}
            <span className="font-mono font-bold text-zinc-200">
              {summary.score.toLocaleString('es-ES')}
            </span>{' '}
            pts
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              disabled={reviveTokens <= 0}
              onClick={onReviveWithToken}
              className={`w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 px-4 font-black text-base transition active:scale-[0.98] ${
                reviveTokens > 0
                  ? 'bg-emerald-400 text-zinc-950 shadow-[0_0_24px_rgba(52,211,153,0.4)]'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <Zap className="w-5 h-5 fill-current" />
              <span>
                {reviveTokens > 0
                  ? `REVIVIR CON TOKEN (${reviveTokens} disp.)`
                  : 'SIN TOKENS DE REVIVIR'}
              </span>
            </button>

            <button
              type="button"
              onClick={onReviveWithAd}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 py-4 px-4 font-black text-base text-zinc-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] active:scale-[0.98] transition"
            >
              <Film className="w-5 h-5" />
              <span>
                {noAdsUnlocked
                  ? 'REVIVIR GRATIS (SIN ANUNCIOS)'
                  : 'REVIVIR · ANUNCIO GRATIS (3s)'}
              </span>
            </button>

            <button
              type="button"
              onClick={onDeclineRevive}
              className="mt-1 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-200"
            >
              Omitir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/88 backdrop-blur-md px-5">
      <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-6 text-center shadow-2xl">
        {isNewHighScore ? (
          <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/50 px-3 py-1 text-[11px] font-black tracking-wider text-amber-300 uppercase">
            <Trophy className="w-3.5 h-3.5" />
            ¡Nuevo Récord!
          </div>
        ) : null}

        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">
          {summary.defeatReason === 'overflow'
            ? `Desborde · Nivel ${summary.level}`
            : `Partida Terminada · Nivel ${summary.level}`}
        </h2>
        <div className="mt-1 font-mono text-5xl font-black tracking-tight text-white">
          {summary.score.toLocaleString('es-ES')}
        </div>

        {/* Run Stats Grid */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-3">
            <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <div className="font-mono text-base font-black text-white">
              x{summary.maxCombo}
            </div>
            <div className="text-[10px] font-bold uppercase text-zinc-400">Combo Máx</div>
          </div>

          <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-3">
            <Sparkles className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <div className="font-mono text-base font-black text-amber-300">
              +{summary.runSparks}
            </div>
            <div className="text-[10px] font-bold uppercase text-zinc-400">Chispas</div>
          </div>

          <div className="rounded-2xl bg-zinc-950/70 border border-zinc-800 p-3">
            <Zap className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <div className="font-mono text-base font-black text-white">
              {summary.shapesDestroyed}
            </div>
            <div className="text-[10px] font-bold uppercase text-zinc-400">Figuras</div>
          </div>
        </div>

        {/* Rewarded Ad 2x Sparks Bonus */}
        {summary.runSparks > 0 && !doubleSparksClaimed ? (
          <button
            type="button"
            onClick={onDoubleSparksWithAd}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-400/15 border border-amber-400/50 py-3 px-4 text-xs font-black text-amber-300 active:scale-[0.98] transition"
          >
            <Film className="w-4 h-4" />
            <span>
              {noAdsUnlocked
                ? `RECLAMAR x2 CHISPAS (+${summary.runSparks})`
                : `DUPLICAR CHISPAS (+${summary.runSparks}) · ANUNCIO 3s`}
            </span>
          </button>
        ) : null}

        {/* Giant Zero-Friction Instant Retry Button */}
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 py-4 px-6 text-xl font-black text-zinc-950 shadow-[0_0_32px_rgba(34,211,238,0.4)] active:scale-[0.97] transition"
        >
          <RotateCcw className="w-6 h-6 stroke-[2.6]" />
          <span>REINTENTAR</span>
        </button>

        {/* Secondary Navigation */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenShop}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800/80 border border-zinc-700/70 py-3 text-xs font-extrabold text-zinc-200 active:scale-95 transition"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Tienda</span>
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800/80 border border-zinc-700/70 py-3 text-xs font-extrabold text-zinc-200 active:scale-95 transition"
          >
            <Home className="w-4 h-4 text-zinc-300" />
            <span>Menú</span>
          </button>
        </div>
      </div>
    </div>
  );
};
