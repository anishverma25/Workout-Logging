import { db } from '@/data/db';
import { syncController } from '@/data/sync/controller';
import { MAX_ATTEMPTS } from '@/data/sync/engine';
import { supabase } from '@/data/sync/supabase';
import { getAccountState, subscribeAccount } from './account';

/**
 * First-party error reports and onboarding steps (Fable review batch 4, migration 0032).
 *
 * A report is technical only: the kind, the route without query or hash, the app version, a
 * scrubbed message and stack. It never carries food names, notes, exercise notes, the AI brief
 * or answers, emails, tokens, query strings or hashes (a shared routine lives in the hash).
 * Reports wait in localStorage (at most 10) until the person is signed in and online. Every
 * failure is swallowed: reporting must never itself become a problem the person sees.
 */

export type ReportKind = 'crash' | 'route' | 'error' | 'unhandled' | 'chunk' | 'sync_rejected';
export type OnboardingStep =
  'tour_done' | 'signed_up' | 'setup_done' | 'first_workout' | 'first_food';

export interface ErrorReport {
  kind: ReportKind | 'step';
  fingerprint: string;
  message: string;
  stack: string;
  route: string;
  appVersion: string;
}

const QUEUE_KEY = 'overload.errorReports';
const STEPS_KEY = 'overload.stepsSent';
export const MAX_QUEUED = 10;
/** More than this in one session is a loop, not new information. */
const MAX_PER_SESSION = 30;

