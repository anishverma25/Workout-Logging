import { useState } from 'react';
import { BottomSheet, ChipGroup, PrimaryButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { addEvent, PlanError } from '@/data/repositories/plan';
import { EVENT_KINDS, EVENT_LABEL, type EventKind } from '@/domain/brain/life';
import { addDays, toDateKey } from '@/lib/dates';

/** What the plan does for each kind of week, in one line. */
export const EVENT_EFFECT_COPY: Record<EventKind, string> = {
  exams: 'Sessions of about 40 minutes and calories at maintenance while it lasts.',
  travel: 'Sessions of about 40 minutes and calories at maintenance while it lasts.',
  wedding: 'Calories at maintenance, so the week does not count against you.',
  festival: 'Calories at maintenance, so the week does not count against you.',
  vrat: 'No deficit and no added work on fast days, with foods that fit a vrat.',
  ramadan: 'No deficit, nothing added, and training after iftar.',
  sick: 'Rest first. No deficit, nothing added, missed sessions not counted.',
};

const fieldClass =
  'h-12 w-full rounded-field bg-surface-2 px-3 text-[16px] text-text-1 [color-scheme:dark]';

export function ComingUpSheet({ open, onClose, now }: { open: boolean; onClose: () => void; now: Date }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Coming up" subtitle="The plan works around it">
      {open ? <Form onClose={onClose} now={now} /> : null}
    </BottomSheet>
  );
}

function Form({ onClose, now }: { onClose: () => void; now: Date }) {
  const toast = useToast();
  const [kind, setKind] = useState<EventKind | null>(null);
  const [start, setStart] = useState(toDateKey(now));
  const [end, setEnd] = useState(toDateKey(addDays(now, 6)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!kind) {
      setError('Choose what is coming up.');
      return;
    }
    setSaving(true);
    try {
      await addEvent(db, { kind, start, end });
      toast('Added. Your weekly plan will work around it.');
      onClose();
    } catch (e) {
      setError(e instanceof PlanError ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5" data-coming-up-form>
      <ChipGroup
        label="What is coming up"
        value={kind}
        onChange={(v) => {
          setKind(v);
          setError(null);
        }}
        options={EVENT_KINDS.map((k) => ({ value: k, label: EVENT_LABEL[k].en }))}
      />
      {kind ? <p className="type-subhead text-text-2">{EVENT_EFFECT_COPY[kind]}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="type-footnote text-text-2">First day</span>
          <input
            type="date"
            className={fieldClass}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (e.target.value > end) setEnd(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="type-footnote text-text-2">Last day</span>
          <input
            type="date"
            className={fieldClass}
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="type-footnote text-danger-text">
          {error}
        </p>
      ) : null}
      <PrimaryButton block loading={saving} onClick={() => void save()} data-coming-up-save>
        Add to my plan
      </PrimaryButton>
    </div>
  );
}
