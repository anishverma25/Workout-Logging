import { useEffect } from 'react';

/**
 * Keeps the screen on while a workout is open, where the browser supports it. The lock is
 * dropped by the browser when the app goes to the background, so it is taken again on return.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const take = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch {
        // Battery saver or a denied permission: the workout works the same without it.
      }
    };
    const onVisible = () => void take();
    void take();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [enabled]);
}
