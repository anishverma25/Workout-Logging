import { z } from 'zod';

/** Feedback people send from the app. Pure rules; sending lives in `src/app/feedback.ts`. */

export const FEEDBACK_TAGS = ['love', 'idea', 'confusing', 'bug'] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];

export const FEEDBACK_TAG_LABEL: Record<FeedbackTag, string> = {
  love: 'Love it',
  idea: 'Idea',
  confusing: 'Confusing',
  bug: 'Something broke',
};

/** What each star means, shown under the stars once one is picked. */
export const RATING_LABEL: Record<number, string> = {
  1: 'Not for me',
  2: 'Needs work',
  3: 'It is okay',
  4: 'Really good',
  5: 'Love it',
};

export type FeedbackSource = 'more' | 'prompt' | 'error' | 'pro';

export const MESSAGE_MAX = 2000;
/** The server allows this many a day for each person. */
export const DAILY_LIMIT = 10;

export interface FeedbackDraft {
  rating: number | null;
  tags: FeedbackTag[];
  message: string;
}

/** Why the draft cannot be sent, or null when it can. Same rules as the server. */
export function feedbackProblem(draft: FeedbackDraft): string | null {
  if (draft.rating === null && draft.message.trim() === '')
    return 'Pick a rating or write a few words.';
  if (
    draft.rating !== null &&
    !(Number.isInteger(draft.rating) && draft.rating >= 1 && draft.rating <= 5)
  )
    return 'Pick between 1 and 5 stars.';
  if (draft.message.trim().length > MESSAGE_MAX)
    return `Keep it under ${MESSAGE_MAX.toLocaleString()} characters.`;
  return null;
}

/**
 * Ask once, after real use: the third finished workout, on an account (feedback needs one),
 * and never again whatever the answer.
 */
export const PROMPT_AFTER_WORKOUTS = 3;
export function shouldAskForFeedback(input: {
  signedIn: boolean;
  finishedWorkouts: number;
  alreadyAsked: boolean;
}): boolean {
  return input.signedIn && !input.alreadyAsked && input.finishedWorkouts >= PROMPT_AFTER_WORKOUTS;
}

/** A sent item as the server returns it. */
export const SentFeedback = z.object({
  id: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
  tags: z
    .array(z.string())
    .transform((t) =>
      t.filter((x): x is FeedbackTag => (FEEDBACK_TAGS as readonly string[]).includes(x)),
    ),
  message: z.string(),
  created_at: z.string(),
  seen_at: z.string().nullable(),
  reply: z.string().nullable(),
  replied_at: z.string().nullable(),
});
export type SentFeedback = z.infer<typeof SentFeedback>;

export type FeedbackStatus = 'waiting' | 'sent' | 'seen' | 'replied';

export function feedbackStatus(item: {
  pending?: boolean;
  seen_at?: string | null;
  reply?: string | null;
}): FeedbackStatus {
  if (item.pending) return 'waiting';
  if (item.reply) return 'replied';
  if (item.seen_at) return 'seen';
  return 'sent';
}

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  waiting: 'Waiting to send',
  sent: 'Sent',
  seen: 'Read by the team',
  replied: 'Replied',
};
