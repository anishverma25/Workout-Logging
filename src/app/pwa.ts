import { useSyncExternalStore } from 'react';

/**
 * Service worker registration, update notice and install prompt.
 *
 * Production builds only: in development the worker would cache files that change on every
 * save. A new version never takes over by itself; the person chooses when to reload, so an
 * update can never interrupt a workout.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  updateReady: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
}

let state: PwaState = { updateReady: false, installPrompt: null, installed: false };
let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const usePwa = () => useSyncExternalStore(subscribe, () => state);

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function watch(registration: ServiceWorkerRegistration) {
  const markReady = (worker: ServiceWorker | null) => {
    // Only an update: the very first install has no controller and needs no reload.
    if (worker && navigator.serviceWorker.controller) {
      waiting = worker;
      set({ updateReady: true });
    }
  };
  markReady(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') markReady(worker);
    });
  });
}

export function registerServiceWorker() {
  set({ installed: isStandalone() });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    set({ installPrompt: event as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => set({ installPrompt: null, installed: true }));

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      watch(registration);
      // Check for a new version when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update();
      });
    } catch (err) {
      console.warn('Offline support is not available', err);
    }
  });
}

/** Switches to the new version and reloads once it is in control. */
export function applyUpdate() {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  });
  waiting.postMessage('skip-waiting');
}

export async function promptInstall(): Promise<void> {
  const prompt = state.installPrompt;
  if (!prompt) return;
  await prompt.prompt();
  await prompt.userChoice;
  set({ installPrompt: null });
}

export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

const onlineSubscribe = (l: () => void) => {
  window.addEventListener('online', l);
  window.addEventListener('offline', l);
  return () => {
    window.removeEventListener('online', l);
    window.removeEventListener('offline', l);
  };
};

export const useOnline = () => useSyncExternalStore(onlineSubscribe, () => navigator.onLine);
