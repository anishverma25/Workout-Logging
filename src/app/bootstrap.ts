import { db } from '@/data/db';
import { autoloadDemoIfFirstRun } from '@/data/demo/service';
import { requestPersistentStorage } from '@/data/storage';

/**
 * Demo data loads automatically on first run during development, or when
 * VITE_DEMO_AUTOLOAD=true is set. Production users start with an empty app.
 */
export const DEMO_AUTOLOAD = import.meta.env.DEV || import.meta.env.VITE_DEMO_AUTOLOAD === 'true';

export async function bootstrap(): Promise<void> {
  await db.open();
  await autoloadDemoIfFirstRun(db, DEMO_AUTOLOAD);
  // Ask the browser not to evict local data. Silently ignored where unsupported.
  void requestPersistentStorage();
}
