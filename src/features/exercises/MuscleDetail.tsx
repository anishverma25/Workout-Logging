import { useMemo, useState } from 'react';
import { ChevronDown, Microscope, X } from 'lucide-react';
import type { Exercise } from '@/domain/models/schemas';
import { targetsFor, worksMuscle, type ExerciseTargets } from '@/domain/muscles/targets';
import { MUSCLES, MUSCLE_BY_ID, childrenOf } from '@/domain/muscles/taxonomy';
import { BottomSheet } from '@/components/kit';
import { cn } from '@/lib/cn';

/**
 * Muscles in detail (November 2026): the full anatomy stays behind one button. Beginners keep
 * the broad muscle chips; anyone who wants "upper chest" or "biceps long head" opens this.
 */

const nameOf = (id: string) => MUSCLE_BY_ID.get(id)?.gym ?? id;

/** The button next to the filters, and the chosen muscle as a pill you can clear. */
export function MuscleDetailButton({
  value,
  onOpen,
  onClear,
}: {
  value: string | null | undefined;
  onOpen: () => void;
  onClear: () => void;
}) {
  if (value) {
    return (
      <span
        className="type-meta inline-flex h-9 w-fit items-center gap-1 rounded-full bg-text-1 pr-1 pl-3 font-semibold text-bg"
        data-muscle-detail-active={value}
      >
        <button type="button" onClick={onOpen} className="pressable">
          {nameOf(value)}
        </button>
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${nameOf(value)}`}
          className="pressable inline-flex size-7 items-center justify-center rounded-full"
        >
          <X className="size-4" aria-hidden />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="pressable tap-target type-meta inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-1 font-medium text-text-1"
      data-muscle-detail-open
    >
      <Microscope className="size-4" aria-hidden />
      Muscles in detail
    </button>
  );
}

/**
 * Regions, then their gym groups; a group opens to its muscles and heads. Each shows how many
 * exercises train it as a main muscle. Muscles no exercise trains are left out.
 */
export function MuscleDetailSheet({
  open,
  onClose,
  exercises,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  exercises: Exercise[];
  value: string | null | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Muscles in detail"
      subtitle="Pick a muscle, a head or a region. Exercises that train it come first."
      tall
    >
      {open ? (
        <MuscleTree
          exercises={exercises}
          value={value}
          onPick={(id) => {
            onPick(id);
            onClose();
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

function MuscleTree({
  exercises,
  value,
  onPick,
}: {
  exercises: Exercise[];
  value: string | null | undefined;
  onPick: (id: string) => void;
}) {
  const counts = useMemo(() => {
    const live = exercises.filter((e) => !e.deletedAt).map(targetsFor);
    const main = (id: string) => live.filter((t) => worksMuscle(t, id) === 2).length;
    return new Map(MUSCLES.map((m) => [m.id, main(m.id)]));
  }, [exercises]);
  const startOpen = value
    ? MUSCLE_BY_ID.get(value)?.level === 3
      ? MUSCLE_BY_ID.get(value)!.parent
      : value
    : null;
  const [openGroup, setOpenGroup] = useState<string | null>(startOpen ?? null);
  const regions = MUSCLES.filter((m) => m.level === 1 && (counts.get(m.id) ?? 0) > 0);
  return (
    <div className="flex flex-col gap-5 pb-2" data-muscle-tree>
      {regions.map((r) => (
        <section key={r.id} aria-labelledby={`region-${r.id}`}>
          <h3 id={`region-${r.id}`} className="type-footnote mb-1.5 px-1 font-semibold text-text-2">
            {r.gym}
          </h3>
          <ul className="divide-y-[0.5px] divide-divider overflow-hidden rounded-card bg-surface-2">
            {childrenOf(r.id)
              .filter((g) => (counts.get(g.id) ?? 0) > 0)
              .map((g) => {
                const muscles = childrenOf(g.id).filter(
                  (m) => m.level === 3 && (counts.get(m.id) ?? 0) > 0,
                );
                const expanded = openGroup === g.id;
                return (
                  <li key={g.id}>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => onPick(g.id)}
                        className={cn(
                          'pressable flex min-w-0 flex-1 items-center gap-2 py-3 pl-4 text-left',
                          value === g.id && 'text-lime',
                        )}
                        data-muscle-pick={g.id}
                      >
                        <span className="type-headline truncate">{g.gym}</span>
                        <span className="type-caption tabular text-text-2">{counts.get(g.id)}</span>
                      </button>
                      {muscles.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setOpenGroup(expanded ? null : g.id)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Hide' : 'Show'} the muscles of ${g.gym}`}
                          className="pressable flex size-11 shrink-0 items-center justify-center text-text-2"
                          data-muscle-expand={g.id}
                        >
                          <ChevronDown
                            className={cn('size-5 transition-transform', expanded && 'rotate-180')}
                            aria-hidden
                          />
                        </button>
                      ) : null}
                    </div>
                    {expanded ? (
                      <div className="flex flex-wrap gap-2 px-4 pb-3">
                        {muscles.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onPick(m.id)}
                            title={m.name}
                            className={cn(
                              'pressable type-meta h-9 rounded-full px-3.5 font-semibold',
                              value === m.id ? 'bg-text-1 text-bg' : 'bg-surface text-text-1',
                            )}
                            data-muscle-pick={m.id}
                          >
                            {m.gym}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <p className="type-caption px-1 text-text-2">
        Exercises bias a head or region, they never isolate it. Numbers show exercises that train
        each one as a main muscle.
      </p>
    </div>
  );
}

