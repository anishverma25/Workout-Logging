import { useEffect, useRef, useState } from 'react';
import { getDeviceSettings, playRestTone } from '@/app/deviceSettings';
import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useRestTimer } from '@/data/hooks';
import {
  isFinished,
  remainingMs,
  REST_PRESETS,
  restProgress,
  restedSec,
  type RestTimerState,
} from '@/domain/workout/restTimer';
import { cn } from '@/lib/cn';
import { formatClock, formatSeconds } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { restActions } from './restActions';
import { useToast } from '@/components/ui/Toast';
import { DurationPicker } from '@/components/ui/DurationPicker';

/** How long a finished timer stays on screen before it tidies itself away. */
const FINISHED_LINGER_MS = 45_000;

/**
 * Buzzes and beeps once when rest ends, if the app is open (each can be turned off in
 * Settings). No promise of alerts in the background: browsers do not allow it reliably.
 */
function useFinishSignal(state: RestTimerState | null, now: Date) {
  const signalled = useRef<string | null>(null);
  const finished = isFinished(state, now);
  const key = state?.endsAt ?? null;
  useEffect(() => {
    if (finished && key && signalled.current !== key) {
      signalled.current = key;
      if (document.visibilityState === 'visible') {
        const settings = getDeviceSettings();
        if (settings.restVibrate) navigator.vibrate?.([180, 90, 180]);
        if (settings.restSound) playRestTone();
      }
    }
  }, [finished, key]);
}

/** Floating bar above the tab bar while resting. Hidden when there is no timer. */
export function RestTimerBar({ onOpen }: { onOpen: () => void }) {
  const toast = useToast();
  const timer = useRestTimer();
  const now = useNow(250);
  const state = timer.data ?? null;
  useFinishSignal(state, now);

  useEffect(() => {
    if (!state?.endsAt) return;
    const over = now.getTime() - Date.parse(state.endsAt);
    if (state.pausedRemainingMs === null && over > FINISHED_LINGER_MS) void restActions.clear();
  }, [state, now]);

  if (!state) return null;
  const left = remainingMs(state, now);
  const paused = state.pausedRemainingMs !== null;
  const finished = !paused && left === 0;
  const progress = restProgress(state, now);

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className={cn(
        'pointer-events-auto mx-auto flex w-full max-w-md items-center gap-2 overflow-hidden rounded-2xl border p-1.5 pl-2 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)] backdrop-blur-xl transition-colors',
        finished
          ? 'border-transparent bg-accent text-accent-ink'
          : 'border-line-strong bg-surface-3/95',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 text-left"
        aria-label={
          finished ? 'Rest done. Open timer.' : `Rest ${formatClock(left / 1000)} left. Open timer.`
        }
      >
        <ProgressRing progress={finished ? 1 : progress} finished={finished} />
        <span className="min-w-0">
          <span
            aria-live="off"
            className="tabular block font-display text-[1.45rem] font-bold leading-none"
          >
            {finished ? 'Rest done' : formatClock(Math.ceil(left / 1000))}
          </span>
          <span className={cn('block text-xs', finished ? 'text-accent-ink/75' : 'text-faint')}>
            {finished
              ? `Rested ${formatClock(state.durationSec)}, next set when ready`
              : paused
                ? 'Paused'
                : `of ${formatSeconds(state.durationSec)}`}
          </span>
        </span>
      </button>
      {!finished ? (
        <>
          <button
            type="button"
            onClick={() => restActions.adjust(state, -15)}
            className="tabular h-11 rounded-xl px-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text"
            aria-label="15 seconds less"
          >
            −15
          </button>
          <button
            type="button"
            onClick={() => restActions.adjust(state, 15)}
            className="tabular h-11 rounded-xl px-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text"
            aria-label="15 seconds more"
          >
            +15
          </button>
          <IconButton
            label={paused ? 'Resume rest' : 'Pause rest'}
            icon={
              paused ? (
                <Play className="size-5" aria-hidden />
              ) : (
                <Pause className="size-5" aria-hidden />
              )
            }
            onClick={() => (paused ? restActions.resume(state) : restActions.pause(state))}
          />
        </>
      ) : null}
      <IconButton
        label={finished ? 'Dismiss' : 'Skip rest'}
        icon={<X className="size-5" aria-hidden />}
        onClick={() => {
          if (!finished) toast(`Rested ${formatClock(restedSec(state, new Date()))}`);
          void restActions.clear();
        }}
        className={finished ? 'text-accent-ink hover:bg-black/10 hover:text-accent-ink' : undefined}
      />
    </div>
  );
}

function ProgressRing({ progress, finished }: { progress: number; finished: boolean }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="size-10 shrink-0 -rotate-90" aria-hidden>
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="4"
        className={finished ? 'stroke-accent-ink/20' : 'stroke-line-strong'}
      />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
        className={cn(
          'transition-[stroke-dashoffset] duration-300 ease-linear',
          finished ? 'stroke-accent-ink' : 'stroke-accent',
        )}
      />
    </svg>
  );
}

