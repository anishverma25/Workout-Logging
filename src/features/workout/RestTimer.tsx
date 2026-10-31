import { useEffect, useRef, useState } from 'react';
import { getDeviceSettings, playRestTone } from '@/app/deviceSettings';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
import { haptic } from '@/lib/haptics';
import { PrimaryButton, RestPicker, TextLink } from '@/components/kit';

/** "Go" shows for a second at zero, then the bar slides away (UI Part 6 D). */
const GO_MS = 1000;
const SLIDE_MS = 250;

/**
 * At zero: a medium haptic and the tones, each only if turned on in Settings and only while
 * the app is open. No promise of alerts in the background: browsers do not allow it reliably.
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
        if (settings.restVibrate) haptic('medium');
        if (settings.restSound) playRestTone();
      }
    }
  }, [finished, key]);
}

/** Floating pill above the tab bar while resting. Hidden when there is no timer. */
export function RestTimerBar({ onOpen }: { onOpen: () => void }) {
  const toast = useToast();
  const timer = useRestTimer();
  const now = useNow(250);
  const state = timer.data ?? null;
  useFinishSignal(state, now);

  const over = state?.endsAt ? now.getTime() - Date.parse(state.endsAt) : -1;
  const paused = state?.pausedRemainingMs != null;
  useEffect(() => {
    if (state && !paused && over >= GO_MS) void restActions.clear();
  }, [state, paused, over]);

  if (!state) return null;
  const left = remainingMs(state, now);
  const finished = !paused && left === 0;
  const leaving = finished && over >= GO_MS - SLIDE_MS;
  const progress = finished ? 1 : restProgress(state, now);
  const round =
    'pressable chrome type-meta tabular inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface font-semibold text-text-1';

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className={cn(
        'rest-bar pointer-events-auto relative mx-auto flex h-14 w-full max-w-md items-center gap-2 overflow-hidden rounded-full bg-surface-2 pl-1 pr-4',
        leaving && 'rest-bar-leave',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="pressable flex h-full min-w-0 flex-1 items-center gap-2 rounded-full pl-4 text-left"
        aria-label={
          finished ? 'Rest done. Open timer.' : `Rest ${formatClock(left / 1000)} left. Open timer.`
        }
      >
        <span aria-live="off" className="type-stat tabular text-text-1">
          {finished ? 'Go' : formatClock(Math.ceil(left / 1000))}
        </span>
        <span className="type-meta truncate text-text-2">
          {finished ? 'next set' : paused ? 'Paused' : `of ${formatSeconds(state.durationSec)}`}
        </span>
      </button>
      {!finished ? (
        <>
          <button
            type="button"
            onClick={() => restActions.adjust(state, -15)}
            className={round}
            aria-label="15 seconds less"
          >
            −15
          </button>
          <button
            type="button"
            onClick={() => restActions.adjust(state, 15)}
            className={round}
            aria-label="15 seconds more"
          >
            +15
          </button>
          <TextLink
            small
            aria-label="Skip rest"
            onClick={() => {
              toast(`Rested ${formatClock(restedSec(state, new Date()))}`);
              void restActions.clear();
            }}
          >
            Skip
          </TextLink>
        </>
      ) : null}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-lime transition-transform duration-300 ease-linear"
        style={{ transform: `scaleX(${1 - progress})` }}
      />
    </div>
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
        <Timer className="size-5 text-text-2" aria-hidden />
        <p className="type-display tabular mt-1 text-text-1">
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

      <h3 className="type-label mb-3 mt-6 text-text-2">Start a new rest</h3>
      <div className="grid grid-cols-4 gap-2">
        {REST_PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => start(s)}
            className="pressable chrome type-headline tabular h-13 rounded-field bg-surface-2 text-text-1"
          >
            {formatSeconds(s)}
          </button>
        ))}
      </div>
      <h3 className="type-label mb-3 mt-6 text-text-2">Custom length</h3>
      <RestPicker
        label="Custom rest length"
        value={custom}
        onChange={setCustom}
        presets={[]}
        defaultSeconds={defaultSeconds}
      />
      <PrimaryButton block className="mt-4" onClick={() => start(custom)}>
        Start {formatClock(custom)}
      </PrimaryButton>
    </Sheet>
  );
}
