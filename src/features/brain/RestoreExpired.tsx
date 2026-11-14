import { useEffect } from 'react';
import { db } from '@/data/db';
import { restoreExpired } from '@/data/repositories/plan';
import { toDateKey } from '@/lib/dates';

/**
 * Puts temporary plan changes back once their time is up, on every open and whenever the app
 * comes back to the front. For everyone: it never waits for Pro or for the weekly review.
 */
export function RestoreExpired() {
  useEffect(() => {
    let running = false;
    const run = () => {
      if (running) return;
      running = true;
      restoreExpired(db, toDateKey(new Date()))
        .catch((err: unknown) => console.error('Could not put temporary changes back', err))
        .finally(() => {
          running = false;
        });
    };
    run();
    const onShow = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  return null;
}
