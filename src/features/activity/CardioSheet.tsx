import { useState } from 'react';
import {
  BottomSheet,
  ChipGroup,
  NumberField,
  PrimaryButton,
  SegmentedControl,
  Switch,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { ActivityError, addCardio, deleteActivity } from '@/data/repositories/activity';
import { CARDIO_KINDS, estimateCardio, kindOf, type Effort } from '@/domain/activity/burn';
import type { CardioActivity } from '@/domain/models/schemas';
import { EstimateNote } from './EstimateNote';

const EFFORT_LABEL: Record<Effort, string> = { light: 'Light', moderate: 'Moderate', hard: 'Hard' };

/** Log a cardio session: pick the machine, say how long, and see the estimate as you type. */
export function CardioSheet({
  open,
  onClose,
  date,
  weightKg,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  weightKg: number | null;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Add cardio" tall>
      {open ? <Body date={date} weightKg={weightKg} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function Body({
  date,
  weightKg,
  onDone,
}: {
  date: string;
  weightKg: number | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const [activity, setActivity] = useState<CardioActivity>('treadmill_walk');
  const [minutes, setMinutes] = useState<number | null>(30);
  const [speed, setSpeed] = useState<number | null>(null);
  const [incline, setIncline] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [watts, setWatts] = useState<number | null>(null);
  const [effort, setEffort] = useState<Effort>('moderate');
  const [useTyped, setUseTyped] = useState(false);
  const [typed, setTyped] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const kind = kindOf(activity);
  const efforts = kind.efforts;
  const chosenEffort = efforts.includes(effort) ? effort : (efforts[0] ?? null);

  const estimate =
    weightKg && minutes
      ? estimateCardio({
          activity,
          minutes,
          weightKg,
          speedKmh: speed,
          inclinePct: incline,
          distanceKm: distance,
          watts,
          effort: chosenEffort,
        })
      : null;

  async function save() {
    if (!minutes) return;
    setBusy(true);
    try {
      const log = await addCardio(
        db,
        {
          date,
          activity,
          minutes,
          speedKmh: speed,
          inclinePct: incline,
          distanceKm: distance,
          watts,
          effort: chosenEffort,
          typedKcal: useTyped ? typed : null,
        },
        { weightKg },
      );
      onDone();
      toast(`${kind.label} saved`, {
        label: 'Undo',
        onSelect: () => void deleteActivity(db, [log.id]),
      });
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
      data-cardio-form
    >
      <ChipGroup
        label="What did you do"
        options={CARDIO_KINDS.map((k) => ({ value: k.id, label: k.label }))}
        value={activity}
        onChange={setActivity}
      />
      <NumberField
        label="Minutes"
        value={minutes}
        onValueChange={setMinutes}
        allowDecimal={false}
        min={1}
        max={1000}
        unit="min"
      />
      {kind.inputs.length ? (
        <div className="grid grid-cols-2 gap-3">
          {kind.inputs.includes('speed') ? (
            <NumberField
              label="Speed"
              value={speed}
              onValueChange={setSpeed}
              min={0.5}
              max={30}
              unit="km/h"
              placeholder="optional"
            />
          ) : null}
          {kind.inputs.includes('incline') ? (
            <NumberField
              label="Incline"
              value={incline}
              onValueChange={setIncline}
              min={0}
              max={40}
              unit="%"
              placeholder="optional"
            />
          ) : null}
          {kind.inputs.includes('distance') ? (
            <NumberField
              label="Distance"
              value={distance}
              onValueChange={setDistance}
              min={0}
              max={500}
              unit="km"
              placeholder="optional"
            />
          ) : null}
          {kind.inputs.includes('watts') ? (
            <NumberField
              label="Average power"
              value={watts}
              onValueChange={setWatts}
              allowDecimal={false}
              min={10}
              max={1000}
              unit="W"
              placeholder="optional"
            />
          ) : null}
        </div>
      ) : null}
      {efforts.length > 1 ? (
        <SegmentedControl<Effort>
          label="How hard was it"
          block
          value={chosenEffort ?? 'moderate'}
          onChange={setEffort}
          options={efforts.map((v) => ({ value: v, label: EFFORT_LABEL[v] }))}
        />
      ) : null}

      <div className="rounded-nested bg-surface-2 p-4" data-cardio-estimate>
        {useTyped ? (
          <p className="type-meta text-text-2">Using the number you type below.</p>
        ) : estimate ? (
          <>
            <p className="type-headline tabular text-text-1">About {estimate.kcal} kcal</p>
            <p className="type-caption mt-0.5 text-text-2">{estimate.basis}</p>
          </>
        ) : weightKg ? (
          <p className="type-meta text-text-2">Enter the minutes to see an estimate.</p>
        ) : (
          <p className="type-meta text-text-2">
            Add a weigh-in on the Body page to get an estimate, or type the calories below.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="type-body text-text-1" id="typed-kcal-label">
          I have a number from my watch, app or machine
        </span>
        <Switch checked={useTyped} onChange={setUseTyped} aria-labelledby="typed-kcal-label" />
      </div>
      {useTyped ? (
        <NumberField
          label="Calories burned"
          value={typed}
          onValueChange={setTyped}
          allowDecimal={false}
          min={0}
          max={10000}
          unit="kcal"
        />
      ) : null}

      <EstimateNote />
      <PrimaryButton
        block
        type="submit"
        loading={busy}
        disabled={!minutes || (useTyped ? typed === null : !estimate)}
      >
        Save cardio
      </PrimaryButton>
    </form>
  );
}
