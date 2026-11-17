import React, { useEffect, useState } from 'react';
import { Check, Film, ShieldCheck, ShoppingBag, X } from 'lucide-react';
import { useStore } from '../services/monetization';

const AD_DURATION_SEC = 3.0;

export const SandboxOverlays: React.FC = () => {
  const {
    pendingPurchase,
    confirmPendingPurchase,
    cancelPendingPurchase,
    pendingAd,
    completePendingAd,
    cancelPendingAd,
  } = useStore();

  const [processingPurchase, setProcessingPurchase] = useState(false);
  const [adRemaining, setAdRemaining] = useState(AD_DURATION_SEC);

  useEffect(() => {
    setProcessingPurchase(false);
  }, [pendingPurchase]);

  useEffect(() => {
    if (!pendingAd) return;
    setAdRemaining(AD_DURATION_SEC);

    const interval = window.setInterval(() => {
      setAdRemaining((prev) => {
        const next = Math.max(0, prev - 0.05);
        if (next <= 0) {
          window.clearInterval(interval);
        }
        return next;
      });
    }, 50);

    return () => window.clearInterval(interval);
  }, [pendingAd]);

  const handleConfirmPurchase = () => {
    if (processingPurchase) return;
    setProcessingPurchase(true);
    window.setTimeout(() => {
      setProcessingPurchase(false);
      confirmPendingPurchase();
    }, 350);
  };

  if (pendingPurchase) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-zinc-700 p-5 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              Google Play Sandbox
            </div>
            <button
              type="button"
              onClick={cancelPendingPurchase}
              className="text-zinc-400 hover:text-white"
              aria-label="Cancelar compra"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/40 shrink-0">
              <ShoppingBag className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">{pendingPurchase.title}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{pendingPurchase.subtitle}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm">
            <span className="text-zinc-400 font-semibold">Total simulado</span>
            <span className="font-mono font-black text-white">
              {pendingPurchase.priceLabel}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={processingPurchase}
              onClick={cancelPendingPurchase}
              className="rounded-2xl bg-zinc-800 py-3 text-xs font-extrabold text-zinc-300 active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={processingPurchase}
              onClick={handleConfirmPurchase}
              className="rounded-2xl bg-emerald-400 py-3 text-xs font-black text-zinc-950 active:scale-95 transition"
            >
              {processingPurchase ? 'Validando...' : 'Confirmar (1-Tap)'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pendingAd) {
    const progress = Math.min(100, ((AD_DURATION_SEC - adRemaining) / AD_DURATION_SEC) * 100);
    const finished = adRemaining <= 0.01;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-md p-5">
        <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-cyan-400/40 p-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-400/15 border border-cyan-400/40">
            <Film className="w-7 h-7 text-cyan-300" />
          </div>

          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">
            Anuncio Recompensado · Sandbox
          </span>
          <h3 className="mt-1.5 text-lg font-black text-white">{pendingAd.reason}</h3>
          <p className="mt-1 text-xs text-zinc-400">
            Recompensa:{' '}
            <span className="font-bold text-amber-300">{pendingAd.rewardLabel}</span>
          </p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-300 mb-1.5">
              <span>{finished ? 'Recompensa lista' : 'Reproduciendo patrocinio...'}</span>
              <span className="font-mono">
                {finished ? '0.0s' : `${adRemaining.toFixed(1)}s`}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              disabled={!finished}
              onClick={completePendingAd}
              className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black transition ${
                finished
                  ? 'bg-emerald-400 text-zinc-950 shadow-[0_0_24px_rgba(52,211,153,0.45)] active:scale-95'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>
                {finished
                  ? `RECLAMAR ${pendingAd.rewardLabel}`
                  : `Espera ${Math.ceil(adRemaining)}s...`}
              </span>
            </button>

            {!finished ? (
              <button
                type="button"
                onClick={cancelPendingAd}
                className="py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-300"
              >
                Cerrar sin recompensa
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
