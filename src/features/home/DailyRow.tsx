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

  return (
    <div className="divide-y-[0.5px] divide-divider" data-daily-row>
      <section aria-label="Body weight" className="flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={() => setWeighing(true)}
          className="pressable chrome flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={
            todays
              ? `Weight today ${formatWeightValue(todays.weightKg, unit)} ${unit}. Change it`
              : latest
                ? `Weight ${formatWeightValue(latest.weightKg, unit)} ${unit}. Log today's weight`
                : 'Log your weight today'
          }
          data-home-weight
        >
          <RowIcon>
            <Scale className="size-4" aria-hidden />
          </RowIcon>
          <span className="min-w-0 flex-1">
            {latest ? (
              <span className="type-headline block whitespace-nowrap text-text-1">
                <span className="type-metric-sm">
                  {formatWeightValue((todays ?? latest).weightKg, unit)}
                </span>
                <span className="ml-1 text-[0.8125rem] font-medium text-text-2">{unit}</span>
              </span>
            ) : (
              <span className="type-headline block text-text-1">Weight</span>
            )}
            <span className="type-subhead block truncate text-text-2">
              {todays ? 'Weight today' : latest ? 'Tap to log today' : 'Log today'}
            </span>
          </span>
          {trend.length >= 2 ? (
            // A small trend that never pushes the number out of the row.
            <span className="block h-7 w-14 shrink-0 overflow-hidden [&>svg]:h-full [&>svg]:w-full">
              <Sparkline values={trend} label={`Body weight over the last ${TREND_DAYS} days`} />
            </span>
          ) : null}
        </button>
      </section>

      <div className="flex items-center gap-3 py-3" data-home-water>
        <RowIcon>
          <Droplets className="size-4" aria-hidden />
        </RowIcon>
        <span className="min-w-0 flex-1">
          <span className="type-headline block text-text-1">
            <span className="type-metric-sm">{glasses}</span>{' '}
            <span className="font-normal text-text-2">
              {targetGlasses ? `of ${targetGlasses} glasses` : glasses === 1 ? 'glass' : 'glasses'}
            </span>
          </span>
          <span className="type-subhead block text-text-2">Water today</span>
        </span>
        <button
          type="button"
          onClick={() => void addGlass()}
          aria-label={`Add a glass of water (${glass} ml)`}
          className="pressable chrome tap-target type-subhead inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill px-3.5 font-semibold text-text-1"
          data-home-add-water
        >
          <Plus className="size-4" aria-hidden />
          {glass} ml
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

/** The 30px leading icon tile of a Home row. */
function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-fill text-text-1">
      {children}
    </span>
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
      <div className="flex items-end gap-2">
        <NumberField
          label={`Weight in ${unit}`}
          value={weight}
          onValueChange={setWeight}
          unit={unit}
          min={unit === 'kg' ? 20 : 44}
          max={unit === 'kg' ? 400 : 880}
          data-autofocus
          enterKeyHint="done"
          className="min-w-0 flex-1"
        />
        {/* A tenth up or down from the last weight, without the keyboard (UI v3, O2). */}
        {[-0.1, 0.1].map((d) => (
          <button
            key={d}
            type="button"
            data-keep-keyboard
            disabled={weight === null}
            onClick={() => setWeight((w) => (w === null ? w : Math.round((w + d) * 10) / 10))}
            aria-label={`${d < 0 ? 'Down' : 'Up'} 0.1 ${unit}`}
            className="pressable chrome type-subhead tabular h-12 w-14 shrink-0 rounded-field bg-fill font-semibold text-text-1 disabled:text-text-3"
            data-weight-step={d}
          >
            {d < 0 ? '−0.1' : '+0.1'}
          </button>
        ))}
      </div>
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      <PrimaryButton type="submit" block disabled={busy || weight === null} data-save-weight>
        {today ? 'Update' : 'Save'}
      </PrimaryButton>
    </form>
  );
}
