import { requestPersistentStorage } from '@/data/storage';
import { initAccount } from './account';
import { startEntitlement } from './entitlement';

export async function bootstrap(): Promise<void> {
  // Picks the guest or account database before the first render.
  await initAccount();
  startEntitlement();
  // Ask the browser not to evict local data. Silently ignored where unsupported.
  void requestPersistentStorage();
}
