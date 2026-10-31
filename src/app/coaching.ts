import { useEffect, useState } from 'react';
import { supabase } from '@/data/sync/supabase';

/**
 * 1:1 coaching (November 2026): what the member's coaching looks like on the server. The coach's
 * WhatsApp number comes only from `get_my_coaching`, and only while the account has coaching, so
 * it is never in the app's code or shown to anyone else. Access itself comes from the
 * entitlement (`coaching_expires_at`), like every other paid feature.
 */

export interface CoachingIntake {
  phone: string;
  goal: string;
  schedule: string;
  notes: string;
  updatedAt: Date | null;
}

export interface CoachingState {
  active: boolean;
  expiresAt: Date | null;
  coachName: string | null;
  /** Digits only, with the country code, for a wa.me link. */
  coachWhatsapp: string | null;
  intake: CoachingIntake | null;
}

export class CoachingError extends Error {}

function parse(value: unknown): CoachingState {
  const v = (value ?? {}) as Record<string, unknown>;
  const i = v.intake as Record<string, unknown> | null | undefined;
  const date = (x: unknown) => (typeof x === 'string' ? new Date(x) : null);
  const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x : null);
  return {
    active: v.active === true,
    expiresAt: date(v.expires_at),
    coachName: text(v.coach_name),
    coachWhatsapp:
      typeof v.coach_whatsapp === 'string' && /^\d{10,15}$/.test(v.coach_whatsapp)
        ? v.coach_whatsapp
        : null,
    intake: i
      ? {
          phone: String(i.phone ?? ''),
          goal: String(i.goal ?? ''),
          schedule: String(i.schedule ?? ''),
          notes: String(i.notes ?? ''),
          updatedAt: date(i.updated_at),
        }
      : null,
  };
}

/** The member's coaching, refetched when `version` changes (after paying or sending the form). */
export function useCoaching(enabled: boolean, version = 0) {
  const key = `${version}`;
  // The answer for one request key; loading is "no answer yet for the current key".
  const [result, setResult] = useState<{
    key: string;
    data: CoachingState | null;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (!enabled || !supabase) return;
    let live = true;
    void supabase.rpc('get_my_coaching').then(({ data, error }) => {
      if (!live) return;
      setResult({ key, data: error ? null : parse(data), error: !!error });
    });
    return () => {
      live = false;
    };
  }, [enabled, key]);
  const current = enabled && result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? false,
    loading: enabled && !!supabase && current === null,
  };
}

/** Phone numbers people type: +91 98765 43210, 098765 43210, 9876543210. */
export function cleanPhone(raw: string): string | null {
  const kept = raw
    .replace(/[^\d+ ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const digits = kept.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  if (kept.indexOf('+') > 0 || (kept.match(/\+/g)?.length ?? 0) > 1) return null;
  return kept;
}

/** Sends what the member wants from coaching and how to reach them. */
export async function submitIntake(input: {
  phone: string;
  goal: string;
  schedule: string;
  notes: string;
}): Promise<void> {
  if (!supabase) throw new CoachingError('Accounts are not set up in this version of the app.');
  const phone = cleanPhone(input.phone);
  if (!phone) throw new CoachingError('Enter a phone number with 10 to 15 digits.');
  const goal = input.goal.trim();
  if (!goal) throw new CoachingError('Tell your coach what you want to achieve.');
  if (goal.length > 500) throw new CoachingError('Keep your goal under 500 characters.');
  if (input.schedule.trim().length > 300)
    throw new CoachingError('Keep your schedule under 300 characters.');
  if (input.notes.trim().length > 1000)
    throw new CoachingError('Keep the notes under 1,000 characters.');
  const { error } = await supabase.rpc('submit_coaching_intake', {
    p_phone: phone,
    p_goal: goal,
    p_schedule: input.schedule.trim(),
    p_notes: input.notes.trim(),
  });
  if (error) {
    throw new CoachingError(
      /not active/i.test(error.message)
        ? 'Coaching is not active on this account yet.'
        : 'Could not send it. Check your connection and try again.',
    );
  }
}

/** A WhatsApp chat with the coach, with a first message the member can edit. */
export function whatsappLink(number: string, name: string | null): string {
  const hello = `Hi${name ? ` ${name}` : ''}, I joined 1:1 coaching on Overload.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(hello)}`;
}

export const __test = { parse };
