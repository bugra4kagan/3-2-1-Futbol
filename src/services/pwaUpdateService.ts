export interface PwaUpdateState {
  updateAvailable: boolean;
  isUpdating: boolean;
  dismissed: boolean;
}

export interface PwaSwRegistrationLike {
  waiting: { postMessage: (msg: unknown) => void } | null;
  installing: {
    state: string;
    addEventListener: (type: 'statechange', cb: () => void) => void;
  } | null;
  update: () => Promise<void>;
  addEventListener: (type: 'updatefound', cb: () => void) => void;
}

export function isNativeCapacitorEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  try {
    return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  } catch {
    return false;
  }
}

/**
 * Devam eden maç sırasında kullanıcıyı rahatsız etmez; yalnızca maç dışındayken güncelleme bildirimini gösterir.
 */
export function shouldShowPwaUpdateBanner(params: {
  updateAvailable: boolean;
  isInActiveMatch: boolean;
  dismissed?: boolean;
}): boolean {
  return Boolean(params.updateAvailable && !params.isInActiveMatch && !params.dismissed);
}

export interface PwaUpdateController {
  getState: () => PwaUpdateState;
  subscribe: (listener: (state: PwaUpdateState) => void) => () => void;
  attachRegistration: (reg: PwaSwRegistrationLike, hasExistingController: boolean) => void;
  checkForUpdate: () => Promise<void>;
  applyUpdate: (options: { isInActiveMatch: boolean }) => boolean;
  dismissBanner: () => void;
  notifyControllerChanged: () => void;
}

export function createPwaUpdateController(deps?: {
  reloadPage?: () => void;
  scheduleFallbackReload?: (cb: () => void, ms: number) => void;
}): PwaUpdateController {
  let state: PwaUpdateState = {
    updateAvailable: false,
    isUpdating: false,
    dismissed: false,
  };
  let registration: PwaSwRegistrationLike | null = null;
  let reloadRequested = false;
  let reloaded = false;
  const listeners = new Set<(next: PwaUpdateState) => void>();

  const reloadPage =
    deps?.reloadPage ??
    (() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    });

  const scheduleFallbackReload =
    deps?.scheduleFallbackReload ??
    ((cb, ms) => {
      setTimeout(cb, ms);
    });

  const emit = () => {
    const snapshot = { ...state };
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const markUpdateAvailable = () => {
    if (state.updateAvailable && !state.dismissed) return;
    state = {
      ...state,
      updateAvailable: true,
      dismissed: false,
    };
    emit();
  };

  const triggerSafeReloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    reloadPage();
  };

  return {
    getState() {
      return { ...state };
    },
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...state });
      return () => {
        listeners.delete(listener);
      };
    },
    attachRegistration(reg, hasExistingController) {
      registration = reg;
      if (reg.waiting && hasExistingController) {
        markUpdateAvailable();
      }
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && hasExistingController) {
            markUpdateAvailable();
          }
        });
      });
    },
    async checkForUpdate() {
      if (!registration) return;
      try {
        await registration.update();
        if (registration.waiting) {
          markUpdateAvailable();
        }
      } catch {
        // Offline or transient Safari fetch error — ignore cleanly
      }
    },
    applyUpdate({ isInActiveMatch }) {
      // Devam eden maç sırasında asla güncelleme/yenileme başlatma
      if (isInActiveMatch || !state.updateAvailable) {
        return false;
      }
      if (reloadRequested) return true;
      reloadRequested = true;
      state = { ...state, isUpdating: true };
      emit();

      // Yalnızca SW geçişini tetikler; localStorage, oturum, coin ve lig puanı tamamen korunur.
      if (registration?.waiting) {
        try {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          triggerSafeReloadOnce();
          return true;
        }
        scheduleFallbackReload(() => {
          triggerSafeReloadOnce();
        }, 1800);
        return true;
      }

      triggerSafeReloadOnce();
      return true;
    },
    dismissBanner() {
      if (state.dismissed) return;
      state = { ...state, dismissed: true };
      emit();
    },
    notifyControllerChanged() {
      if (reloadRequested) {
        triggerSafeReloadOnce();
      }
    },
  };
}

const globalController = createPwaUpdateController();
let swInitialized = false;

export function initPwaServiceWorker(): void {
  if (swInitialized || typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (isNativeCapacitorEnvironment()) return;
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }

  swInitialized = true;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    globalController.notifyControllerChanged();
  });

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', {
        updateViaCache: 'none',
      });
      globalController.attachRegistration(
        reg as unknown as PwaSwRegistrationLike,
        Boolean(navigator.serviceWorker.controller)
      );

      // iOS Safari Ana Ekrana Ekle (PWA) her ön plana geldiğinde güncelleme denetle
      const checkUpdate = () => {
        void globalController.checkForUpdate();
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkUpdate();
      });
      window.addEventListener('pageshow', checkUpdate);
      window.addEventListener('online', checkUpdate);
      setInterval(checkUpdate, 10 * 60 * 1000);
    } catch {
      // SW registration failure must never affect gameplay
    }
  };

  if (document.readyState === 'complete') {
    void register();
  } else {
    window.addEventListener('load', () => {
      void register();
    }, { once: true });
  }
}

export function subscribePwaUpdateState(listener: (state: PwaUpdateState) => void): () => void {
  return globalController.subscribe(listener);
}

export function applyPwaUpdateNow(options: { isInActiveMatch: boolean }): boolean {
  return globalController.applyUpdate(options);
}

export function dismissPwaUpdateBanner(): void {
  globalController.dismissBanner();
}

export function checkForPwaUpdateNow(): Promise<void> {
  return globalController.checkForUpdate();
}
