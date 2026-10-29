import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  BottomSheet,
  ChipGroup,
  InlineNotice,
  PrimaryButton,
  SegmentedControl,
  TextField,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { saveWorkoutAsRoutine } from '@/data/repositories/routineShare';
import type { Routine, RoutineDay } from '@/domain/models/schemas';
import { readableError } from '@/lib/errors';

const MAX_DAYS = 7;

/**
 * A workout someone liked (often an empty workout started on the spot) kept as a plan: a new
 * routine of that one day, or one more day of a routine they already have. The workout itself
 * stays as it was.
 */
export function SaveAsRoutineSheet(props: {
  open: boolean;
  workoutId: string;
  workoutName: string;
  routines: Routine[];
  routineDays: RoutineDay[];
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={props.open}
      onClose={props.onClose}
      title="Save as a routine"
      subtitle="The same exercises in the same order, with the sets and reps you did."
    >
      {props.open ? <Form {...props} /> : null}
    </BottomSheet>
  );
}

function Form({
  workoutId,
  workoutName,
  routines,
  routineDays,
  onClose,
}: {
  workoutId: string;
  workoutName: string;
  routines: Routine[];
  routineDays: RoutineDay[];
  onClose: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const mine = routines.filter((r) => r.deletedAt === null);
  const dayCount = (id: string) =>
    routineDays.filter((d) => d.routineId === id && d.deletedAt === null).length;
  const [kind, setKind] = useState<'new' | 'day'>('new');
  const [name, setName] = useState(workoutName);
  const [routineId, setRoutineId] = useState<string | null>(
    mine.find((r) => r.isActive && dayCount(r.id) < MAX_DAYS)?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { routine } = await saveWorkoutAsRoutine(
        db,
        workoutId,
        kind === 'new' ? { kind: 'new', name } : { kind: 'day', routineId: routineId! },
      );
      toast(kind === 'new' ? `Saved as ${routine.name}` : `Added as a day of ${routine.name}`);
      onClose();
      navigate(`/routines/${routine.id}`);
    } catch (err) {
      setError(readableError(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4" data-save-as-routine>
      {mine.length ? (
        <SegmentedControl
          label="Where to save it"
          block
          value={kind}
          onChange={setKind}
          options={[
            { value: 'new', label: 'New routine' },
            { value: 'day', label: 'Add to a routine' },
          ]}
        />
      ) : null}
      {kind === 'new' ? (
        <TextField
          label="Routine name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      ) : (
        <ChipGroup
          label="Routine"
          value={routineId}
          onChange={setRoutineId}
          options={mine.map((r) => ({
            value: r.id,
            label: dayCount(r.id) >= MAX_DAYS ? `${r.name} (full)` : r.name,
            disabled: dayCount(r.id) >= MAX_DAYS,
          }))}
        />
      )}
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      <PrimaryButton
        block
        onClick={() => void save()}
        disabled={busy || (kind === 'new' ? !name.trim() : !routineId)}
        data-save-routine
      >
        {busy ? 'Saving…' : 'Save'}
      </PrimaryButton>
    </div>
  );
}
