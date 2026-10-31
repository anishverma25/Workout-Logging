import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmSheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import {
  ActiveWorkoutExistsError,
  cancelWorkout,
  startEmptyWorkout,
  startWorkoutFromDay,
  startWorkoutFromPast,
} from '@/data/repositories/workouts';

/** A routine day's id, null for an empty workout, or a past workout to do again. */
type Source = string | null | { fromWorkoutId: string };
type Start = (source: Source) => Promise<void>;

const StartContext = createContext<Start>(async () => {});

/**
 * One place that starts workouts, so every Start button behaves the same:
 * it creates the workout, opens the logger, and if a workout is already running it asks
 * whether to resume it or discard it, instead of silently creating a second one.
 */
export function StartWorkoutProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [conflict, setConflict] = useState<{ activeId: string; source: Source } | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback<Start>(
    async (source) => {
      try {
        if (source && typeof source === 'object')
          await startWorkoutFromPast(db, source.fromWorkoutId);
        else if (source) await startWorkoutFromDay(db, source);
        else await startEmptyWorkout(db);
        navigate('/workout');
      } catch (err) {
        if (err instanceof ActiveWorkoutExistsError) {
          setConflict({ activeId: err.workoutId, source });
        } else {
          toast(err instanceof Error ? err.message : 'Could not start the workout');
        }
      }
    },
    [navigate, toast],
  );

  return (
    <StartContext.Provider value={start}>
      {children}
      <ConfirmSheet
        open={!!conflict}
        title="A workout is already in progress"
        body="Resume it to keep logging, or discard it and start the new one. Discarding deletes every set logged in it."
        confirmLabel="Discard and start new"
        cancelLabel="Resume it"
        danger
        busy={busy}
        onClose={() => {
          setConflict(null);
          navigate('/workout');
        }}
        onConfirm={async () => {
          if (!conflict) return;
          setBusy(true);
          try {
            await cancelWorkout(db, conflict.activeId);
            setConflict(null);
            await start(conflict.source);
          } finally {
            setBusy(false);
          }
        }}
      />
    </StartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useStartWorkout = () => useContext(StartContext);
