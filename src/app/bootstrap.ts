import { requestPersistentStorage } from '@/data/storage';
import { initAccount } from './account';

export async function bootstrap(): Promise<void> {
  // Picks the guest or account database before the first render.
  await initAccount();
  // Ask the browser not to evict local data. Silently ignored where unsupported.
  void requestPersistentStorage();
}