const PATTERN_LABEL: Record<ExerciseTargets['pattern'], string> = {
  'horizontal push': 'Horizontal push',
  'vertical push': 'Vertical push',
  'horizontal pull': 'Horizontal pull',
  'vertical pull': 'Vertical pull',
  squat: 'Squat',
  hinge: 'Hinge',
  lunge: 'Lunge',
  'hip extension': 'Hip extension',
  'knee extension': 'Knee extension',
  'knee flexion': 'Knee flexion',
  'elbow flexion': 'Elbow flexion',
  'elbow extension': 'Elbow extension',
  'shoulder raise': 'Raise',
  fly: 'Fly',
  shrug: 'Shrug',
  'calf raise': 'Calf raise',
  'trunk flexion': 'Trunk flexion',
  'anti-movement': 'Core bracing',
  carry: 'Carry',
  'hip abduction': 'Hip abduction',
  'hip adduction': 'Hip adduction',
  pullover: 'Pullover',
  cardio: 'Cardio',
};

/**
 * "Anatomy" in an exercise's sheet: the named muscles (main, assisting, stabilizing), closed by
 * default under the "Muscles worked" shares, so the sheet never shows two sections of one name.
 */
export function MusclesWorked({ exercise }: { exercise: Exercise }) {
  const t = targetsFor(exercise);
  const [open, setOpen] = useState(false);
  if (t.primary.length === 0) return null;
  const rows: [string, string[]][] = [
    ['Main', t.primary],
    ['Assisting', t.secondary],
    ['Stabilizing', t.stabilizers],
  ];
  const summary = [...new Set(t.primary.map(nameOf))].slice(0, 3).join(', ');
  return (
    <section className="mt-6" data-muscles-worked>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="pressable flex w-full items-center justify-between gap-3 rounded-card bg-surface-2 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="type-headline block text-text-1">Anatomy</span>
          <span className="type-meta block truncate text-text-2">{summary}</span>
        </span>
        <ChevronDown
          className={cn('size-5 shrink-0 text-text-2 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-3 rounded-card bg-surface-2 px-4 py-3">
          {rows
            .filter(([, ids]) => ids.length)
            .map(([label, ids]) => (
              <div key={label}>
                <p className="type-caption font-semibold text-text-2">{label}</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {ids.map((id) => (
                    <li
                      key={id}
                      title={MUSCLE_BY_ID.get(id)?.name}
                      className={cn(
                        'type-meta rounded-full px-2.5 py-1',
                        label === 'Main' ? 'bg-lime-dim text-lime' : 'bg-fill text-text-1',
                      )}
                    >
                      {nameOf(id)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          {t.actions ? (
            <p className="type-meta text-text-2">
              <span className="font-semibold text-text-1">{PATTERN_LABEL[t.pattern]}:</span>{' '}
              {t.actions}
            </p>
          ) : null}
          {t.emphasis ? (
            <p className="type-meta text-text-1" data-muscle-emphasis>
              {t.emphasis}
            </p>
          ) : null}
          <p className="type-caption text-text-2">
            Main counts as a set for that muscle, assisting as half a set, stabilizing not at all.
          </p>
        </div>
      ) : null}
    </section>
  );
}
