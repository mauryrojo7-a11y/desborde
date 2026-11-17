import React from 'react';
import { CheckCircle2, Sparkles, Target, X } from 'lucide-react';
import { useStore } from '../services/monetization';

interface DailyMissionsModalProps {
  onClose: () => void;
}

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({ onClose }) => {
  const { dailyMissions, sparks, claimDailyMission } = useStore();

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/90 backdrop-blur-md px-5">
      <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30">
              <Target className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-none">
                MISIONES DIARIAS
              </h2>
              <span className="text-[11px] font-semibold text-zinc-400">
                Recompensas en Chispas · Hoy
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar misiones"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-300 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {dailyMissions.missions.map((mission) => {
            const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
            const completed = mission.progress >= mission.target;

            return (
              <div
                key={mission.id}
                className={`rounded-2xl border p-3.5 ${
                  mission.claimed
                    ? 'bg-zinc-950/50 border-zinc-800/70 opacity-75'
                    : completed
                    ? 'bg-emerald-500/10 border-emerald-400/40'
                    : 'bg-zinc-950/80 border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-white">{mission.title}</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{mission.description}</p>
                  </div>

                  <div className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-400/35 px-2.5 py-1 text-[11px] font-black text-amber-300">
                    <Sparkles className="w-3 h-3" />
                    +{mission.rewardSparks}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 mb-1">
                      <span>Progreso</span>
                      <span className="font-mono text-zinc-200">
                        {mission.progress}/{mission.target}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          completed ? 'bg-emerald-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {mission.claimed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Lista
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!completed}
                      onClick={() => claimDailyMission(mission.id)}
                      className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition active:scale-95 ${
                        completed
                          ? 'bg-emerald-400 text-zinc-950 shadow-[0_0_14px_rgba(52,211,153,0.4)]'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      Reclamar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-zinc-400 font-semibold">Tu billetera actual</span>
          <span className="inline-flex items-center gap-1 font-mono font-black text-amber-300">
            <Sparkles className="w-3.5 h-3.5" />
            {sparks.toLocaleString('es-ES')} Chispas
          </span>
        </div>
      </div>
    </div>
  );
};
