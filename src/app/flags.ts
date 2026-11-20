import { useSyncExternalStore } from 'react';
import { supabase } from '@/data/sync/supabase';

/**
 * Switches the owner can flip in the SQL editor (`app_settings.flags`, migration 0028) to turn
 * something off in seconds without a deploy: `ai_chat`, `ai_food`, `ai_photo`, `payments`,
 * `groups` (false turns it off) and `notice` (one line shown to everyone). Anything left out
 * is on, except `google_sign_in`, which stays off until it is set to true (only once Google is
 * set up as a sign-in provider in Supabase). Read on start and every 10 minutes; when the server cannot be reached, everything
 * stays on (the server still enforces its own limits).
 */
export interface AppFlags {
  ai_chat: boolean;
  ai_food: boolean;
  ai_photo: boolean;
  payments: boolean;
  groups: boolean;
  /** Continue with Google on sign in and sign up. Off unless set to true. */
  google_sign_in: boolean;
  notice: string | null;
}

export const ALL_ON: AppFlags = {
  ai_chat: true,
  ai_food: true,
  ai_photo: true,
  payments: true,
  groups: true,
  google_sign_in: false,
  notice: null,
};

/** Reads the server's answer, keeping only what it knows; pure, for tests. */
export function parseFlags(raw: unknown): AppFlags {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const on = (k: keyof Omit<AppFlags, 'notice' | 'google_sign_in'>) => o[k] !== false;
  const notice =
    typeof o.notice === 'string' && o.notice.trim() ? o.notice.trim().slice(0, 140) : null;
  return {
    ai_chat: on('ai_chat'),
    ai_food: on('ai_food'),
    ai_photo: on('ai_photo'),
    payments: on('payments'),
    groups: on('groups'),
    google_sign_in: o.google_sign_in === true,
    notice,
  };
}

let flags: AppFlags = ALL_ON;
const listeners = new Set<() => void>();
let started = false;

async function load() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.rpc('get_app_flags');
    // A server without migration 0028 answers with an error: everything stays on.
    if (error) return;
    flags = parseFlags(data);
    listeners.forEach((l) => l());
  } catch {
    // Offline: keep the last answer.
  }
}

export function startFlags() {
  if (started || typeof window === 'undefined') return;
  started = true;
  void load();
  setInterval(() => {
    if (document.visibilityState === 'visible') void load();
  }, 10 * 60_000);
}

export const getFlags = () => flags;

export function useAppFlags(): AppFlags {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => flags,
  );
}

/** The words shown when a switched-off feature is used. */
export const PAUSED = 'This is paused for a short while. Try again later.';
