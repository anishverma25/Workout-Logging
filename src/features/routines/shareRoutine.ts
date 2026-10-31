import { db } from '@/data/db';
import { routineToShare } from '@/data/repositories/routineShare';
import { shareLink } from '@/domain/routines/share';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | { link: string };

/**
 * Sends a routine as a link: the phone's share sheet (WhatsApp, Instagram, Messages) where
 * there is one, else the link is copied. When neither works the link comes back to show.
 */
export async function shareRoutine(routineId: string): Promise<ShareOutcome> {
  const shared = await routineToShare(db, routineId);
  const link = shareLink(window.location.origin, shared);
  const text = `My ${shared.name} routine on Overload. Open the link to add it to yours.`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: shared.name, text, url: link });
      return 'shared';
    } catch (err) {
      // Closing the share sheet is not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    return 'copied';
  } catch {
    return { link };
  }
}
