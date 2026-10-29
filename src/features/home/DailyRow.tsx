import { useMemo, useState } from 'react';
import { Droplets, Plus, Scale } from 'lucide-react';
import { BottomSheet, InlineNotice, NumberField, PrimaryButton } from '@/components/kit';
import { Sparkline } from '@/components/ui/Sparkline';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { useWaterData } from '@/data/hooks';
import { addBodyWeight, BodyWeightError, updateBodyWeight } from '@/data/repositories/bodyweight';
import { addWater, deleteWaterLogs } from '@/data/repositories/water';
import type { BodyWeightEntry } from '@/domain/models/schemas';
import { DEFAULT_GLASS_ML, toGlasses, waterOn } from '@/domain/nutrition/water';
import { toDateKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';

const round1 = (v: number) => Math.round(v * 10) / 10;
const TREND_DAYS = 30;

/**
 * The two things people log first thing in the morning, right on Home: today's weight in two
 * taps (the field opens with yesterday's number) and a glass of water in one. Small tiles
 * inside the food card, so Home does not grow a new section.
 */
export function DailyRow({
  weights,
  unit,
  glassMl,
  waterTargetMl,
  now,
}: {
  weights: BodyWeightEntry[];
  unit: WeightUnit;
  glassMl: number | null;
  waterTargetMl: number | null;
  now: Date;
}) {
  const toast = useToast();
  const water = useWaterData();
  const [weighing, setWeighing] = useState(false);
  const today = toDateKey(now);
  const glass = glassMl ?? DEFAULT_GLASS_ML;

  const alive = useMemo(
    () =>
      weights
        .filter((w) => w.deletedAt === null)
        .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [weights],
  );
  const latest = alive.at(-1) ?? null;
  const todays = latest && toDateKey(new Date(latest.measuredAt)) === today ? latest : null;
  const since = now.getTime() - TREND_DAYS * 86_400_000;
  const trend = alive
    .filter((w) => new Date(w.measuredAt).getTime() >= since)
    .map((w) => toDisplayWeight(w.weightKg, unit));

  const drunk = water.status === 'success' ? waterOn(water.data ?? [], today) : 0;
  const glasses = toGlasses(drunk, glass);
  const targetGlasses = waterTargetMl ? Math.round(waterTargetMl / glass) : null;

  async function addGlass() {
    const added = await addWater(db, { date: today, ml: glass });
    haptic('light');
    toast('Added a glass of water', {
      label: 'Undo',
      onSelect: () =>
        void deleteWaterLogs(
          db,
          added.map((l) => l.id),
        ),
    });
  }

  const tile =
    'flex min-h-16 min-w-0 items-center gap-2.5 rounded-nested bg-surface-2 py-2.5 pr-2 pl-3';
  return (
    <div className="mt-4 grid grid-cols-2 gap-2" data-daily-row>
      <button
        type="button"
        onClick={() => setWeighing(true)}
        className={`pressable chrome ${tile} text-left`}
        aria-label={
          todays
            ? `Weight today ${formatWeightValue(todays.weightKg, unit)} ${unit}. Change it`
            : 'Log your weight today'
        }
        data-home-weight
      >
        <Scale className="size-4 shrink-0 text-text-2" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="type-caption block text-text-2">
            {todays ? 'Weight today' : 'Weight'}
          </span>
          {todays ? (
            <span className="type-headline tabular block truncate text-text-1">
              {formatWeightValue(todays.weightKg, unit)}
              <span className="type-caption ml-0.5 font-normal text-text-2">{unit}</span>
            </span>
          ) : (
            <span className="type-headline block truncate text-text-1">Log today</span>
          )}
        </span>
        {trend.length >= 2 ? (
          // A small trend that never pushes the number out of the tile.
          <span className="block h-7 w-12 shrink-0 overflow-hidden [&>svg]:h-full [&>svg]:w-full">
            <Sparkline values={trend} label={`Body weight over the last ${TREND_DAYS} days`} />
          </span>
        ) : null}
      </button>

      <div className={tile} data-home-water>
        <Droplets className="size-4 shrink-0 text-text-2" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="type-caption block text-text-2">Water, glasses</span>
          <span className="type-headline tabular block text-text-1">
            {glasses}
            {targetGlasses ? (
              <span className="type-caption ml-0.5 font-normal text-text-2">
                {' '}
                of {targetGlasses}
              </span>
            ) : null}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void addGlass()}
          aria-label={`Add a glass of water (${glass} ml)`}
          className="pressable tap-target inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime"
          data-home-add-water
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>

      <WeighInSheet
        open={weighing}
        today={todays}
        lastKg={latest?.weightKg ?? null}
        unit={unit}
        onClose={() => setWeighing(false)}
      />
    </div>
  );
}

function WeighInSheet(props: {
  open: boolean;
  today: BodyWeightEntry | null;
  lastKg: number | null;
  unit: WeightUnit;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={props.open}
      onClose={props.onClose}
      title={props.today ? 'Weight today' : 'Log your weight'}
      subtitle="First thing in the morning, before eating, is the most comparable."
    >
      {props.open ? <WeighInForm {...props} /> : null}
    </BottomSheet>
  );
}

function WeighInForm({
  today,
  lastKg,
  unit,
  onClose,
}: {
  today: BodyWeightEntry | null;
  lastKg: number | null;
  unit: WeightUnit;
  onClose: () => void;
}) {
  const toast = useToast();
  const start = today?.weightKg ?? lastKg;
  const [weight, setWeight] = useState<number | null>(
    start !== null ? round1(toDisplayWeight(start, unit)) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      // One weigh-in a day from here: a second one today corrects the first.
      const input = { weight: weight ?? NaN, unit, date: toDateKey(new Date()), note: null };
      if (today) await updateBodyWeight(db, today.id, { ...input, note: today.note });
      else await addBodyWeight(db, input);
      haptic('medium');
      toast(today ? 'Weight updated' : 'Weight saved');
      onClose();
    } catch (err) {
      setError(err instanceof BodyWeightError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <NumberField
        label={`Weight in ${unit}`}
        value={weight}
        onValueChange={setWeight}
        unit={unit}
        min={unit === 'kg' ? 20 : 44}
        max={unit === 'kg' ? 400 : 880}
        data-autofocus
        enterKeyHint="done"
      />
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      <PrimaryButton type="submit" block disabled={busy || weight === null} data-save-weight>
        {today ? 'Update' : 'Save'}
      </PrimaryButton>
    </form>
  );
}
