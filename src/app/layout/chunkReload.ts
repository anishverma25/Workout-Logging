/** A screen's code file could not load: usually a new version was deployed since this tab opened. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
}

const KEY = 'overload.chunkReloadAt';

/**
 * Reloads once to pick up the new version. A second failure within a minute shows the error
 * screen instead, so a real outage never becomes a reload loop. Offline, it never reloads.
 */
export function reloadOnceForNewVersion(now = Date.now()): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
