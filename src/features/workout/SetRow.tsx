import { memo, useRef, useState } from 'react';
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
import { columnsFor, formatSetValues, SET_TYPE_STYLES } from './format';

/** Sized so a 360px phone still shows last time's set in full ("102.5 × 10"). */
export const SET_GRID =
  'grid grid-cols-[1.6rem_minmax(0,1fr)_3.9rem_3.1rem_2.6rem_2.75rem] items-center gap-[5px]';
export const SET_GRID_NO_EFFORT =
  'grid grid-cols-[1.75rem_minmax(0,1fr)_4.5rem_4rem_2.75rem] items-center gap-[5px]';

interface Props {
  set: WorkoutSet;
  /** "1", "2"... for working sets; letters for other types. */
  label: string;
  tracking: TrackingType;
  prefs: Preferences;
  previous: WorkoutSet | null;
  suggestion: SetSuggestion | null;
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
  prefs,
  previous,
  suggestion,
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
  const effortRef = useRef<CellInputHandle>(null);
  const [pending, setPending] = useState(false);
  const effortKey = prefs.effortMetric;

  const displayLoad = set.weightKg === null ? null : round2(toDisplayWeight(set.weightKg, unit));
  const amount = set[cols.amountField];
  const typeLabel = SET_TYPE_SHORT[set.setType] || label;

  async function toggleDone() {
    if (pending) return;
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
        effortRef.current?.flush(),
      ]);
      const result = await completeSet(db, set.id, suggestion);
      if (!result.ok) {
        toast(result.reason);
        return;
      }
      if (!result.alreadyCompleted) {
        navigator.vibrate?.(12);
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
    });
  }

  const ghostLoad =
    suggestion?.weightKg !== null && suggestion?.weightKg !== undefined
      ? String(round2(toDisplayWeight(suggestion.weightKg, unit)))
      : undefined;
  const ghostAmount =
    suggestion && suggestion[cols.amountField] !== null
      ? String(suggestion[cols.amountField])
      : undefined;

  return (
    <div
      className={cn(
        cols.showEffort ? SET_GRID : SET_GRID_NO_EFFORT,
        'rounded-xl px-1 py-1 transition-colors duration-200',
        done && 'set-done bg-accent-soft',
      )}
    >
      <button
        type="button"
        onClick={() => onOpenOptions(set)}
        aria-label={`${SET_TYPE_LABELS[set.setType]} set ${label}, options`}
        className={cn(
          'tabular flex h-11 items-center justify-center rounded-lg font-display text-[1.05rem] font-bold transition-colors hover:bg-surface-2',
          SET_TYPE_STYLES[set.setType],
          done && set.setType === 'working' && 'text-text',
        )}
      >
        {typeLabel}
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
        className="tabular h-11 min-w-0 truncate rounded-lg px-1 text-left text-[0.92rem] text-faint transition-colors enabled:hover:bg-surface-2 enabled:hover:text-text"
      >
        {previous ? formatSetValues(previous, tracking, unit, true) : <span aria-hidden>·</span>}
      </button>

      <div>
        {cols.load ? (
          <CellInput
            ref={loadRef}
            label={`Set ${typeLabel} load in ${unit}`}
            value={displayLoad}
            placeholder={done ? undefined : ghostLoad}
            max={tracking === 'weight_reps' ? 2000 : 500}
            done={done}
            onCommit={(v) =>
              updateSet(db, set.id, { weightKg: v === null ? null : fromDisplayWeight(v, unit) })
            }
          />
        ) : (
          <span className="flex h-11 items-center justify-center text-sm font-medium text-faint">
            {tracking === 'bodyweight_reps' ? 'BW' : ''}
          </span>
        )}
      </div>

      <div>
        <CellInput
          ref={amountRef}
          label={`Set ${typeLabel} ${cols.amount === 'm' ? 'metres' : cols.amount.toLowerCase()}`}
          value={amount}
          placeholder={done ? undefined : ghostAmount}
          allowDecimal={cols.amountField === 'distanceM'}
          max={cols.amountField === 'reps' ? 999 : 99_999}
          done={done}
          onCommit={(v) => updateSet(db, set.id, { [cols.amountField]: v })}
        />
      </div>

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
            className="text-[1.05rem]"
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
            'flex size-11 items-center justify-center rounded-xl border-2 transition-[background-color,border-color,transform] duration-150 active:scale-90',
            done
              ? 'set-check border-accent bg-accent text-accent-ink'
              : 'border-line-strong bg-surface-2 text-faint hover:border-accent-text hover:text-accent-text',
          )}
        >
          <Check className="size-5" strokeWidth={3} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export const SetRow = memo(SetRowImpl);
