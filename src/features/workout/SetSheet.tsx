import { useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Fields';
import { NumberField } from '@/components/ui/NumberField';
import { Sheet } from '@/components/ui/Sheet';
import { db } from '@/data/db';
import { deleteSet, duplicateSet, updateSet } from '@/data/repositories/workouts';
import { SET_TYPE_LABELS } from '@/domain/models/labels';
import { SetType, type WorkoutSet } from '@/domain/models/schemas';
import { cn } from '@/lib/cn';

const TYPE_HINTS: Record<SetType, string> = {
  warmup: 'Excluded from volume, estimated 1RM and records',
  working: 'Your main sets',
  backoff: 'Lighter sets after the top set',
  drop: 'Weight reduced with little or no rest',
};

interface Props {
  set: WorkoutSet | null;
  label: string;
  exerciseName: string;
  onClose: () => void;
}

export function SetSheet(props: Props) {
  return props.set ? <SetOptions key={props.set.id} {...props} set={props.set} /> : null;
}

function SetOptions({ set, label, exerciseName, onClose }: Props & { set: WorkoutSet }) {
  const [notes, setNotes] = useState(set.notes ?? '');
  const title = label ? `Set ${label}` : SET_TYPE_LABELS[set.setType];
  return (
    <Sheet
      open
      onClose={() => {
        if ((set.notes ?? '') !== notes) void updateSet(db, set.id, { notes });
        onClose();
      }}
      title={title}
      description={exerciseName}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-muted">Set type</legend>
        <div className="grid grid-cols-2 gap-2">
          {SetType.options.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={set.setType === t}
              onClick={() => updateSet(db, set.id, { setType: t })}
              className={cn(
                'flex min-h-16 flex-col items-start justify-center rounded-2xl border px-3.5 py-2 text-left transition-colors',
                set.setType === t
                  ? 'border-accent-text/50 bg-accent-soft'
                  : 'border-line bg-surface-2/60 hover:border-line-strong',
              )}
            >
              <span className="font-semibold">{SET_TYPE_LABELS[t]}</span>
              <span className="text-xs leading-snug text-faint">{TYPE_HINTS[t]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <NumberField
          label="RIR (reps in reserve)"
          value={set.rir}
          min={0}
          max={10}
          onValueChange={(v) => void updateSet(db, set.id, { rir: v })}
        />
        <NumberField
          label="RPE (1 to 10)"
          value={set.rpe}
          min={1}
          max={10}
          onValueChange={(v) => void updateSet(db, set.id, { rpe: v })}
        />
      </div>
      <p className="mt-2 text-xs text-faint">
        Both are optional. RIR 2 is roughly RPE 8. Pick which one shows in the set table in
        Settings.
      </p>

      <TextArea
        label="Set notes"
        className="mt-4"
        value={notes}
        maxLength={300}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => void updateSet(db, set.id, { notes })}
        placeholder="Paused reps, felt easy, spotter helped"
      />

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          icon={<Copy className="size-4" aria-hidden />}
          onClick={async () => {
            await duplicateSet(db, set.id);
            onClose();
          }}
        >
          Duplicate
        </Button>
        <Button
          variant="danger"
          icon={<Trash2 className="size-4" aria-hidden />}
          onClick={async () => {
            await deleteSet(db, set.id);
            onClose();
          }}
        >
          Delete set
        </Button>
      </div>
    </Sheet>
  );
}
