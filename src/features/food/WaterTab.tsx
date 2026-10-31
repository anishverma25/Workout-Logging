import { useState, type ButtonHTMLAttributes } from 'react';
import { Droplets, Plus, Trash2 } from 'lucide-react';
import {
  BottomSheet,
  ChipGroup,
  ListRow,
  NumberField,
  PrimaryButton,
  SegmentedControl,
  Skeleton,
  TextButton,
} from '@/components/kit';
import type { WaterLog } from '@/domain/models/schemas';
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

/** A small button for the quick water amounts: fits four to a row on a 390px phone. */
function QuickButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`pressable chrome tap-target type-meta inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-full bg-fill px-3.5 font-semibold text-text-1 disabled:text-text-3 ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Water, as one card on the Food page: glasses today against the target, one tap to add, quick
 * amounts, and a details sheet with the last 7 days, today's drinks and the glass size.
 */
export function WaterCard({ ctx, date }: { ctx: FoodContext; date: string }) {
  const toast = useToast();
  const water = useWaterData();
  const [other, setOther] = useState(false);
  const [details, setDetails] = useState(false);
  const glassMl = ctx.profile?.waterGlassMl ?? DEFAULT_GLASS_ML;
  const target = ctx.targets.waterMl;

  if (water.status !== 'success') return <Skeleton height={200} radius="panel" />;
  const logs = water.data ?? [];
  const total = waterOn(logs, date);
  const entries = waterEntries(logs, date);

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

  return (
    <section id="water" aria-labelledby="water-title" data-water-tab data-water-summary>
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
        <h2 id="water-title" className="type-section text-text-1">
          Water
        </h2>
        <TextButton small onClick={() => setDetails(true)} data-water-details>
          Details
        </TextButton>
      </div>
      <div className="divide-y-[0.5px] divide-divider rounded-card bg-surface px-4">
        <div className="flex items-center gap-3 py-3">
          {target ? (
            <MiniRing value={total} max={target} label="Water today against your target" />
          ) : (
            <span className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-fill text-text-1">
              <Droplets className="size-4" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="type-headline whitespace-nowrap text-text-1">
              <span className="type-metric-sm" data-water-glasses>
                {toGlasses(total, glassMl)}
              </span>{' '}
              <span className="font-normal text-text-2">
                {target ? `of ${toGlasses(target, glassMl)} glasses` : 'glasses'}
              </span>
            </p>
            <p className="type-subhead tabular text-text-2" data-water-ml>
              {n(total)} ml{target ? ` of ${n(target)} ml` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void add(glassMl)}
            aria-label={`Add a glass (${n(glassMl)} ml)`}
            className="pressable chrome tap-target type-subhead inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill px-3.5 font-semibold text-text-1"
            data-add-glass
          >
            <Plus className="size-4" aria-hidden />
            {n(glassMl)} ml
          </button>
        </div>
        {/* Other amounts in one small row (UI v3, S10.5): no second lime button. */}
        <div className="flex flex-wrap gap-2 py-2.5">
          <QuickButton onClick={() => void add(500)} aria-label="Add a 500 ml bottle">
            500 ml
          </QuickButton>
          <QuickButton onClick={() => void add(1000)} aria-label="Add 1 litre">
            1 L
          </QuickButton>
          <QuickButton onClick={() => setOther(true)} data-add-other-water>
            Other
          </QuickButton>
          <QuickButton
            aria-label="Remove the last drink"
            disabled={entries.length === 0}
            onClick={() => void removeLast()}
          >
            Undo
          </QuickButton>
        </div>
      </div>
      <p className="type-meta mt-2 flex flex-wrap items-center gap-x-2 px-4 text-text-2">
        {!target
          ? 'Weigh in on the Body page for a water target, or set your own under Daily targets.'
          : ctx.targets.mode === 'own' && ctx.profile?.waterTargetMl
            ? 'Your own target.'
            : 'Worked out from your weight, 35 ml per kg.'}
        <EvidenceLink topic="water" about="how the water target is worked out" />
      </p>

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
      <BottomSheet open={details} onClose={() => setDetails(false)} title="Water" tall>
        {details ? (
          <WaterDetails logs={logs} date={date} glassMl={glassMl} target={target} />
        ) : null}
      </BottomSheet>
    </section>
  );
}

/** A 30px progress ring with its track always showing, for a row. */
function MiniRing({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const f = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      role="img"
      aria-label={`${label}: ${Math.round(f * 100)}%`}
      className="shrink-0 -rotate-90"
    >
      <circle
        cx="15"
        cy="15"
        r={r}
        fill="none"
        stroke="var(--lime)"
        strokeOpacity={0.16}
        strokeWidth="4"
      />
      {f > 0 ? (
        <circle
          cx="15"
          cy="15"
          r={r}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          className="ring-arc"
        />
      ) : null}
    </svg>
  );
}

/** The last 7 days, the day's drinks and the glass size, in the details sheet. */
function WaterDetails({
  logs,
  date,
  glassMl,
  target,
}: {
  logs: WaterLog[];
  date: string;
  glassMl: number;
  target: number | null;
}) {
  const toast = useToast();
  const entries = waterEntries(logs, date);
  const week = waterByDay(
    logs,
    Array.from({ length: 7 }, (_, i) => toDateKey(addDays(new Date(`${date}T12:00:00`), i - 6))),
  );
  const max = Math.max(target ?? 0, ...week.map((d) => d.ml), 1);
  return (
    <div className="flex flex-col gap-6 pt-1">
      <section aria-labelledby="water-week">
        <h3 id="water-week" className="type-headline text-text-1">
          Last 7 days
        </h3>
        <ul className="mt-3 grid grid-cols-7 gap-1.5" data-water-week>
          {week.map((d) => (
            <li key={d.date} className="flex min-w-0 flex-col items-center gap-1">
              <div className="flex h-20 w-full items-end overflow-hidden rounded-field bg-track">
                <div
                  className="w-full rounded-field bg-lime"
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
      </section>

      <section aria-labelledby="water-log">
        <h3 id="water-log" className="type-headline text-text-1">
          Drinks this day
        </h3>
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
          <p className="type-meta mt-2 text-text-2">Nothing yet.</p>
        )}
      </section>

      <GlassSize glassMl={glassMl} />
    </div>
  );
}

/** The size of the person's own glass, saved on their profile. */
function GlassSize({ glassMl }: { glassMl: number }) {
  const toast = useToast();
  return (
    <section aria-labelledby="glass-size">
      <h3 id="glass-size" className="type-headline text-text-1">
        Your glass
      </h3>
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
    </section>
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
