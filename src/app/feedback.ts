import { db } from '@/data/db';
import { useLiveData } from '@/data/hooks';
import { getMeta, setMeta } from '@/data/repositories/meta';
import { supabase } from '@/data/sync/supabase';
import {
  feedbackProblem,
  SentFeedback,
  type FeedbackDraft,
  type FeedbackSource,
} from '@/domain/feedback/feedback';
import { newId } from '@/lib/ids';
import { getAccountState } from './account';

/**
 * Feedback goes to the server through `submit_feedback`. It is first kept in the account's
 * local database, so feedback written without signal is sent later, exactly once (the id is
 * made here and the server ignores a repeat).
 */

const PENDING_KEY = 'feedback.pending';
const CACHE_KEY = 'feedback.sent';
export const PROMPTED_KEY = 'feedback.prompted';

export interface PendingFeedback extends FeedbackDraft {
  id: string;
  source: FeedbackSource;
  screen: string | null;
  createdAt: string;
}

export class FeedbackError extends Error {}

const signedIn = () => getAccountState().status === 'signedIn';

/** Saves the feedback on the device and sends it. 'queued' means it waits for a connection. */
export async function sendFeedback(
  draft: FeedbackDraft,
  source: FeedbackSource,
  screen: string | null,
): Promise<'sent' | 'queued'> {
  const problem = feedbackProblem(draft);
  if (problem) throw new FeedbackError(problem);
  if (!supabase || !signedIn()) throw new FeedbackError('Sign in to send feedback.');
  const item: PendingFeedback = {
    id: newId(),
    rating: draft.rating,
    tags: draft.tags,
    message: draft.message.trim(),
    source,
    screen,
    createdAt: new Date().toISOString(),
  };
  const pending = (await getMeta<PendingFeedback[]>(db, PENDING_KEY)) ?? [];
  await setMeta(db, PENDING_KEY, [...pending, item]);
  const result = await sendOne(item);
  if (result === 'rejected') throw new FeedbackError(lastRejection);
  void refreshFeedback();
  return result;
}

let lastRejection = 'Could not send it. Try again.';

async function sendOne(item: PendingFeedback): Promise<'sent' | 'queued' | 'rejected'> {
  if (!supabase) return 'queued';
  const { error } = await supabase.rpc('submit_feedback', {
    p_id: item.id,
    p_rating: item.rating,
    p_tags: item.tags,
    p_message: item.message,
    p_source: item.source,
    p_screen: item.screen,
    p_app_version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null,
  });
  if (!error) {
    await removePending(item.id);
    return 'sent';
  }
  // The server said no (empty, too long, daily limit): sending again will not help.
  if (error.code === '22023' || error.code === '23514') {
    lastRejection = /too much/i.test(error.message)
      ? 'That is the limit for today. Thank you for all of it; try again tomorrow.'
      : 'Could not send it. Check the rating and message.';
    await removePending(item.id);
    return 'rejected';
  }
  return 'queued';
}

async function removePending(id: string) {
  const pending = (await getMeta<PendingFeedback[]>(db, PENDING_KEY)) ?? [];
  await setMeta(
    db,
    PENDING_KEY,
    pending.filter((p) => p.id !== id),
  );
}

let flushing = false;
/** Sends whatever is waiting. Safe to call often. */
export async function flushFeedback() {
  if (flushing || !supabase || !signedIn()) return;
  flushing = true;
  try {
    let sent = false;
    for (const item of (await getMeta<PendingFeedback[]>(db, PENDING_KEY)) ?? []) {
      const result = await sendOne(item);
      if (result === 'queued') break;
      sent = true;
    }
    // Show what was just sent, with its status from the server.
    if (sent) await refreshFeedback();
  } finally {
    flushing = false;
  }
}

/** Reads this person's sent feedback, with any reply, and keeps a copy for offline. */
export async function refreshFeedback() {
  if (!supabase || !signedIn()) return;
  const { data, error } = await supabase.rpc('get_my_feedback');
  if (error || !Array.isArray(data)) return;
  const items = data.flatMap((raw) => {
    const parsed = SentFeedback.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
  await setMeta(db, CACHE_KEY, items);
}

let started = false;
/** Sends waiting feedback when the app opens and whenever the connection comes back. */
export function startFeedback() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void flushFeedback());
  void flushFeedback();
}

export interface FeedbackList {
  pending: PendingFeedback[];
  sent: SentFeedback[];
}

export const useFeedbackList = () =>
  useLiveData<FeedbackList>(async () => ({
    pending: (await getMeta<PendingFeedback[]>(db, PENDING_KEY)) ?? [],
    sent: (await getMeta<SentFeedback[]>(db, CACHE_KEY)) ?? [],
  }));

export const useFeedbackPrompted = () =>
  useLiveData(async () => (await getMeta<boolean>(db, PROMPTED_KEY)) === true);

export const markFeedbackPrompted = () => setMeta(db, PROMPTED_KEY, true);
