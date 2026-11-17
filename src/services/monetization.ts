import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RunSummary, SkinConfig, SkinId } from '../game/types';
import { soundEngine } from '../game/SoundEngine';
import { hapticSuccess, hapticWarning, isNativePlatform } from './nativeBridge';

const STORE_STORAGE_KEY = 'desborde_store_v1';

// Optional build-time public configuration (never hardcode private secrets here)
const REVENUECAT_PUBLIC_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY ?? '';
const ADMOB_REWARDED_ID = import.meta.env.VITE_ADMOB_REWARDED_ID ?? '';

export const SKINS_CATALOG: readonly SkinConfig[] = [
  {
    id: 'solar_spark',
    name: 'Chispa Solar',
    description: 'Núcleo incandescente original con estela ámbar reactiva.',
    trailEffectLabel: 'Estela Solar Ámbar',
    priceSparks: 0,
    coreColor: '#fef9c3',
    innerRingColor: '#facc15',
    glowColor: '#f59e0b',
    trailColor: '#fbbf24',
    secondaryTrailColor: '#f97316',
  },
  {
    id: 'cyan_plasma',
    name: 'Plasma Cian',
    description: 'Descarga eléctrica de alto voltaje con doble arco de plasma.',
    trailEffectLabel: 'Arco Eléctrico Cian',
    priceSparks: 400,
    coreColor: '#ecfeff',
    innerRingColor: '#22d3ee',
    glowColor: '#06b6d4',
    trailColor: '#22d3ee',
    secondaryTrailColor: '#3b82f6',
  },
  {
    id: 'crimson_neon',
    name: 'Neón Carmesí',
    description: 'Pulso láser hiper-reactivo con fragmentos romboidales.',
    trailEffectLabel: 'Estela Láser Carmesí',
    priceSparks: 750,
    coreColor: '#fff1f2',
    innerRingColor: '#fb7185',
    glowColor: '#f43f5e',
    trailColor: '#f43f5e',
    secondaryTrailColor: '#e11d48',
  },
  {
    id: 'purple_void',
    name: 'Vacío Púrpura',
    description: 'Singularidad gravitacional rodeada de anillos orbitales.',
    trailEffectLabel: 'Órbita Gravitacional',
    priceSparks: 1200,
    coreColor: '#1e1b4b',
    innerRingColor: '#d8b4fe',
    glowColor: '#9333ea',
    trailColor: '#a855f7',
    secondaryTrailColor: '#6366f1',
  },
  {
    id: 'founder_gold',
    name: 'Oro Fundador',
    description: 'Edición exclusiva con núcleo diamante y destellos estelares.',
    trailEffectLabel: 'Oro Líquido + Destellos',
    priceSparks: 0,
    exclusive: true,
    exclusiveLabel: 'Pack Fundador',
    coreColor: '#fffbeb',
    innerRingColor: '#fde047',
    glowColor: '#eab308',
    trailColor: '#fbbf24',
    secondaryTrailColor: '#fef08a',
  },
] as const;

export function getSkinConfig(skinId: SkinId): SkinConfig {
  return SKINS_CATALOG.find((skin) => skin.id === skinId) ?? SKINS_CATALOG[0];
}

export type IapProductId = 'founder_pack' | 'sparks_500' | 'sparks_2500' | 'revive_5';

export interface IapProduct {
  id: IapProductId;
  title: string;
  subtitle: string;
  priceLabel: string;
  badge?: string;
  grantsSparks?: number;
  grantsRevives?: number;
  grantsNoAds?: boolean;
  grantsSkin?: SkinId;
}

export const IAP_PRODUCTS: readonly IapProduct[] = [
  {
    id: 'founder_pack',
    title: 'Pack Fundador',
    subtitle: 'Sin Anuncios + Skin Oro Fundador + 1.500 Chispas',
    priceLabel: 'USD 2.99',
    badge: 'EXCLUSIVO',
    grantsSparks: 1500,
    grantsNoAds: true,
    grantsSkin: 'founder_gold',
  },
  {
    id: 'sparks_500',
    title: '500 Chispas',
    subtitle: 'Impulso rápido para desbloquear tu primera skin.',
    priceLabel: 'USD 0.99',
    grantsSparks: 500,
  },
  {
    id: 'sparks_2500',
    title: '2.500 Chispas',
    subtitle: 'Reserva masiva de Chispas (+25% valor extra).',
    priceLabel: 'USD 2.99',
    badge: 'POPULAR',
    grantsSparks: 2500,
  },
  {
    id: 'revive_5',
    title: 'Pack 5 Tokens de Revivir',
    subtitle: 'Vuelve al instante en tus mejores partidas récord.',
    priceLabel: 'USD 0.99',
    grantsRevives: 5,
  },
] as const;

