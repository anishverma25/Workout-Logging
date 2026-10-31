import { useSyncExternalStore } from 'react';
import { supabase } from '@/data/sync/supabase';
import { LIMITS, type CoachTopic, type CoachTurn } from '../../supabase/functions/_shared/coach.ts';
import { getAccountState } from './account';

/**
 * The AI coach on the phone: asking the server, and what the coach keeps on this device.
 *
 * - Questions go to the `coach` Edge Function, which checks Pro and talks to the AI providers.
 * - The chat is kept on this phone only, per account, for 7 days. It never syncs and the server
 *   keeps none of it.
 * - Turning the coach on is the person's choice, asked once per account on this phone, because
 *   their training numbers leave the device when they ask.
 */

export type { CoachTopic, CoachTurn };

export const HISTORY_DAYS = 7;
const DAY_MS = 86_400_000;

export class CoachError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export interface CoachMessage extends CoachTurn {
  id: string;
  at: number;
  /** The card an Explain answer belongs to; absent in the chat. */
  topic?: CoachTopic;
}

interface CoachStore {
  consent: boolean;
  messages: CoachMessage[];
  /** Explain answers for today, by topic and the brief they answered. */
  explained: Record<string, { answer: string; at: number }>;
}

const EMPTY: CoachStore = { consent: false, messages: [], explained: {} };

const keyFor = (userId: string) => `overload.coach.${userId}`;
const currentUser = () => getAccountState().user?.id ?? null;

let cache: { userId: string | null; store: CoachStore } | null = null;
const listeners = new Set<() => void>();

function prune(store: CoachStore, now = Date.now()): CoachStore {
  const cutoff = now - HISTORY_DAYS * DAY_MS;
  const today = new Date(now).toDateString();
  return {
    consent: store.consent,
    messages: store.messages.filter((m) => m.at >= cutoff).slice(-200),
    explained: Object.fromEntries(
      Object.entries(store.explained).filter(([, v]) => new Date(v.at).toDateString() === today),
    ),
  };
}

function read(): CoachStore {
  const userId = currentUser();
  if (cache && cache.userId === userId) return cache.store;
  let store = EMPTY;
  if (userId) {
    try {
      const raw = JSON.parse(localStorage.getItem(keyFor(userId)) ?? 'null') as CoachStore | null;
      if (raw && Array.isArray(raw.messages)) store = prune({ ...EMPTY, ...raw });
    } catch {
      // Unreadable or blocked storage: start empty.
    }
  }
  cache = { userId, store };
  return store;
}

function write(next: CoachStore) {
  const userId = currentUser();
  const store = prune(next);
  cache = { userId, store };
  if (userId) {
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(store));
    } catch {
      // Storage full or blocked: the chat still works until the app is closed.
    }
  }
  listeners.forEach((l) => l());
}

export function useCoachStore(): CoachStore {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}

export const getCoachStore = read;

export function setCoachConsent(on: boolean) {
  write({ ...read(), consent: on });
}

/** Clears the chat and saved explanations on this phone. Consent stays as it is. */
export function clearCoachHistory() {
  write({ ...read(), messages: [], explained: {} });
}

const id = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function addMessages(...messages: Omit<CoachMessage, 'id' | 'at'>[]) {
  const at = Date.now();
  write({
    ...read(),
    messages: [...read().messages, ...messages.map((m) => ({ ...m, id: id(), at }))],
  });
}

/** A short, stable fingerprint of a brief, so an unchanged card reuses today's answer. */
function fingerprint(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

async function call(body: {
  topic: CoachTopic;
  question: string;
  brief: string;
  history: CoachTurn[];
}): Promise<string> {
  if (!supabase) throw new CoachError('Accounts are not set up in this version of the app.', 'off');
  const { data, error } = await supabase.functions.invoke('coach', { body });
  if (error) {
    let message = 'OverloadGPT could not be reached. Check your connection and try again.';
    let code = 'network';
    try {
      const ctx = (error as { context?: Response }).context;
      const json = ctx ? ((await ctx.json()) as { error?: string; code?: string }) : null;
      if (json?.error) message = json.error;
      if (json?.code) code = json.code;
    } catch {
      // Keep the general message.
    }
    throw new CoachError(message, code);
  }
  const answer = (data as { answer?: unknown } | null)?.answer;
  if (typeof answer !== 'string' || !answer)
    throw new CoachError('OverloadGPT gave no answer.', 'empty');
  return answer;
}

/** The brief, trimmed to what the server accepts. */
const fit = (brief: string) => brief.slice(0, LIMITS.brief);

/** Explains one card. Reuses today's answer while the card's numbers are unchanged. */
export async function explain(topic: CoachTopic, brief: string): Promise<string> {
  const key = `${topic}:${fingerprint(brief)}`;
  const saved = read().explained[key];
  if (saved) return saved.answer;
  const answer = await call({ topic, question: '', brief: fit(brief), history: [] });
  write({ ...read(), explained: { ...read().explained, [key]: { answer, at: Date.now() } } });
  return answer;
}

/**
 * Asks a question in the chat, with the last few turns for context. The question and answer
 * are saved together once the answer arrives; the screen shows the question meanwhile.
 */
export async function ask(question: string, brief: string): Promise<string> {
  const text = question.trim().slice(0, LIMITS.question);
  const history = read()
    .messages.filter((m) => !m.topic)
    .slice(-LIMITS.history)
    .map(({ role, text: t }) => ({ role, text: t.slice(0, LIMITS.turn) }));
  const answer = await call({ topic: 'chat', question: text, brief: fit(brief), history });
  addMessages({ role: 'user', text }, { role: 'coach', text: answer });
  return answer;
}
