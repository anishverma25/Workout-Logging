/**
 * A payment just went through, remembered for this tab only, so the Pro page can open with a
 * welcome after the reload that follows checkout. Session storage, because it should not
 * survive longer than the moment it describes.
 */

const KEY = 'overload.proJustStarted';

export function markProJustStarted(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Without session storage the membership simply opens without the welcome.
  }
}

/** Whether a payment just went through. A pure read, safe to call more than once. */
export function proJustStarted(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Called once the welcome has been shown: a later visit is no longer "just now". */
export function clearProJustStarted(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
