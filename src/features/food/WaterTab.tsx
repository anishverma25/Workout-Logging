import { useState } from 'react';
import { Droplets, Minus, Plus, Trash2 } from 'lucide-react';
import {
  BottomSheet,
  Card,
  ChipGroup,
  ListRow,
  NumberField,
  PrimaryButton,
  RingChart,
  SecondaryButton,
  SegmentedControl,
  Skeleton,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { useWaterData } from '@/data/hooks';
import { db } from '@/data/db';
import { ProfileError, saveTargetSettings } from '@/data/repositories/profile';
import { addWater, deleteWaterLogs, restoreWaterLogs, WaterError } from '@/data/repositories/water';
import {
  DEFAULT_GLASS_ML,
  GLASS_CHOICES_ML,
  glassesText,
  toGlasses,
  waterByDay,
  waterEntries,
  waterOn,
} from '@/domain/nutrition/water';
import { addDays, toDateKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { EvidenceLink } from '../science/EvidenceLink';
import type { FoodContext } from './useFoodContext';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

/** Water: glasses drunk today against the target, one tap to add, and the last 7 days. */
export function WaterTab({ ctx, date }: { ctx: FoodContext; date: string }) {
  const toast = useToast();
  const water = useWaterData();
  const [other, setOther] = useState(false);
  const glassMl = ctx.profile?.waterGlassMl ?? DEFAULT_GLASS_ML;
  const target = ctx.targets.waterMl;

  if (water.status !== 'success') return <Skeleton height={256} radius="panel" />;
  const logs = water.data ?? [];
  const total = waterOn(logs, date);
  const entries = waterEntries(logs, date);
  const week = waterByDay(
    logs,
    Array.from({ length: 7 }, (_, i) => toDateKey(addDays(new Date(`${date}T12:00:00`), i - 6))),
  );

  async function add(ml: number, count = 1) {
    try {
      const added = await addWater(db, { date, ml, count });
      haptic('light');
      toast(`Added ${n(ml * count)} ml`, {
        label: 'Undo',
        onSelect: () =>
          void deleteWaterLogs(
            db,
            added.map((l) => l.id),
          ),
      });
    } catch (e) {
      toast(e instanceof WaterError ? e.message : 'Could not save. Try again.');
    }
  }

  async function removeLast() {
    const last = entries[0];
    if (!last) return;
    await deleteWaterLogs(db, [last.id]);
    toast(`Removed ${n(last.ml)} ml`, {
      label: 'Undo',
      onSelect: () => void restoreWaterLogs(db, [last.id]),
    });
  }

  const max = Math.max(target ?? 0, ...week.map((d) => d.ml), 1);

  return (
    <div className="flex flex-col gap-4" data-water-tab>
      <Card as="section" aria-labelledby="water-title" data-water-summary>
        <div className="flex items-center gap-5">
          {target ? (
            <RingChart
              rings={[{ label: 'Water', value: total, max: target }]}
              size={112}
              label="Water today against your target"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id="water-title" className="sr-only">
              Water
            </h2>
            <p className="flex items-baseline gap-1">
              <span className="type-stat tabular text-text-1" data-water-glasses>
                {toGlasses(total, glassMl)}
              </span>
              <span className="type-meta text-text-2">
                {target ? `of ${toGlasses(target, glassMl)} glasses` : 'glasses'}
              </span>
            </p>
            <p className="type-meta tabular mt-1 text-text-2" data-water-ml>
              {n(total)} ml{target ? ` of ${n(target)} ml` : ''}
            </p>
            <p className="type-caption mt-1 flex flex-wrap items-center gap-x-2 text-text-2">
              {ctx.targets.mode === 'own' && ctx.profile?.waterTargetMl
                ? 'Your own target.'
                : 'Worked out from your weight, 35 ml per kg.'}
              <EvidenceLink topic="water" about="how the water target is worked out" />
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <PrimaryButton
            block
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => void add(glassMl)}
            data-add-glass
          >
            Add a glass ({n(glassMl)} ml)
          </PrimaryButton>
          <SecondaryButton
            aria-label="Remove the last drink"
            disabled={entries.length === 0}
            onClick={() => void removeLast()}
            icon={<Minus className="size-4" aria-hidden />}
          >
            Undo
          </SecondaryButton>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <SecondaryButton compact onClick={() => void add(500)}>
            Bottle 500 ml
          </SecondaryButton>
          <SecondaryButton compact onClick={() => void add(1000)}>
            Litre 1,000 ml
          </SecondaryButton>
          <SecondaryButton compact onClick={() => setOther(true)} data-add-other-water>
            Other amount
          </SecondaryButton>
        </div>
        {!target ? (
          <p className="type-meta mt-3 text-text-2">
            Add a weigh-in on the Body page and Overload works out a water target, or set your own
            under Daily targets.
          </p>
        ) : null}
      </Card>

      <Card as="section" aria-labelledby="water-week">
        <h2 id="water-week" className="type-headline text-text-1">
          Last 7 days
        </h2>
        <ul className="mt-3 grid grid-cols-7 gap-2" data-water-week>
          {week.map((d) => (
            <li key={d.date} className="flex min-w-0 flex-col items-center gap-1">
              <div className="flex h-20 w-full items-end overflow-hidden rounded-nested bg-track">
                <div
                  className="w-full rounded-nested bg-lime"
                  style={{ height: `${Math.round((d.ml / max) * 100)}%` }}
                  role="img"
                  aria-label={`${new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}: ${n(d.ml)} ml`}
                />
              </div>
              <span className="type-caption tabular text-text-2">
                {new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'narrow' })}
              </span>
            </li>
          ))}
        </ul>
        {target ? (
          <p className="type-caption mt-2 text-text-2">
            Target {n(target)} ml a day. Thirst, heat and hard training all raise what you need.
          </p>
        ) : null}
      </Card>

      <Card as="section" aria-labelledby="water-log">
        <h2 id="water-log" className="type-headline text-text-1">
          Today&apos;s drinks
        </h2>
        {entries.length ? (
          <ul className="mt-2 flex flex-col">
            {entries.map((l) => (
              <li key={l.id}>
                <ListRow
                  title={`${n(l.ml)} ml`}
                  subtitle={`${glassesText(l.ml, glassMl)} · ${timeOf(l.createdAt)}`}
                  leading={<Droplets className="size-5 text-text-2" aria-hidden />}
                  value={
                    <button
                      type="button"
                      aria-label={`Delete ${n(l.ml)} ml`}
                      className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full text-text-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteWaterLogs(db, [l.id]).then(() =>
                          toast(`Removed ${n(l.ml)} ml`, {
                            label: 'Undo',
                            onSelect: () => void restoreWaterLogs(db, [l.id]),
                          }),
                        );
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  }
                  className="px-1"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-meta mt-2 text-text-2">Nothing yet. Add your first glass.</p>
        )}
      </Card>

      <GlassSize glassMl={glassMl} />

      <BottomSheet open={other} onClose={() => setOther(false)} title="Add water">
        {other ? (
          <OtherAmount
            glassMl={glassMl}
            onAdd={async (ml, count) => {
              await add(ml, count);
              setOther(false);
            }}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}

/** The size of the person's own glass, saved on their profile. */
function GlassSize({ glassMl }: { glassMl: number }) {
  const toast = useToast();
  return (
    <Card as="section" aria-labelledby="glass-size">
      <h2 id="glass-size" className="type-headline text-text-1">
        Your glass
      </h2>
      <p className="type-meta mt-1 mb-3 text-text-2">
        Glasses are counted in this size. A steel glass is about 250 ml, a tall tumbler 350 ml.
      </p>
      <ChipGroup
        label="Glass size"
        options={GLASS_CHOICES_ML.map((ml) => ({ value: String(ml), label: `${ml} ml` }))}
        value={String(glassMl)}
        onChange={(v) =>
          void saveTargetSettings(db, { waterGlassMl: Number(v) }).catch((e: unknown) =>
            toast(e instanceof ProfileError ? e.message : 'Could not save. Try again.'),
          )
        }
      />
    </Card>
  );
}

function OtherAmount({
  glassMl,
  onAdd,
}: {
  glassMl: number;
  onAdd: (ml: number, count: number) => Promise<void>;
}) {
  const [unit, setUnit] = useState<'ml' | 'glass'>('ml');
  const [value, setValue] = useState<number | null>(null);
  const ml =
    value === null ? null : unit === 'ml' ? Math.round(value) : Math.round(value * glassMl);
  return (
    <form
      className="flex flex-col gap-4 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (ml !== null && ml >= 50) void onAdd(ml, 1);
      }}
    >
      <SegmentedControl<'ml' | 'glass'>
        label="Unit"
        block
        value={unit}
        onChange={setUnit}
        options={[
          { value: 'ml', label: 'Millilitres' },
          { value: 'glass', label: `Glasses (${glassMl} ml)` },
        ]}
      />
      <NumberField
        label={unit === 'ml' ? 'Amount in ml' : 'Number of glasses'}
        value={value}
        onValueChange={setValue}
        allowDecimal={unit === 'glass'}
        min={unit === 'ml' ? 50 : 0.25}
        max={unit === 'ml' ? 5000 : 20}
        unit={unit === 'ml' ? 'ml' : 'glasses'}
        autoFocus
      />
      {ml !== null && unit === 'glass' ? (
        <p className="type-meta tabular text-text-2">{n(ml)} ml</p>
      ) : null}
      <PrimaryButton block type="submit" disabled={ml === null || ml < 50 || ml > 5000}>
        Add
      </PrimaryButton>
    </form>
  );
}
