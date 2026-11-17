import React, { useEffect, useRef, useState } from 'react';
import { Flame, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { GameEngine } from '../game/GameEngine';
import type { HudSnapshot, RunSummary } from '../game/types';
import { getSkinConfig, useStore } from '../services/monetization';

interface GameCanvasProps {
  engineRef: React.MutableRefObject<GameEngine | null>;
  onReviveOffer: (summary: RunSummary) => void;
  onGameOver: (summary: RunSummary) => void;
  soundMuted: boolean;
  onToggleSound: () => void;
}

const INITIAL_HUD: HudSnapshot = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  runSparks: 0,
  shapesDestroyed: 0,
  activeMultiplier: 1,
  multiplierTimeLeft: 0,
  multiplierMaxTime: 8,
  isFever: false,
  elapsedTime: 0,
  phase: 'playing',
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engineRef,
  onReviveOffer,
  onGameOver,
  soundMuted,
  onToggleSound,
}) => {
  const { equippedSkin, sparks, highScore } = useStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  const callbacksRef = useRef({ onReviveOffer, onGameOver });
  callbacksRef.current = { onReviveOffer, onGameOver };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const skinConfig = getSkinConfig(equippedSkin);
    const engine = new GameEngine(canvas, skinConfig, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onReviveOffer: (summary) => callbacksRef.current.onReviveOffer(summary),
      onGameOver: (summary) => callbacksRef.current.onGameOver(summary),
    });

    const syncInsetsAndSize = () => {
      const rect = container.getBoundingClientRect();
      const rootStyle = window.getComputedStyle(document.documentElement);
      const safeTop = parseFloat(rootStyle.getPropertyValue('--safe-top')) || 12;
      const safeBottom = parseFloat(rootStyle.getPropertyValue('--safe-bottom')) || 16;
      engine.setSafeInsets(safeTop, safeBottom);
      engine.resize(rect.width, rect.height);
    };

    syncInsetsAndSize();
    engineRef.current = engine;
    engine.start();

    const observer = new ResizeObserver(() => {
      syncInsetsAndSize();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      engine.dispose();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
    };
  }, [engineRef]);

  useEffect(() => {
    engineRef.current?.setSkin(getSkinConfig(equippedSkin));
  }, [equippedSkin, engineRef]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    engineRef.current?.handlePointerDown(e.clientX, e.clientY);
  };

  const displayBest = Math.max(highScore, hud.score);
  const totalDisplayedSparks = sparks + hud.runSparks;
  const multProgressPct =
    hud.activeMultiplier > 1
      ? Math.max(0, Math.min(100, (hud.multiplierTimeLeft / hud.multiplierMaxTime) * 100))
      : 0;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-zinc-950">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="block w-full h-full touch-none cursor-pointer"
      />

      {/* Minimalist Top HUD (non-blocking pointer-events except mute button) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 safe-pt px-4 flex items-start justify-between gap-2 z-10">
        {/* Score & Best */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase">
            Puntaje
          </span>
          <span className="font-mono text-3xl font-black leading-none tracking-tight text-white drop-shadow">
            {hud.score.toLocaleString('es-ES')}
          </span>
          <span className="mt-1 text-[11px] font-semibold text-zinc-400">
            RÉCORD <span className="font-mono text-zinc-200">{displayBest.toLocaleString('es-ES')}</span>
          </span>
        </div>

        {/* Center Dynamic Combo + Active Multiplier */}
        <div className="flex flex-col items-center pt-0.5">
          {hud.combo > 1 ? (
            <div
              className={`flex items-center gap-1 rounded-full px-3 py-1 border backdrop-blur-md transition-transform ${
                hud.isFever
                  ? 'bg-orange-500/20 border-orange-400/60 text-orange-300 shadow-[0_0_16px_rgba(249,115,22,0.45)] scale-105'
                  : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
              }`}
            >
              {hud.isFever ? (
                <Flame className="w-3.5 h-3.5 text-orange-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-cyan-300" />
              )}
              <span className="font-mono text-xs font-black tracking-wider">
                COMBO x{hud.combo}
              </span>
            </div>
          ) : (
            <div className="h-6" />
          )}

          {hud.activeMultiplier > 1 ? (
            <div className="mt-1.5 w-24 rounded-full bg-zinc-900/90 border border-amber-400/50 px-2 py-0.5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[10px] font-black text-amber-300">
                <span>ORBE x{hud.activeMultiplier}</span>
                <span className="font-mono">{hud.multiplierTimeLeft.toFixed(1)}s</span>
              </div>
              <div className="mt-0.5 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-75"
                  style={{ width: `${multProgressPct}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Sparks Wallet + Mute Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-xs font-extrabold text-amber-300">
              {totalDisplayedSparks.toLocaleString('es-ES')}
            </span>
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleSound}
            aria-label={soundMuted ? 'Activar sonido' : 'Silenciar sonido'}
            className="pointer-events-auto flex items-center justify-center w-9 h-9 rounded-full bg-zinc-900/85 border border-zinc-800 text-zinc-200 active:scale-95 transition"
          >
            {soundMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-300" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
