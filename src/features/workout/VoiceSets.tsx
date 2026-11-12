import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import type { WorkoutExerciseView } from '@/data/repositories/workoutView';
import { addSet, completeSet, uncompleteSet, updateSet } from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/domain/models/schemas';
import { matchSpokenExercise, parseSpokenSet, type Spoken } from '@/domain/workout/voice';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { fromDisplayWeight, toDisplayWeight, type WeightUnit } from '@/lib/units';
import { listenPatiently, speechProblem, speechRecognition } from '../food/speech';

/** Listening goes on through pauses of this long, for up to this long in all. */
const SET_PATIENCE_MS = 2500;
const SET_LISTEN_MAX_MS = 20_000;

const LB_TO_KG = 0.45359237;
const trim = (v: number) => String(Math.round(v * 100) / 100);

/**
 * What saying a set does to the workout. Kept apart from the microphone so it can be tested by
 * typing: returns the line to show, or null when nothing was understood.
 */
export async function applySpoken(
  spoken: Spoken,
  ctx: {
    exercises: WorkoutExerciseView[];
    activeId: string | null;
    unit: WeightUnit;
    onSetCompleted: (set: WorkoutSet, view: WorkoutExerciseView) => void;
  },
): Promise<{ message: string; undo?: () => void } | null> {
  const lifts = ctx.exercises.filter((e) => (e.exercise?.trackingType ?? 'weight_reps') !== 'cardio');
  const named =
    spoken.kind === 'set' && spoken.exercise
      ? matchSpokenExercise(
          spoken.exercise,
          lifts.map((e) => ({ name: e.workoutExercise.exerciseName, view: e })),
        )?.view
      : null;
  if (spoken.kind === 'set' && spoken.exercise && !named)
    return { message: `No exercise in this workout matches "${spoken.exercise}".` };
  const view =
    named ??
    lifts.find((e) => e.workoutExercise.id === ctx.activeId) ??
    lifts.find((e) => e.sets.some((s) => s.completedAt === null)) ??
    lifts.at(-1);
  if (!view) return { message: 'Add an exercise first.' };
  const name = view.workoutExercise.exerciseName;
  const done = view.sets.filter((s) => s.completedAt !== null);

  let weightKg: number | null;
  let reps: number | null;
  let sure: boolean;
  if (spoken.kind === 'same') {
    const last = done.at(-1);
    if (!last) return { message: `No set of ${name} to repeat yet.` };
    weightKg = last.weightKg;
    reps = last.reps;
    sure = true;
  } else {
    weightKg =
      spoken.weight === null
        ? null
        : spoken.unit === 'lb'
          ? spoken.weight * LB_TO_KG
          : spoken.unit === 'kg'
            ? spoken.weight
            : fromDisplayWeight(spoken.weight, ctx.unit);
    reps = spoken.reps;
    sure = spoken.sure;
  }
  const open = view.sets.find((s) => s.completedAt === null) ?? (await addSet(db, view.workoutExercise.id));
  const patch: { weightKg?: number; reps?: number } = {};
  if (weightKg !== null) patch.weightKg = Math.round(weightKg * 100) / 100;
  if (reps !== null) patch.reps = reps;
  await updateSet(db, open.id, patch);
  const shown = `${weightKg !== null ? `${trim(toDisplayWeight(weightKg, ctx.unit))} ${ctx.unit}` : ''}${
    weightKg !== null && reps !== null ? ' × ' : ''
  }${reps !== null ? reps : ''}`;
  if (!sure) return { message: `${name}: ${shown} filled in. Tap the tick to confirm.` };
  const result = await completeSet(db, open.id);
  if (!result.ok) return { message: `${name}: ${shown} filled in. ${result.reason}` };
  haptic('medium');
  if (!result.alreadyCompleted) ctx.onSetCompleted(result.set, view);
  return {
    message: `${name}: ${shown} logged`,
    undo: () => void uncompleteSet(db, open.id),
  };
}

/**
 * Voice sets (free): a mic in the logger. Say "80 kilo 8 reps", "80 ke 8" or "same again" and
 * the next set of the exercise you are on is filled in. A clear sentence is ticked off, with
 * Undo; an unclear one is only filled in and waits for a tap.
 */
export function VoiceSets(props: {
  exercises: WorkoutExerciseView[];
  activeId: string | null;
  unit: WeightUnit;
  onSetCompleted: (set: WorkoutSet, view: WorkoutExerciseView) => void;
}) {
  const toast = useToast();
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const rec = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => () => rec.current?.abort(), []);

  const say = useCallback(
    async (text: string) => {
      const spoken = parseSpokenSet(text);
      if (!spoken) {
        toast(`Heard "${text}". Say it like "80 kilo 8 reps" or "same again".`);
        return;
      }
      const result = await applySpoken(spoken, latest.current);
      if (result) toast(result.message, result.undo ? { label: 'Undo', onSelect: result.undo } : undefined);
    },
    [toast],
  );

  // Typed words go through the same path: for testing, and for a phone that cannot listen.
  useEffect(() => {
    const w = window as unknown as { __overloadVoice?: (text: string) => Promise<void> };
    if (import.meta.env.MODE === 'e2e' || import.meta.env.DEV) w.__overloadVoice = say;
    return () => {
      delete w.__overloadVoice;
    };
  }, [say]);

  const Recognition = speechRecognition();
  if (!Recognition) return null;

  const start = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const done = () => {
      setListening(false);
      setHeard('');
      rec.current = null;
    };
    rec.current = listenPatiently(Recognition, {
      // "80 kilo ... 8 reps": a breath between the two does not end it.
      patienceMs: SET_PATIENCE_MS,
      maxMs: SET_LISTEN_MAX_MS,
      onText: (final, interim) => setHeard([final, interim].filter(Boolean).join(' ')),
      onEnd: (final, alternatives) => {
        done();
        // The phone's first guess, or another way it heard the last words when that one fits.
        const understood = [final, ...alternatives].find((t) => parseSpokenSet(t)) ?? final;
        void say(understood);
      },
      onError: (code) => {
        done();
        if (code !== 'stopped') toast(speechProblem(code));
      },
    });
    haptic('light');
    setListening(true);
  };

  return (
    <div className="pointer-events-none fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 lg:right-10 lg:bottom-8">
      {listening ? (
        <span
          className="type-subhead max-w-[60vw] truncate rounded-full bg-surface-2 px-4 py-2.5 text-text-1 shadow-lg"
          role="status"
          aria-live="polite"
        >
          {heard || 'Listening: "80 kilo 8 reps"'}
        </span>
      ) : null}
      <button
        type="button"
        onClick={start}
        data-keep-keyboard
        data-voice-sets
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Log a set by voice'}
        className={cn(
          'pressable chrome tap-target pointer-events-auto flex size-14 items-center justify-center rounded-full shadow-lg',
          listening ? 'bg-lime text-on-lime' : 'bg-surface-2 text-text-1',
        )}
      >
        {listening ? <MicOff className="size-6" aria-hidden /> : <Mic className="size-6" aria-hidden />}
      </button>
    </div>
  );
}
