import { formatCode } from '@/app/community';

/**
 * Sends a group's join code: the phone's share sheet where there is one (WhatsApp, Instagram,
 * Messages), else the clipboard. Returns what happened so the caller can say so.
 */
export async function shareCode(
  groupName: string,
  code: string,
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = `Join my group "${groupName}" on Macrotrophy and let's see who trains hardest this week. Open Macrotrophy, go to Groups, tap Join with a code and type ${formatCode(code)}`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `Join ${groupName} on Macrotrophy`, text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(formatCode(code));
    return 'copied';
  } catch {
    return 'failed';
  }
}
