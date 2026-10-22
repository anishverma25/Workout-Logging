import { useMemo, useState } from 'react';
import { BottomSheet, NumberField, PrimaryButton, Switch } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { ActivityError, saveSteps } from '@/data/repositories/activity';
import { estimateSteps } from '@/domain/activity/burn';
import { EstimateNote } from './EstimateNote';

/** The day's steps: type the count, and either type the calories or let Overload estimate them. */
export function StepsSheet({
  open,
  onClose,
  date,
  weightKg,
  heightCm,
  current,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  current: { steps: number; kcal: number; typed: boolean } | null;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Steps">
      {open ? (
        <Body
          date={date}
          weightKg={weightKg}
          heightCm={heightCm}
          current={current}
          onDone={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function Body({
  date,
  weightKg,
  heightCm,
  current,
  onDone,
}: {
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  current: { steps: number; kcal: number; typed: boolean } | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const [steps, setSteps] = useState<number | null>(current?.steps ?? null);
  const [useTyped, setUseTyped] = useState(current?.typed ?? false);
  const [typed, setTyped] = useState<number | null>(current?.typed ? current.kcal : null);
  const [busy, setBusy] = useState(false);
  const estimate = useMemo(
    () => (weightKg && steps ? estimateSteps({ steps, weightKg, heightCm }) : null),
    [steps, weightKg, heightCm],
  );

  async function save() {
    if (!steps) return;
    setBusy(true);
    try {
      await saveSteps(
        db,
        { date, steps, typedKcal: useTyped ? typed : null },
        { weightKg, heightCm },
      );
      toast('Steps saved');
      onDone();
    } catch (e) {
      toast(e instanceof ActivityError ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      data-steps-form
    >
      <p className="type-body text-text-2">
        Copy the day&apos;s count from Apple Health, Google Fit or your watch. Overload cannot count
        steps by itself.
      </p>
      <NumberField
        label="Steps today"
        value={steps}
        onValueChange={setSteps}
        allowDecimal={false}
        min={1}
        max={200000}
        unit="steps"
        autoFocus
      />
      <div className="rounded-nested bg-surface-2 p-4" data-steps-estimate>
        {useTyped ? (
          <p className="type-meta text-text-2">Using the number you type below.</p>
        ) : estimate ? (
          <>
            <p className="type-headline tabular text-text-1">About {estimate.kcal} kcal</p>
            <p className="type-caption mt-0.5 text-text-2">{estimate.basis}</p>
          </>
        ) : weightKg ? (
          <p className="type-meta text-text-2">Enter your steps to see an estimate.</p>
        ) : (
          <p className="type-meta text-text-2">
            Add a weigh-in on the Body page to get an estimate, or type the calories below.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="type-body text-text-1" id="steps-typed-label">
          I have the calories from my watch or app
        </span>
        <Switch checked={useTyped} onChange={setUseTyped} aria-labelledby="steps-typed-label" />
      </div>
      {useTyped ? (
        <NumberField
          label="Calories burned from steps"
          value={typed}
          onValueChange={setTyped}
          allowDecimal={false}
          min={0}
          max={10000}
          unit="kcal"
        />
      ) : null}
      <p className="type-caption text-text-2">
        Your daily target already counts a normal day on your feet. If you also log a treadmill
        walk, leave those minutes out of your step count so they are not counted twice.
      </p>
      <EstimateNote />
      <PrimaryButton
        block
        type="submit"
        loading={busy}
        disabled={!steps || (useTyped ? typed === null : !estimate)}
      >
        Save steps
      </PrimaryButton>
    </form>
  );
}
