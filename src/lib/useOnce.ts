import { useCallback, useRef, useState } from 'react';

/**
 * A guard for save buttons (batch 10, D6): while one run is in flight, more taps do nothing,
 * so a double tap never logs twice. `busy` is for disabling the button.
 */
export function useOnce(): [busy: boolean, run: (fn: () => Promise<unknown>) => Promise<void>] {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
