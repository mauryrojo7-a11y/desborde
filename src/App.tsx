import React, { useCallback, useRef, useState } from 'react';
import { DailyMissionsModal } from './components/DailyMissionsModal';
import { GameCanvas } from './components/GameCanvas';
import { GameOverModal } from './components/GameOverModal';
import { MainMenu } from './components/MainMenu';
import { SandboxOverlays } from './components/SandboxOverlays';
import { ShopModal } from './components/ShopModal';
import { GameEngine } from './game/GameEngine';
import { soundEngine } from './game/SoundEngine';
import type { RunSummary } from './game/types';
import { StoreProvider, useStore } from './services/monetization';
import {
  getVibrationEnabled,
  hapticLight,
  setVibrationEnabled,
} from './services/nativeBridge';

type ScreenMode = 'menu' | 'playing';
type ActiveOverlay = 'none' | 'shop' | 'missions';

interface GameModalState {
  phase: 'revive_offer' | 'gameover';
  summary: RunSummary;
  isNewHighScore: boolean;
}

const DesbordeShell: React.FC = () => {
  const {
    consumeReviveToken,
    grantSparks,
    recordRunResult,
    requestRewardedAd,
  } = useStore();

  const engineRef = useRef<GameEngine | null>(null);
  const [screen, setScreen] = useState<ScreenMode>('menu');
  const [overlay, setOverlay] = useState<ActiveOverlay>('none');
  const [gameModal, setGameModal] = useState<GameModalState | null>(null);
  const [doubleSparksClaimed, setDoubleSparksClaimed] = useState(false);

  const [soundMuted, setSoundMuted] = useState(() => soundEngine.isMuted());
  const [vibrationOn, setVibrationOn] = useState(() => getVibrationEnabled());

  const handleToggleSound = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setSoundMuted(nextMuted);
    hapticLight();
  }, []);

  const handleToggleVibration = useCallback(() => {
    setVibrationOn((prev) => {
      const next = !prev;
      setVibrationEnabled(next);
      if (next) hapticLight();
      soundEngine.playUiClick();
      return next;
    });
  }, []);

  const handlePlay = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playUiClick();
    hapticLight();
    setGameModal(null);
    setDoubleSparksClaimed(false);
    setOverlay('none');
    setScreen('playing');
  }, []);

  const handleReviveOffer = useCallback((summary: RunSummary) => {
    setGameModal({
      phase: 'revive_offer',
      summary,
      isNewHighScore: false,
    });
  }, []);

  const handleGameOver = useCallback(
    (summary: RunSummary) => {
      const { isNewHighScore } = recordRunResult(summary);
      setGameModal({
        phase: 'gameover',
        summary,
        isNewHighScore,
      });
    },
    [recordRunResult]
  );

  const handleReviveWithToken = useCallback(() => {
    if (!consumeReviveToken()) return;
    setGameModal(null);
    engineRef.current?.revivePlayer();
  }, [consumeReviveToken]);

  const handleReviveWithAd = useCallback(async () => {
    const completed = await requestRewardedAd(
      'Revivir en DESBORDE',
      'Segunda Oportunidad'
    );
    if (completed) {
      setGameModal(null);
      engineRef.current?.revivePlayer();
    }
  }, [requestRewardedAd]);

  const handleDeclineRevive = useCallback(() => {
    engineRef.current?.declineRevive();
  }, []);

  const handleDoubleSparksWithAd = useCallback(async () => {
    if (!gameModal || doubleSparksClaimed || gameModal.summary.runSparks <= 0) {
      return;
    }
    const bonus = gameModal.summary.runSparks;
    const completed = await requestRewardedAd(
      'Duplicar Chispas de la partida',
      `+${bonus} Chispas extra`
    );
    if (completed) {
      grantSparks(bonus);
      setDoubleSparksClaimed(true);
    }
  }, [doubleSparksClaimed, gameModal, grantSparks, requestRewardedAd]);

  const handleRetry = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playUiClick();
    hapticLight();
    setGameModal(null);
    setDoubleSparksClaimed(false);
    engineRef.current?.restartImmediate();
  }, []);

  const handleGoHome = useCallback(() => {
    soundEngine.playUiClick();
    setGameModal(null);
    setDoubleSparksClaimed(false);
    setScreen('menu');
  }, []);

  const handleOpenShop = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playUiClick();
    setOverlay('shop');
  }, []);

  const handleOpenMissions = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playUiClick();
    setOverlay('missions');
  }, []);

  const handleCloseOverlay = useCallback(() => {
    soundEngine.playUiClick();
    setOverlay('none');
  }, []);

  return (
    <div className="w-full h-[100dvh] bg-zinc-950 flex items-center justify-center overflow-hidden">
      <div className="relative w-full max-w-[460px] h-full sm:h-[min(920px,96dvh)] sm:rounded-[34px] sm:border sm:border-zinc-800/90 sm:shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden bg-zinc-950">
        {screen === 'menu' ? (
          <MainMenu
            onPlay={handlePlay}
            onOpenShop={handleOpenShop}
            onOpenMissions={handleOpenMissions}
            soundMuted={soundMuted}
            onToggleSound={handleToggleSound}
            vibrationEnabled={vibrationOn}
            onToggleVibration={handleToggleVibration}
          />
        ) : (
          <GameCanvas
            engineRef={engineRef}
            onReviveOffer={handleReviveOffer}
            onGameOver={handleGameOver}
            soundMuted={soundMuted}
            onToggleSound={handleToggleSound}
          />
        )}

        {screen === 'playing' && gameModal && overlay === 'none' ? (
          <GameOverModal
            phase={gameModal.phase}
            summary={gameModal.summary}
            isNewHighScore={gameModal.isNewHighScore}
            doubleSparksClaimed={doubleSparksClaimed}
            onReviveWithToken={handleReviveWithToken}
            onReviveWithAd={() => void handleReviveWithAd()}
            onDeclineRevive={handleDeclineRevive}
            onDoubleSparksWithAd={() => void handleDoubleSparksWithAd()}
            onRetry={handleRetry}
            onOpenShop={handleOpenShop}
            onGoHome={handleGoHome}
          />
        ) : null}

        {overlay === 'shop' ? <ShopModal onClose={handleCloseOverlay} /> : null}
        {overlay === 'missions' ? (
          <DailyMissionsModal onClose={handleCloseOverlay} />
        ) : null}

        <SandboxOverlays />
      </div>
    </div>
  );
};

export function App(): React.ReactElement {
  return (
    <StoreProvider>
      <DesbordeShell />
    </StoreProvider>
  );
}

export default App;
