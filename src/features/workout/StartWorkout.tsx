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
} from '@/data/repositories/workouts';

type Start = (dayId: string | null) => Promise<void>;

const StartContext = createContext<Start>(async () => {});

/**
 * One place that starts workouts, so every Start button behaves the same:
 * it creates the workout, opens the logger, and if a workout is already running it asks
 * whether to resume it or discard it, instead of silently creating a second one.
 */
export function StartWorkoutProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [conflict, setConflict] = useState<{ activeId: string; dayId: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback<Start>(
    async (dayId) => {
      try {
        if (dayId) await startWorkoutFromDay(db, dayId);
        else await startEmptyWorkout(db);
        navigate('/workout');
      } catch (err) {
        if (err instanceof ActiveWorkoutExistsError) {
          setConflict({ activeId: err.workoutId, dayId });
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
            await start(conflict.dayId);
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
