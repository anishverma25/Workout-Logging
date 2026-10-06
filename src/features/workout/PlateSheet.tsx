import { useState } from 'react';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sheet } from '@/components/ui/Sheet';
import { BARS_KG, BARS_LB, PLATES_KG, PLATES_LB, platesFor } from '@/domain/workout/plates';
import type { WeightUnit } from '@/lib/units';

/** Plate colours, as on competition plates, to make the picture readable at a glance. */
const PLATE_STYLE: Record<number, { h: number; tone: string }> = {
  25: { h: 100, tone: 'bg-[var(--tile-rose)]' },
  45: { h: 100, tone: 'bg-[var(--tile-rose)]' },
  20: { h: 100, tone: 'bg-[var(--tile-sky)]' },
  35: { h: 92, tone: 'bg-[var(--tile-amber)]' },
  15: { h: 88, tone: 'bg-[var(--tile-amber)]' },
  10: { h: 74, tone: 'bg-[var(--tile-lime)]' },
  5: { h: 58, tone: 'bg-[var(--tile-graphite)]' },
  2.5: { h: 46, tone: 'bg-[var(--tile-iris)]' },
  1.25: { h: 38, tone: 'bg-[var(--tile-plum)]' },
};

export function PlateSheet({
  open,
  onClose,
  unit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  unit: WeightUnit;
  /** In the display unit. */
  initial: number | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Plate calculator">
      {open ? <Calculator unit={unit} initial={initial} /> : null}
    </Sheet>
  );
}

function Calculator({ unit, initial }: { unit: WeightUnit; initial: number | null }) {
  const bars = unit === 'kg' ? BARS_KG : BARS_LB;
  const plates = unit === 'kg' ? PLATES_KG : PLATES_LB;
  const [total, setTotal] = useState<number | null>(initial);
  const [bar, setBar] = useState<string>(String(bars[0]));
  const load = total !== null ? platesFor(total, Number(bar), plates) : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <NumberField label="Total on the bar" unit={unit} value={total} onValueChange={setTotal} />
        <SegmentedControl
          label="Bar weight"
          value={bar}
          onChange={setBar}
          options={bars.map((b) => ({ value: String(b), label: `${b}` }))}
        />
      </div>
      {total === null ? (
        <p className="text-sm text-muted">Enter the total weight, bar included.</p>
      ) : !load ? (
        <p className="text-sm text-muted">
          That is lighter than the bar ({bar} {unit}).
        </p>
      ) : (
        <>
          <div
            className="flex h-28 items-center justify-center gap-[3px] rounded-2xl bg-surface-2 px-4"
            aria-hidden
          >
            <span className="h-2.5 w-10 rounded-l-full bg-[var(--line-strong)]" />
            {load.perSide.map((p, i) => (
              <span
                key={i}
                className={`w-3.5 rounded-[3px] ${PLATE_STYLE[p]?.tone ?? 'bg-[var(--tile-graphite)]'}`}
                style={{ height: `${PLATE_STYLE[p]?.h ?? 50}%` }}
              />
            ))}
            <span className="h-2.5 w-16 rounded-r-full bg-[var(--line-strong)]" />
          </div>
          <p className="text-[1.05rem]">
            {load.perSide.length === 0 ? (
              'Just the bar.'
            ) : (
              <>
                Each side:{' '}
                <strong className="tabular">
                  {load.perSide.map((p) => `${p}`).join(' + ')} {unit}
                </strong>
              </>
            )}
          </p>
          {load.remainder > 0 ? (
            <p className="text-sm text-warn">
              Standard plates make {load.achieved} {unit}, {load.remainder} {unit} short.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
