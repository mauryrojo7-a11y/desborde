import React from 'react';
import {
  Check,
  Crown,
  Film,
  Lock,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  IAP_PRODUCTS,
  SKINS_CATALOG,
  useStore,
} from '../services/monetization';

interface ShopModalProps {
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ onClose }) => {
  const {
    sparks,
    reviveTokens,
    noAdsUnlocked,
    ownedSkins,
    equippedSkin,
    isSandboxMode,
    buySkinWithSparks,
    equipSkin,
    grantSparks,
    requestIapPurchase,
    requestRewardedAd,
  } = useStore();

  const founderOwned = noAdsUnlocked && ownedSkins.includes('founder_gold');

  const handleWatchFreeSparksAd = async () => {
    const ok = await requestRewardedAd(
      'Recarga gratuita de Chispas',
      '+100 Chispas'
    );
    if (ok) {
      grantSparks(100);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-zinc-950/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 safe-pt pb-3 border-b border-zinc-800/80">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white">TIENDA</h2>
          <p className="text-[11px] font-semibold text-zinc-400">
            {isSandboxMode
              ? 'Modo Simulación (Sandbox) · Acreditación inmediata'
              : 'Google Play Billing Activo'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-xs font-black text-amber-300">
              {sparks.toLocaleString('es-ES')}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tienda"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Catalog */}
      <div className="flex-1 overflow-y-auto scroll-touch px-5 py-4 space-y-6 safe-pb">
        {/* Featured Founder's Pack */}
        <section>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-900 border border-amber-400/50 p-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-950">
                  <Crown className="w-3 h-3" />
                  Pack Fundador
                </div>
                <h3 className="mt-2 text-lg font-black text-white">
                  Sin Anuncios + Skin Oro + 1.500 Chispas
                </h3>
                <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                  Elimina anuncios para siempre, equipa la estela exclusiva{' '}
                  <span className="text-amber-300 font-bold">Oro Fundador</span> y recibe
                  1.500 Chispas al instante.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={founderOwned}
              onClick={() => requestIapPurchase('founder_pack')}
              className={`mt-4 w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-sm font-black transition active:scale-[0.98] ${
                founderOwned
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 cursor-default'
                  : 'bg-gradient-to-r from-amber-300 to-yellow-400 text-zinc-950 shadow-lg'
              }`}
            >
              {founderOwned ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>PACK FUNDADOR DESBLOQUEADO</span>
                </>
              ) : (
                <span>COMPRAR PACK FUNDADOR · USD 2.99</span>
              )}
            </button>
          </div>
        </section>

        {/* IAP Packs + Free Ad Sparks */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">
              Chispas y Tokens de Revivir
            </h3>
            <span className="text-[11px] font-bold text-emerald-400">
              Tokens: {reviveTokens}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handleWatchFreeSparksAd()}
            className="w-full flex items-center justify-between rounded-2xl bg-cyan-500/12 border border-cyan-400/40 px-4 py-3.5 active:scale-[0.98] transition"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-400/20 text-cyan-300">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-white">+100 Chispas Gratis</div>
                <div className="text-[11px] text-cyan-300 font-semibold">
                  {noAdsUnlocked ? 'Reclamo instantáneo (Sin Anuncios)' : 'Anuncio recompensado (3s)'}
                </div>
              </div>
            </div>
            <span className="rounded-xl bg-cyan-400 px-3 py-1.5 text-xs font-black text-zinc-950">
              GRATIS
            </span>
          </button>

          <div className="grid grid-cols-1 gap-2.5">
            {IAP_PRODUCTS.filter((p) => p.id !== 'founder_pack').map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-800 shrink-0">
                    {product.grantsRevives ? (
                      <Zap className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white truncate">
                        {product.title}
                      </span>
                      {product.badge ? (
                        <span className="rounded-md bg-rose-500/20 border border-rose-400/40 px-1.5 py-0.5 text-[9px] font-black text-rose-300">
                          {product.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">{product.subtitle}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => requestIapPurchase(product.id)}
                  className="shrink-0 rounded-xl bg-zinc-100 px-3.5 py-2 text-xs font-black text-zinc-950 active:scale-95 transition"
                >
                  {product.priceLabel}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Skins & Trails Catalog */}
        <section className="space-y-3 pb-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">
            Skins y Estelas ({ownedSkins.length}/{SKINS_CATALOG.length})
          </h3>

          <div className="space-y-2.5">
            {SKINS_CATALOG.map((skin) => {
              const owned = ownedSkins.includes(skin.id);
              const equipped = equippedSkin === skin.id;
              const canAfford = sparks >= skin.priceSparks;

              return (
                <div
                  key={skin.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition ${
                    equipped
                      ? 'bg-zinc-900 border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                      : 'bg-zinc-900/80 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-full shrink-0 border border-white/20 flex items-center justify-center"
                      style={{
                        background: `radial-gradient(circle at 35% 35%, ${skin.coreColor}, ${skin.innerRingColor} 60%, ${skin.glowColor})`,
                        boxShadow: `0 0 18px ${skin.glowColor}80`,
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-white/85" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{skin.name}</span>
                        <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                          {skin.trailEffectLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400 leading-snug">
                        {skin.description}
                      </p>
                    </div>
                  </div>

                  {equipped ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-cyan-400/20 border border-cyan-400/50 px-3 py-2 text-xs font-black text-cyan-300">
                      <Check className="w-3.5 h-3.5" />
                      Equipada
                    </span>
                  ) : owned ? (
                    <button
                      type="button"
                      onClick={() => equipSkin(skin.id)}
                      className="shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 px-3.5 py-2 text-xs font-black text-white active:scale-95 transition"
                    >
                      Equipar
                    </button>
                  ) : skin.exclusive ? (
                    <button
                      type="button"
                      onClick={() => requestIapPurchase('founder_pack')}
                      className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-amber-400/20 border border-amber-400/50 px-3 py-2 text-[11px] font-black text-amber-300 active:scale-95"
                    >
                      <Lock className="w-3 h-3" />
                      Pack Fundador
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => buySkinWithSparks(skin.id)}
                      className={`shrink-0 inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black transition active:scale-95 ${
                        canAfford
                          ? 'bg-amber-400 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{skin.priceSparks}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
