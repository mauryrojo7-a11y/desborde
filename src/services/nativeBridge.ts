import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const VIBRATION_STORAGE_KEY = 'desborde_vibration_v1';

let vibrationEnabledCache: boolean | null = null;

function readInitialVibrationSetting(): boolean {
  try {
    const raw = window.localStorage.getItem(VIBRATION_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getVibrationEnabled(): boolean {
  if (vibrationEnabledCache === null) {
    vibrationEnabledCache = readInitialVibrationSetting();
  }
  return vibrationEnabledCache;
}

export function setVibrationEnabled(enabled: boolean): void {
  vibrationEnabledCache = enabled;
  try {
    window.localStorage.setItem(VIBRATION_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage quota or privacy-mode errors silently.
  }
}

function webVibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Silent fallback when Vibration API is blocked or unavailable.
  }
}

export function hapticLight(): void {
  if (!getVibrationEnabled()) return;
  if (isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    return;
  }
  webVibrate(10);
}

export function hapticMedium(): void {
  if (!getVibrationEnabled()) return;
  if (isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    return;
  }
  webVibrate(18);
}

export function hapticHeavy(): void {
  if (!getVibrationEnabled()) return;
  if (isNativePlatform()) {
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    return;
  }
  webVibrate([24, 16, 32]);
}

export function hapticSuccess(): void {
  if (!getVibrationEnabled()) return;
  if (isNativePlatform()) {
    void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    return;
  }
  webVibrate([12, 24, 20]);
}

export function hapticWarning(): void {
  if (!getVibrationEnabled()) return;
  if (isNativePlatform()) {
    void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    return;
  }
  webVibrate([36, 26, 52]);
}