export type DailyMissionId = 'destroy_25' | 'combo_10' | 'score_1500';

export interface DailyMission {
  id: DailyMissionId;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardSparks: number;
  claimed: boolean;
}

interface DailyMissionsState {
  dateKey: string;
  missions: DailyMission[];
}

export interface PlayerWalletState {
  sparks: number;
  reviveTokens: number;
  noAdsUnlocked: boolean;
  ownedSkins: SkinId[];
  equippedSkin: SkinId;
  highScore: number;
  dailyMissions: DailyMissionsState;
}

function getLocalDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createFreshDailyMissions(dateKey: string): DailyMissionsState {
  return {
    dateKey,
    missions: [
      {
        id: 'destroy_25',
        title: 'Demolición Neón',
        description: 'Destruye 25 figuras geométricas hoy',
        progress: 0,
        target: 25,
        rewardSparks: 120,
        claimed: false,
      },
      {
        id: 'combo_10',
        title: 'Reacción en Cadena',
        description: 'Alcanza un Combo x10 en una partida',
        progress: 0,
        target: 10,
        rewardSparks: 180,
        claimed: false,
      },
      {
        id: 'score_1500',
        title: 'Desborde Total',
        description: 'Acumula 1.500 puntos en total hoy',
        progress: 0,
        target: 1500,
        rewardSparks: 220,
        claimed: false,
      },
    ],
  };
}

function createDefaultWalletState(): PlayerWalletState {
  return {
    sparks: 0,
    reviveTokens: 3,
    noAdsUnlocked: false,
    ownedSkins: ['solar_spark'],
    equippedSkin: 'solar_spark',
    highScore: 0,
    dailyMissions: createFreshDailyMissions(getLocalDateKey()),
  };
}

function isValidSkinId(value: unknown): value is SkinId {
  return SKINS_CATALOG.some((skin) => skin.id === value);
}

