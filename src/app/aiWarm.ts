import { supabase } from '@/data/sync/supabase';

/** A started function stays warm for a few minutes; no need to ask more often than this. */
const EVERY_MS = 4 * 60_000;
let last = 0;

/**
 * Starts the AI function before the person asks anything (opening OverloadGPT or the food
 * screen), so their question does not also wait for the server to start. Sends nothing about
 * the person and never shows an error.
 */
export function warmAi(now = Date.now()): void {
  if (!supabase || now - last < EVERY_MS) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  last = now;
  void supabase.functions.invoke('coach', { body: { kind: 'warm' } }).catch(() => undefined);
}
