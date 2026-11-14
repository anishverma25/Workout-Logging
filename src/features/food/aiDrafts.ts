import { getAccountState } from '@/app/account';

/**
 * What the person typed or picked for Macrotrophy AI survives closing and reopening the sheet
 * for 10 minutes (batch 10, D7). In memory only, per account, never stored on the phone.
 */
export const DRAFT_MS = 10 * 60_000;
const drafts = new Map<string, { value: unknown; at: number }>();
const key = (kind: string) => `${getAccountState().user?.id ?? 'guest'}:${kind}`;

export function readDraft<T>(kind: string): T | null {
  const d = drafts.get(key(kind));
  if (!d || Date.now() - d.at > DRAFT_MS) return null;
  return d.value as T;
}

export function writeDraft(kind: string, value: unknown): void {
  if (value === null || value === '') drafts.delete(key(kind));
  else drafts.set(key(kind), { value, at: Date.now() });
}