function loadWalletState(): PlayerWalletState {
  const today = getLocalDateKey();
  const fallback = createDefaultWalletState();

  try {
    const raw = window.localStorage.getItem(STORE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayerWalletState>;

    const ownedSkinsRaw = Array.isArray(parsed.ownedSkins)
      ? parsed.ownedSkins.filter(isValidSkinId)
      : ['solar_spark' as SkinId];
    if (!ownedSkinsRaw.includes('solar_spark')) {
      ownedSkinsRaw.unshift('solar_spark');
    }

    const equippedSkin =
      isValidSkinId(parsed.equippedSkin) && ownedSkinsRaw.includes(parsed.equippedSkin)
        ? parsed.equippedSkin
        : 'solar_spark';

    let dailyMissions = createFreshDailyMissions(today);
    if (
      parsed.dailyMissions &&
      parsed.dailyMissions.dateKey === today &&
      Array.isArray(parsed.dailyMissions.missions)
    ) {
      dailyMissions = {
        dateKey: today,
        missions: dailyMissions.missions.map((template) => {
          const saved = parsed.dailyMissions?.missions.find((m) => m.id === template.id);
          if (!saved) return template;
          return {
            ...template,
            progress: Math.max(0, Math.min(template.target, Number(saved.progress) || 0)),
            claimed: Boolean(saved.claimed),
          };
        }),
      };
    }

    return {
      sparks: Math.max(0, Math.floor(Number(parsed.sparks) || 0)),
      reviveTokens: Math.max(0, Math.floor(Number(parsed.reviveTokens ?? 3))),
      noAdsUnlocked: Boolean(parsed.noAdsUnlocked),
      ownedSkins: ownedSkinsRaw,
      equippedSkin,
      highScore: Math.max(0, Math.floor(Number(parsed.highScore) || 0)),
      dailyMissions,
    };
  } catch {
    return fallback;
  }
}

function saveWalletState(state: PlayerWalletState): void {
  try {
    window.localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private browsing errors gracefully.
  }
}

export interface PendingAdRequest {
  reason: string;
  rewardLabel: string;
}

export interface StoreContextValue extends PlayerWalletState {
  isSandboxMode: boolean;
  pendingPurchase: IapProduct | null;
  pendingAd: PendingAdRequest | null;
  claimableMissionsCount: number;
  buySkinWithSparks: (skinId: SkinId) => boolean;
  equipSkin: (skinId: SkinId) => boolean;
  consumeReviveToken: () => boolean;
  grantSparks: (amount: number) => void;
  recordRunResult: (summary: RunSummary) => { isNewHighScore: boolean };
  claimDailyMission: (missionId: DailyMissionId) => number;
  requestIapPurchase: (productId: IapProductId) => void;
  confirmPendingPurchase: () => void;
  cancelPendingPurchase: () => void;
  requestRewardedAd: (reason: string, rewardLabel: string) => Promise<boolean>;
  completePendingAd: () => void;
  cancelPendingAd: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<PlayerWalletState>(() => loadWalletState());
  const [pendingPurchase, setPendingPurchase] = useState<IapProduct | null>(null);
  const [pendingAd, setPendingAd] = useState<PendingAdRequest | null>(null);
  const adResolverRef = useRef<((completed: boolean) => void) | null>(null);

  const isSandboxMode = !isNativePlatform() || !REVENUECAT_PUBLIC_KEY || !ADMOB_REWARDED_ID;

  useEffect(() => {
    saveWalletState(wallet);
  }, [wallet]);

  const applyIapProduct = useCallback((product: IapProduct) => {
    setWallet((prev) => {
      const nextSkins = [...prev.ownedSkins];
      if (product.grantsSkin && !nextSkins.includes(product.grantsSkin)) {
        nextSkins.push(product.grantsSkin);
      }

      return {
        ...prev,
        sparks: prev.sparks + (product.grantsSparks ?? 0),
        reviveTokens: prev.reviveTokens + (product.grantsRevives ?? 0),
        noAdsUnlocked: prev.noAdsUnlocked || Boolean(product.grantsNoAds),
        ownedSkins: nextSkins,
        equippedSkin: product.grantsSkin ?? prev.equippedSkin,
      };
    });
    soundEngine.playPurchase();
    hapticSuccess();
  }, []);

  const buySkinWithSparks = useCallback((skinId: SkinId): boolean => {
    const skin = getSkinConfig(skinId);
    if (skin.exclusive) return false;

    let succeeded = false;
    setWallet((prev) => {
      if (prev.ownedSkins.includes(skinId)) {
        succeeded = true;
        return { ...prev, equippedSkin: skinId };
      }
      if (prev.sparks < skin.priceSparks) {
        return prev;
      }
      succeeded = true;
      return {
        ...prev,
        sparks: prev.sparks - skin.priceSparks,
        ownedSkins: [...prev.ownedSkins, skinId],
        equippedSkin: skinId,
      };
    });

    if (succeeded) {
      soundEngine.playPurchase();
      hapticSuccess();
    } else {
      hapticWarning();
    }
    return succeeded;
  }, []);

  const equipSkin = useCallback((skinId: SkinId): boolean => {
    let equipped = false;
    setWallet((prev) => {
      if (!prev.ownedSkins.includes(skinId)) return prev;
      equipped = true;
      return { ...prev, equippedSkin: skinId };
    });
    if (equipped) {
      soundEngine.playUiClick();
    }
    return equipped;
  }, []);

  const consumeReviveToken = useCallback((): boolean => {
    let consumed = false;
    setWallet((prev) => {
      if (prev.reviveTokens <= 0) return prev;
      consumed = true;
      return { ...prev, reviveTokens: prev.reviveTokens - 1 };
    });
    return consumed;
  }, []);

  const grantSparks = useCallback((amount: number) => {
    if (amount <= 0) return;
    setWallet((prev) => ({
      ...prev,
      sparks: prev.sparks + Math.floor(amount),
    }));
  }, []);

  const recordRunResult = useCallback(
    (summary: RunSummary): { isNewHighScore: boolean } => {
      const isNewHighScore = summary.score > wallet.highScore;
      const today = getLocalDateKey();

      setWallet((prev) => {
        const baseMissions =
          prev.dailyMissions.dateKey === today
            ? prev.dailyMissions
            : createFreshDailyMissions(today);

        const updatedMissions = baseMissions.missions.map((mission) => {
          if (mission.id === 'destroy_25') {
            return {
              ...mission,
              progress: Math.min(mission.target, mission.progress + summary.shapesDestroyed),
            };
          }
          if (mission.id === 'combo_10') {
            return {
              ...mission,
              progress: Math.min(mission.target, Math.max(mission.progress, summary.maxCombo)),
            };
          }
          return {
            ...mission,
            progress: Math.min(mission.target, mission.progress + summary.score),
          };
        });

        return {
          ...prev,
          sparks: prev.sparks + summary.runSparks,
          highScore: Math.max(prev.highScore, summary.score),
          dailyMissions: {
            dateKey: today,
            missions: updatedMissions,
          },
        };
      });

      return { isNewHighScore };
    },
    [wallet.highScore]
  );

  const claimDailyMission = useCallback((missionId: DailyMissionId): number => {
    let rewardGranted = 0;
    setWallet((prev) => {
      const targetMission = prev.dailyMissions.missions.find((m) => m.id === missionId);
      if (!targetMission || targetMission.claimed || targetMission.progress < targetMission.target) {
        return prev;
      }

      rewardGranted = targetMission.rewardSparks;
      return {
        ...prev,
        sparks: prev.sparks + rewardGranted,
        dailyMissions: {
          ...prev.dailyMissions,
          missions: prev.dailyMissions.missions.map((m) =>
            m.id === missionId ? { ...m, claimed: true } : m
          ),
        },
      };
    });

    if (rewardGranted > 0) {
      soundEngine.playPurchase();
      hapticSuccess();
    }
    return rewardGranted;
  }, []);

  const requestIapPurchase = useCallback(
    (productId: IapProductId) => {
      const product = IAP_PRODUCTS.find((p) => p.id === productId);
      if (!product) return;
      if (product.id === 'founder_pack' && wallet.noAdsUnlocked && wallet.ownedSkins.includes('founder_gold')) {
        return;
      }
      soundEngine.playUiClick();
      // Integration point for native RevenueCat / @capgo/native-purchases when running in production native build
      setPendingPurchase(product);
    },
    [wallet.noAdsUnlocked, wallet.ownedSkins]
  );

  const confirmPendingPurchase = useCallback(() => {
    if (!pendingPurchase) return;
    applyIapProduct(pendingPurchase);
    setPendingPurchase(null);
  }, [applyIapProduct, pendingPurchase]);

  const cancelPendingPurchase = useCallback(() => {
    soundEngine.playUiClick();
    setPendingPurchase(null);
  }, []);

  const requestRewardedAd = useCallback(
    (reason: string, rewardLabel: string): Promise<boolean> => {
      // If a user holds Founder's Pack ("Sin Anuncios"), grant rewarded bonuses instantly without ad wait!
      if (wallet.noAdsUnlocked) {
        soundEngine.playPurchase();
        hapticSuccess();
        return Promise.resolve(true);
      }

      if (adResolverRef.current) {
        adResolverRef.current(false);
        adResolverRef.current = null;
      }

      return new Promise<boolean>((resolve) => {
        adResolverRef.current = resolve;
        // Integration point for @capacitor-community/admob in native production build
        setPendingAd({ reason, rewardLabel });
      });
    },
    [wallet.noAdsUnlocked]
  );

  const completePendingAd = useCallback(() => {
    setPendingAd(null);
    soundEngine.playPurchase();
    hapticSuccess();
    const resolve = adResolverRef.current;
    adResolverRef.current = null;
    resolve?.(true);
  }, []);

  const cancelPendingAd = useCallback(() => {
    setPendingAd(null);
    soundEngine.playUiClick();
    const resolve = adResolverRef.current;
    adResolverRef.current = null;
    resolve?.(false);
  }, []);

  const claimableMissionsCount = useMemo(
    () =>
      wallet.dailyMissions.missions.filter(
        (m) => !m.claimed && m.progress >= m.target
      ).length,
    [wallet.dailyMissions.missions]
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      ...wallet,
      isSandboxMode,
      pendingPurchase,
      pendingAd,
      claimableMissionsCount,
      buySkinWithSparks,
      equipSkin,
      consumeReviveToken,
      grantSparks,
      recordRunResult,
      claimDailyMission,
      requestIapPurchase,
      confirmPendingPurchase,
      cancelPendingPurchase,
      requestRewardedAd,
      completePendingAd,
      cancelPendingAd,
    }),
    [
      wallet,
      isSandboxMode,
      pendingPurchase,
      pendingAd,
      claimableMissionsCount,
      buySkinWithSparks,
      equipSkin,
      consumeReviveToken,
      grantSparks,
      recordRunResult,
      claimDailyMission,
      requestIapPurchase,
      confirmPendingPurchase,
      cancelPendingPurchase,
      requestRewardedAd,
      completePendingAd,
      cancelPendingAd,
    ]
  );

  return React.createElement(StoreContext.Provider, { value }, children);
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore debe utilizarse dentro de StoreProvider.');
  }
  return ctx;
}
