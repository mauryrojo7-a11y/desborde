import React from 'react';
import {
  Play,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Vibrate,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { getSkinConfig, useStore } from '../services/monetization';

interface MainMenuProps {
  onPlay: () => void;
  onOpenShop: () => void;
  onOpenMissions: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
  vibrationEnabled: boolean;
  onToggleVibration: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlay,
  onOpenShop,
  onOpenMissions,
  soundMuted,
  onToggleSound,
  vibrationEnabled,
  onToggleVibration,
}) => {
  const {
    sparks,
    reviveTokens,
    highScore,
    equippedSkin,
    noAdsUnlocked,
    claimableMissionsCount,
  } = useStore();

  const skin = getSkinConfig(equippedSkin);

  return (
    <div className="relative flex flex-col justify-between w-full h-full bg-zinc-950 overflow-hidden px-5 safe-pt safe-pb">
      {/* Ambient Neon Radial Glows */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl opacity-25"
        style={{ background: `radial-gradient(circle, ${skin.glowColor}, transparent 70%)` }}
      />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl" />

      {/* Top Bar: Wallet & Audio/Haptics */}
      <header className="relative z-10 flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 px-3 py-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="font-mono text-sm font-black text-amber-300">
              {sparks.toLocaleString('es-ES')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 px-3 py-1.5">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-sm font-black text-emerald-300">
              {reviveTokens}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleVibration}
            aria-label={vibrationEnabled ? 'Desactivar vibración' : 'Activar vibración'}
            className={`flex items-center justify-center w-10 h-10 rounded-full border transition active:scale-95 ${
              vibrationEnabled
                ? 'bg-zinc-900 border-zinc-700 text-cyan-300'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
            }`}
          >
            <Vibrate className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundMuted ? 'Activar sonido' : 'Silenciar sonido'}
            className={`flex items-center justify-center w-10 h-10 rounded-full border transition active:scale-95 ${
              !soundMuted
                ? 'bg-zinc-900 border-zinc-700 text-cyan-300'
                : 'bg-zinc-900/60 border-zinc-800 text-rose-400'
            }`}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Center Hero: Minimalist Logo + Equipped Spark + Play CTA */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center my-auto py-4">
        {noAdsUnlocked ? (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 px-3 py-1 text-[11px] font-extrabold tracking-wider text-amber-300 uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            Fundador · Sin Anuncios
          </div>
        ) : null}

        <div className="relative mb-5 flex items-center justify-center">
          <div
            className="w-20 h-20 rounded-full animate-float-slow flex items-center justify-center border border-white/15"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${skin.coreColor}, ${skin.innerRingColor} 58%, ${skin.glowColor})`,
              boxShadow: `0 0 42px ${skin.glowColor}88`,
            }}
          >
            <div className="w-5 h-5 rounded-full bg-white/90 blur-[1px]" />
          </div>
        </div>

        <h1 className="text-5xl font-black tracking-tighter text-white drop-shadow-[0_0_24px_rgba(34,211,238,0.28)]">
          DESBORDE
        </h1>
        <p className="mt-1.5 text-xs font-bold tracking-[0.34em] text-cyan-400 uppercase">
          Chain Reaction
        </p>

        {/* High Score & Equipped Skin Chip */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 pr-3 border-r border-zinc-800">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Récord
              </div>
              <div className="font-mono text-sm font-black text-white">
                {highScore.toLocaleString('es-ES')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenShop}
            className="flex items-center gap-2 text-left active:opacity-80"
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/40"
              style={{
                backgroundColor: skin.innerRingColor,
                boxShadow: `0 0 10px ${skin.glowColor}`,
              }}
            />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Skin Activa
              </div>
              <div className="text-xs font-extrabold text-zinc-100">{skin.name}</div>
            </div>
          </button>
        </div>

        {/* Giant Central Play Button */}
        <button
          type="button"
          onClick={onPlay}
          className="mt-8 w-full max-w-[290px] group relative flex items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 py-5 px-8 text-zinc-950 font-black text-2xl tracking-wide shadow-[0_0_40px_rgba(34,211,238,0.4)] active:scale-[0.97] transition"
        >
          <Play className="w-7 h-7 fill-zinc-950" />
          <span>JUGAR</span>
        </button>

        <p className="mt-3 text-xs text-zinc-500 font-medium">
          Control One-Touch · Impulso magnético anti-oclusión
        </p>
      </main>

      {/* Bottom Action Bar: Shop & Daily Missions */}
      <footer className="relative z-10 grid grid-cols-2 gap-3 pb-1">
        <button
          type="button"
          onClick={onOpenShop}
          className="relative flex items-center justify-center gap-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 py-4 px-4 text-sm font-extrabold text-zinc-100 active:scale-[0.98] transition hover:border-zinc-700"
        >
          <ShoppingBag className="w-5 h-5 text-amber-400" />
          <span>Tienda / Skins</span>
          {!noAdsUnlocked ? (
            <span className="absolute -top-2 right-3 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-zinc-950 shadow">
              OFERTA
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={onOpenMissions}
          className="relative flex items-center justify-center gap-2.5 rounded-2xl bg-zinc-900 border border-zinc-800 py-4 px-4 text-sm font-extrabold text-zinc-100 active:scale-[0.98] transition hover:border-zinc-700"
        >
          <Target className="w-5 h-5 text-cyan-400" />
          <span>Misiones</span>
          {claimableMissionsCount > 0 ? (
            <span className="absolute -top-2 right-3 flex items-center justify-center min-w-[20px] h-5 rounded-full bg-emerald-400 px-1.5 text-[11px] font-black text-zinc-950 shadow">
              {claimableMissionsCount}
            </span>
          ) : null}
        </button>
      </footer>
    </div>
  );
};
