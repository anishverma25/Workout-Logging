import { memo, useRef, useState } from 'react';
import { unlockAudio } from '@/app/deviceSettings';
import { Check } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { completeSet, uncompleteSet, updateSet } from '@/data/repositories/workouts';
import { SET_TYPE_LABELS, SET_TYPE_SHORT } from '@/domain/models/labels';
import type { Preferences, TrackingType, WorkoutSet } from '@/domain/models/schemas';
import type { SetSuggestion } from '@/domain/workout/previous';
import { cn } from '@/lib/cn';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/units';
import { CellInput, type CellInputHandle } from './CellInput';
import { columnsFor, formatSetValues } from './format';
import { haptic } from '@/lib/haptics';

/** UI Part 6: Set 28, Last 72, then flexible inputs, and the 48px check. */
export const SET_GRID =
  'grid grid-cols-[28px_72px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_48px] items-center gap-1.5';
export const SET_GRID_NO_EFFORT =
  'grid grid-cols-[28px_72px_minmax(0,1fr)_minmax(0,1fr)_48px] items-center gap-1.5';

interface Props {
  set: WorkoutSet;
  /** "1", "2"... for working sets; letters for other types. */
  label: string;
  tracking: TrackingType;
  /** The load is one dumbbell or one side. */
  perHand?: boolean;
  /** Reps are logged for the left and right side apart. */
  bySide?: boolean;
  prefs: Preferences;
  previous: WorkoutSet | null;
  suggestion: SetSuggestion | null;
  /** Set while this exercise's history is still loading: fetches the suggestion on demand. */
  loadSuggestion?: () => Promise<SetSuggestion | null>;
  targetRir: number | null;
  onOpenOptions: (set: WorkoutSet) => void;
  /** Called after a set becomes done, with the set, to start rest. */
  onCompleted: (set: WorkoutSet) => void;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function SetRowImpl({
  set,
  label,
  tracking,
  perHand = false,
  bySide = false,
  prefs,
  previous,
  suggestion,
  loadSuggestion,
  targetRir,
  onOpenOptions,
  onCompleted,
}: Props) {
  const toast = useToast();
  const unit = prefs.weightUnit;
  const cols = columnsFor(tracking, unit);
  const done = set.completedAt !== null;
  const loadRef = useRef<CellInputHandle>(null);
  const amountRef = useRef<CellInputHandle>(null);
  const rightRef = useRef<CellInputHandle>(null);
  const sides = bySide && cols.amountField === 'reps';
  const effortRef = useRef<CellInputHandle>(null);
  const [pending, setPending] = useState(false);
  const effortKey = prefs.effortMetric;

  const cardio = tracking === 'cardio';
  const displayLoad = cardio
    ? set.durationSec === null
      ? null
      : round2(set.durationSec / 60)
    : set.weightKg === null
      ? null
      : round2(toDisplayWeight(set.weightKg, unit));
  const amount = cardio
    ? set.distanceM === null
      ? null
      : round2(set.distanceM / 1000)
    : set[cols.amountField];
  const typeLabel = SET_TYPE_SHORT[set.setType] || label;

  async function toggleDone() {
    if (pending) return;
    unlockAudio();
    setPending(true);
    try {
      if (done) {
        await uncompleteSet(db, set.id);
        return;
      }
      // Save anything still being typed before reading the set back.
      await Promise.all([
        loadRef.current?.flush(),
        amountRef.current?.flush(),
        rightRef.current?.flush(),
        effortRef.current?.flush(),
      ]);
      // A tap in the first moment after opening still uses last time's numbers.
      const fill = loadSuggestion ? await loadSuggestion() : suggestion;
      const result = await completeSet(db, set.id, fill);
      if (!result.ok) {
        toast(result.reason);
        return;
      }
      if (!result.alreadyCompleted) {
        haptic('medium');
        onCompleted(result.set);
      }
    } finally {
      setPending(false);
    }
  }

  async function copyPrevious() {
    if (!previous) return;
    await updateSet(db, set.id, {
      weightKg: tracking === 'bodyweight_reps' ? set.weightKg : previous.weightKg,
      reps: previous.reps,
      durationSec: previous.durationSec,
      distanceM: previous.distanceM,
      ...(sides
        ? {
            repsLeft: previous.repsLeft ?? previous.reps,
            repsRight: previous.repsRight ?? previous.reps,
          }
        : {}),
    });
  }

  const ghostLoad = cardio
    ? suggestion?.durationSec
      ? String(round2(suggestion.durationSec / 60))
      : undefined
    : suggestion?.weightKg !== null && suggestion?.weightKg !== undefined
      ? String(round2(toDisplayWeight(suggestion.weightKg, unit)))
      : undefined;
  const ghostAmount = cardio
    ? suggestion?.distanceM
      ? String(round2(suggestion.distanceM / 1000))
      : undefined
    : suggestion && suggestion[cols.amountField] !== null
      ? String(suggestion[cols.amountField])
      : undefined;

  return (
    <div
      className={cn(
        cols.showEffort ? SET_GRID : SET_GRID_NO_EFFORT,
        'rounded-field px-1.5 py-1 transition-colors duration-200',
        done && 'set-done bg-lime-dim',
      )}
    >
      <button
        type="button"
        onClick={() => onOpenOptions(set)}
        aria-label={`${SET_TYPE_LABELS[set.setType]} set ${label}, options`}
        className="tap-target pressable flex h-11 items-center justify-center"
      >
        <span
          className={cn(
            'type-caption tabular flex size-7 items-center justify-center rounded-full font-semibold transition-colors',
            done ? 'bg-lime text-on-lime' : 'bg-surface-2 text-text-2',
          )}
        >
          {typeLabel}
        </span>
      </button>

      <button
        type="button"
        onClick={copyPrevious}
        disabled={!previous}
        aria-label={
          previous
            ? `Last time ${formatSetValues(previous, tracking, unit)}. Copy into this set.`
            : 'No matching set last time'
        }
        className="type-meta tabular h-11 min-w-0 truncate rounded-tile px-1 text-left text-text-2 transition-colors enabled:hover:bg-surface-2 enabled:hover:text-text-1"
      >
        {previous ? formatSetValues(previous, tracking, unit, true) : 'New'}
      </button>

      <div>
        {cols.load ? (
          <CellInput
            ref={loadRef}
            label={
              cardio
                ? `Set ${typeLabel} minutes`
                : `Set ${typeLabel} load in ${unit}${perHand ? ', one dumbbell' : ''}`
            }
            value={displayLoad}
            placeholder={done ? undefined : ghostLoad}
            max={cardio ? 600 : tracking === 'weight_reps' ? 2000 : 500}
            step={cardio ? 1 : unit === 'kg' ? 2.5 : 5}
            done={done}
            onCommit={(v) =>
              cardio
                ? updateSet(db, set.id, {
                    durationSec: v === null ? null : Math.round(v * 60),
                  })
                : updateSet(db, set.id, {
                    weightKg: v === null ? null : fromDisplayWeight(v, unit),
                  })
            }
          />
        ) : (
          <span className="type-meta flex h-13 items-center justify-center font-medium text-text-2">
            {tracking === 'bodyweight_reps' ? 'BW' : ''}
          </span>
        )}
      </div>

      {sides ? (
        <div className="grid grid-cols-2 gap-1" data-side-reps>
          {(['left', 'right'] as const).map((side) => {
            const field = side === 'left' ? 'repsLeft' : 'repsRight';
            const ghost = suggestion?.[field] ?? suggestion?.reps ?? null;
            return (
              <CellInput
                key={side}
                ref={side === 'left' ? amountRef : rightRef}
                label={`Set ${typeLabel} reps, ${side} side`}
                value={set[field] ?? null}
                placeholder={done || ghost === null ? undefined : String(ghost)}
                allowDecimal={false}
                max={999}
                step={1}
                done={done}
                onCommit={(v) => updateSet(db, set.id, { [field]: v })}
              />
            );
          })}
        </div>
      ) : (
        <div>
          <CellInput
            ref={amountRef}
            label={`Set ${typeLabel} ${cols.amount === 'm' ? 'metres' : cols.amount === 'km' ? 'kilometres' : cols.amount.toLowerCase()}`}
            value={amount}
            placeholder={done ? undefined : ghostAmount}
            allowDecimal={cols.amountField === 'distanceM'}
            max={cardio ? 500 : cols.amountField === 'reps' ? 999 : 99_999}
            step={cardio ? 0.5 : cols.amountField === 'durationSec' ? 5 : 1}
            done={done}
            onCommit={(v) =>
              updateSet(
                db,
                set.id,
                cardio
                  ? { distanceM: v === null ? null : Math.round(v * 1000) }
                  : { [cols.amountField]: v },
              )
            }
          />
        </div>
      )}

      {cols.showEffort ? (
        <div>
          <CellInput
            ref={effortRef}
            label={`Set ${typeLabel} effort (${effortKey === 'rir' ? 'RIR' : 'RPE'})`}
            value={set[effortKey]}
            placeholder={
              !done && effortKey === 'rir' && targetRir !== null && set.setType !== 'warmup'
                ? String(targetRir)
                : undefined
            }
            min={effortKey === 'rir' ? 0 : 1}
            max={10}
            done={done}
            onCommit={(v) => updateSet(db, set.id, { [effortKey]: v })}
          />
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleDone}
          aria-pressed={done}
          aria-label={done ? `Set ${typeLabel} done. Tap to undo.` : `Mark set ${typeLabel} done`}
          className={cn(
            'chrome flex size-12 items-center justify-center rounded-field transition-[background-color,transform] duration-150 active:scale-[0.92]',
            done ? 'bg-lime text-on-lime' : 'bg-surface-2 text-text-2 hover:text-text-1',
          )}
        >
          <Check className={cn('size-5', done && 'set-check')} strokeWidth={3} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export const SetRow = memo(SetRowImpl);