/** Presets, a custom length, and reset. Opened from the bar or the workout header. */
export function RestTimerSheet({
  open,
  onClose,
  workoutId,
  defaultSeconds,
}: {
  open: boolean;
  onClose: () => void;
  workoutId: string | null;
  defaultSeconds: number;
}) {
  return open ? (
    <RestTimerSheetBody onClose={onClose} workoutId={workoutId} defaultSeconds={defaultSeconds} />
  ) : null;
}

function RestTimerSheetBody({
  onClose,
  workoutId,
  defaultSeconds,
}: {
  onClose: () => void;
  workoutId: string | null;
  defaultSeconds: number;
}) {
  const timer = useRestTimer();
  const now = useNow(250);
  const state = timer.data ?? null;
  const [custom, setCustom] = useState<number>(state?.durationSec ?? defaultSeconds);
  const left = state ? remainingMs(state, now) : 0;
  const paused = state?.pausedRemainingMs !== null && state?.pausedRemainingMs !== undefined;
  const start = async (s: number) => {
    await restActions.start(s, workoutId);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Rest timer"
      description="Runs while the app is open. Your phone may not alert you if the app is in the background."
    >
      <div className="flex flex-col items-center py-2">
        <Timer className="size-5 text-faint" aria-hidden />
        <p className="tabular mt-1 font-display text-[2.35rem] font-bold leading-none">
          {state ? formatClock(Math.ceil(left / 1000)) : formatClock(custom)}
        </p>
        {state ? (
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              icon={
                paused ? (
                  <Play className="size-4" aria-hidden />
                ) : (
                  <Pause className="size-4" aria-hidden />
                )
              }
              onClick={() => (paused ? restActions.resume(state) : restActions.pause(state))}
              disabled={!paused && left === 0}
            >
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="secondary"
              icon={<RotateCcw className="size-4" aria-hidden />}
              onClick={() => restActions.reset(state)}
            >
              Reset
            </Button>
            <Button variant="ghost" onClick={() => restActions.clear()}>
              Stop
            </Button>
          </div>
        ) : null}
      </div>

      <h3 className="mb-2 mt-5 text-sm font-medium text-muted">Start a new rest</h3>
      <div className="grid grid-cols-4 gap-2">
        {REST_PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => start(s)}
            className="tabular h-14 rounded-2xl border border-line bg-surface-2 font-display text-xl font-semibold transition-colors hover:border-accent-text"
          >
            {formatSeconds(s)}
          </button>
        ))}
      </div>
      <h3 className="mb-1 mt-6 text-sm font-medium text-muted">Custom length</h3>
      <DurationPicker label="Custom rest length" value={custom} min={5} onChange={setCustom} />
      <Button block className="mt-3" onClick={() => start(custom)}>
        Start {formatClock(custom)}
      </Button>
    </Sheet>
  );
}