// ---------------------------------------------------------------------------- scrubbing

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const LONG_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;
/** The query or hash of an address goes; a stack frame's line and column stay. */
const URL_TAIL = /(https?:\/\/[^\s?#'")]+)[?#][^\s'")]*?(:\d+:\d+)?(?=[\s'")]|$)/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
/** Quoted words that read like code (`'map'`, `"workoutId"`) stay; any other quote goes. */
const QUOTED = /(['"`])([^'"`\n]{0,200})\1/g;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_WORD = /^[A-Za-z_$][\w$.]{0,40}$/;

/** Removes anything personal from a message or stack line. */
export function scrubText(text: string): string {
  let t = String(text ?? '');
  // The AI brief and anything quoted after it can hold the person's numbers and notes.
  const brief = t.search(/brief/i);
  if (brief >= 0) t = t.slice(0, brief + 'brief'.length);
  return t
    .replace(URL_TAIL, '$1$2')
    .replace(EMAIL, '[email]')
    .replace(JWT, '[token]')
    .replace(UUID, ':id')
    .replace(LONG_TOKEN, '[token]')
    .replace(QUOTED, (_m, q: string, inner: string) =>
      CODE_WORD.test(inner) ? `${q}${inner}${q}` : `${q}…${q}`,
    );
}

/** The screen, never its query or hash, with ids folded so the same screen groups together. */
export function scrubRoute(path: string): string {
  const bare = String(path ?? '').split(/[?#]/)[0] ?? '';
  return bare
    .split('/')
    .map((seg) =>
      UUID_SEGMENT.test(seg) || /^[\w-]{20,}$/.test(seg) || /^\d+$/.test(seg) ? ':id' : seg,
    )
    .join('/')
    .replace(UUID, ':id')
    .slice(0, 80);
}

/** Frames only, each scrubbed, at most 1,500 characters. */
export function scrubStack(stack: string | undefined): string {
  if (!stack) return '';
  return stack
    .split('\n')
    .filter((l) => /^\s*at\s|@/.test(l))
    .slice(0, 12)
    .map((l) => scrubText(l.trim()))
    .join('\n')
    .slice(0, 1500);
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The same failure on any phone gets the same fingerprint: numbers and ids do not count. */
export function fingerprintOf(kind: string, message: string, stack: string): string {
  const head = message.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 60);
  const frame = (stack.split('\n')[0] ?? '').replace(/:\d+:\d+/, '').replace(/\d+/g, '#');
  return `${kind}:${head}:${hash(frame)}`.slice(0, 120);
}

export function buildReport(
  kind: ReportKind,
  error: unknown,
  route: string,
  appVersion: string,
): ErrorReport {
  const err = error instanceof Error ? error : null;
  const raw = err ? `${err.name}: ${err.message}` : typeof error === 'string' ? error : 'Unknown';
  const message = scrubText(raw).slice(0, 300);
  const stack = scrubStack(err?.stack);
  return {
    kind,
    fingerprint: fingerprintOf(kind, message, stack),
    message,
    stack,
    route: scrubRoute(route),
    appVersion,
  };
}

// ---------------------------------------------------------------------------- queue

const version = () => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'local');
const currentRoute = () => (typeof location === 'undefined' ? '' : location.pathname);

function readQueue(): ErrorReport[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as ErrorReport[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(list: ErrorReport[]) {
  try {
    if (list.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(list.slice(-MAX_QUEUED)));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Storage full or blocked: this report is lost, nothing else happens.
  }
}

let sentThisSession = 0;
let flushing = false;
let serverLacksIt = false;

function enqueue(report: ErrorReport) {
  if (sentThisSession >= MAX_PER_SESSION) return;
  sentThisSession++;
  const list = readQueue();
  // The same report twice in the queue is sent once (the server counts repeats by day).
  if (!list.some((r) => r.kind === report.kind && r.fingerprint === report.fingerprint))
    list.push(report);
  writeQueue(list);
  void flushReports();
}

/** Sends waiting reports when signed in and online. Never throws. */
export async function flushReports(): Promise<void> {
  if (flushing || serverLacksIt || !supabase) return;
  if (getAccountState().status !== 'signedIn') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    for (const report of readQueue()) {
      const { error } = await supabase.rpc('report_client_error', {
        p_kind: report.kind,
        p_fingerprint: report.fingerprint,
        p_message: report.message,
        p_stack: report.stack,
        p_route: report.route,
        p_app_version: report.appVersion,
        p_user_agent:
          typeof navigator === 'undefined' ? '' : String(navigator.userAgent).slice(0, 200),
      });
      if (error) {
        // Migration 0032 not run yet: keep them, try in a later session.
        if (error.code === 'PGRST202' || error.code === '42883') serverLacksIt = true;
        return;
      }
      writeQueue(
        readQueue().filter(
          (r) => !(r.kind === report.kind && r.fingerprint === report.fingerprint),
        ),
      );
    }
  } catch {
    // Offline mid-way or anything else: the rest wait.
  } finally {
    flushing = false;
  }
}

/** Reports a failure. Safe to call from anywhere, any number of times. */
export function reportError(kind: ReportKind, error: unknown, route = currentRoute()): void {
  try {
    enqueue(buildReport(kind, error, route, version()));
  } catch {
    // Never let reporting fail the caller.
  }
}

/** A change the server refused: the table and error code only, never the row. */
export function reportSyncRejected(table: string, code: string | null): void {
  reportError('sync_rejected', `${table} ${code ?? 'unknown'}`);
}

/** What a refusal says about itself without any of the row: a constraint name or a code. */
export function refusalCode(lastError: string | null): string {
  const text = lastError ?? '';
  const constraint = /constraint "([\w]{1,60})"/.exec(text);
  if (constraint) return constraint[1]!;
  const code = /\b(PGRST\d{3}|[0-9A-Z]{5})\b/.exec(text);
  return code ? code[1]! : 'refused';
}

async function reportRejectedChanges() {
  try {
    const entries = await db.outbox.filter((e) => e.attempts >= MAX_ATTEMPTS).toArray();
    const seen = new Set<string>();
    for (const e of entries) {
      const code = refusalCode(e.lastError);
      if (seen.has(`${e.table}:${code}`)) continue;
      seen.add(`${e.table}:${code}`);
      reportSyncRejected(e.table, code);
    }
  } catch {
    // Database closed or busy: the next refusal reports again.
  }
}

/** An onboarding step, sent once per phone. No content, only the step's name. */
export function reportStep(step: OnboardingStep): void {
  try {
    const raw = localStorage.getItem(STEPS_KEY);
    const sent = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    if (sent.has(step)) return;
    sent.add(step);
    localStorage.setItem(STEPS_KEY, JSON.stringify([...sent]));
    enqueue({
      kind: 'step',
      fingerprint: step,
      message: '',
      stack: '',
      route: scrubRoute(currentRoute()),
      appVersion: version(),
    });
  } catch {
    // Storage blocked: steps are not counted on this phone.
  }
}

/**
 * The first finished workout or first food day of an account. Counted on the account's own
 * records, so a person who already trained on another phone is not counted as new here.
 */
export function reportFirst(step: 'first_workout' | 'first_food'): void {
  void (async () => {
    try {
      const n =
        step === 'first_workout'
          ? await db.workouts
              .where('origin')
              .equals('user')
              .filter((w) => w.status === 'completed' && w.deletedAt === null)
              .count()
          : new Set(
              (await db.foodLogs.where('origin').equals('user').toArray())
                .filter((f) => f.deletedAt === null)
                .map((f) => f.date),
            ).size;
      if (n === 1) reportStep(step);
    } catch {
      // Never matters to the person.
    }
  })();
}

/** Ordinary noise from browsers and extensions, not failures of the app. */
export function isNoise(message: string): boolean {
  return (
    /ResizeObserver loop|^Script error\.?$|extension:\/\/|Non-Error promise rejection/i.test(
      message,
    ) ||
    // A request that failed because the network did: the app already says it is offline.
    /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/i.test(
      message.trim(),
    )
  );
}

let started = false;

/** Listens for uncaught errors, after start-up (bootstrap). */
export function startErrorReports(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('error', (event) => {
    const message = event.error instanceof Error ? event.error.message : String(event.message);
    if (isNoise(message) || isNoise(String(event.filename ?? ''))) return;
    reportError('error', event.error ?? message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (isNoise(message)) return;
    reportError('unhandled', reason);
  });
  window.addEventListener('online', () => void flushReports());
  let rejected = 0;
  syncController.subscribe((state) => {
    if (state.rejected > rejected) void reportRejectedChanges();
    rejected = state.rejected;
  });
  subscribeAccount(() => void flushReports());
  void flushReports();
}
