/**
 * The start-up check in index.html (`window.__overload`): a few lines of plain script that run
 * before any app code. If the app has not opened within a few seconds, it repairs the offline
 * copy once by itself, then offers "Repair and open" and "Try again" with the step that stalled,
 * so an installed app can never sit on a blank black screen.
 *
 * The app tells it what it is doing (`markStage`) and when the first real screen is up
 * (`markStarted`). Repairing removes only the offline copy of the app (service worker and its
 * caches), never the person's data or their sign-in.
 */

interface StartupCheck {
  stage: string;
  errors: string[];
  started: () => void;
  repair: () => Promise<void>;
  help: () => void;
}

declare global {
  interface Window {
    __overload?: StartupCheck;
  }
}

const check = (): StartupCheck | undefined =>
  typeof window === 'undefined' ? undefined : window.__overload;

/** What the app is doing, shown if start-up stalls ("Stuck while opening your data"). */
export function markStage(stage: string) {
  const c = check();
  if (c) c.stage = stage;
}

/** The first real screen is up: the check stands down and the opening mark fades. */
export function markStarted() {
  check()?.started();
  // The fade waits for the next frames, so the screen underneath has been painted first.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const boot = document.getElementById('boot');
      if (!boot || boot.classList.contains('out')) return;
      boot.classList.add('out');
      window.setTimeout(() => boot.remove(), 250);
    }),
  );
}

/** Start-up failed outright: show the way out now rather than after the wait. */
export function startupFailed(error: unknown) {
  const c = check();
  if (!c) return;
  const message = error instanceof Error ? error.message : String(error);
  if (c.errors.length < 4) c.errors.push(message.slice(0, 240));
  c.help();
}

/**
 * Removes the offline copy of the app and opens it fresh from the server. Falls back to a plain
 * reload where the start-up check is missing (development).
 */
export function repairAndReload() {
  const c = check();
  if (c) void c.repair();
  else window.location.reload();
}

/** Rejects with a plain message when `promise` takes longer than `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out ${what}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}
