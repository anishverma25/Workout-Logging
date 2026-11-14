import { requestPersistentStorage } from '@/data/storage';
import { initAccount } from './account';
import { startEntitlement } from './entitlement';
import { startFeedback } from './feedback';
import { startFlags } from './flags';

export async function bootstrap(): Promise<void> {
  // Picks the guest or account database before the first render.
  await initAccount();
  startEntitlement();
  startFeedback();
  startFlags();
  // Ask the browser not to evict local data. Silently ignored where unsupported.
  void requestPersistentStorage();
}
