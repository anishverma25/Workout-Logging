/**
 * Persistent storage request. Browsers (notably Safari) may evict IndexedDB for sites that
 * are not installed or not used for a while. Until cloud sync exists, the workout log lives
 * only on this device, so the app asks the browser to keep it.
 */

export type StorageState = 'persisted' | 'best-effort' | 'unsupported';

export async function getStorageState(): Promise<StorageState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return 'unsupported';
  return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort';
}

export async function requestPersistentStorage(): Promise<StorageState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported';
  try {
    return (await navigator.storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'best-effort';
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
