import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Brain, ChevronRight, FileText, HeartPulse, Scale, Utensils, Dumbbell } from 'lucide-react';
import { Link } from 'react-router';
import { useFeature } from '@/app/entitlement';
import { PageHeader } from '@/app/layout/PageHeader';
import { Section } from '@/components/kit';
import { Skeleton } from '@/components/ui/States';
import { useTrainingData } from '@/data/hooks';
import type { ResponseModel } from '@/domain/brain/response';
import { findingLine } from '@/domain/brain/homeEntry';
import { LEARNING_FOOD_DAYS, LEARNING_WEIGH_INS } from '@/domain/onboarding/firstDays';
import { formatNumber } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { ProLock } from '../pro/ProLock';
import { HurtsSheet } from './HurtsSheet';
import { NextWeek } from './NextWeek';
import { useBrain } from './useBrain';

const R = 54;
const C = 2 * Math.PI * R;

/**
 * Macrotrophy Brain: how far it has learned the person, what it read this week, what it knows
 * so far, and the plan for next week. Every number is calculated on the phone from their logs.
 */
export function BrainPage() {
  const now = useNow();
  const brain = useBrain(now);
  const training = useTrainingData();
  const pro = useFeature('adaptive_plan');
  const [hurts, setHurts] = useState(false);
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const names = useMemo(
    () => new Map((training.data?.exercises ?? []).map((e) => [e.id, e.name])),
    [training.data],
  );

  const model: ResponseModel | null = brain.model;
  const stage = model?.stage ?? null;
  const learning = !stage || stage.learning;
  const week = stage ? Math.max(1, Math.min(stage.week, stage.of)) : 1;
  const of = stage?.of ?? 6;
  const thisWeek = brain.weeks.at(-1) ?? null;

  const lifts = model
    ? Object.entries(model.lifts)
        .filter(([, t]) => t.weeks >= 3)
        .sort((a, b) => b[1].weekly - a[1].weekly)
        .slice(0, 3)
    : [];
  const found = (model?.findings ?? []).map(findingLine).filter((x): x is string => !!x);

  return (
    <>
      <PageHeader
        back={{ to: '/', label: 'Home' }}
        title="Macrotrophy Brain"
        subtitle="Learns how your body responds, then plans each week for you"
      />

      {brain.status === 'loading' ? <Skeleton className="h-64 rounded-panel" /> : null}

      {brain.status === 'success' ? (
        <div className="flex flex-col gap-8" data-brain-page>
          <section className="brain-hero flex flex-col items-center rounded-panel px-5 pt-7 pb-6 text-center">
            <div className="relative size-44" aria-hidden>
              <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                {Array.from({ length: of }, (_, i) => {
                  const seg = C / of;
                  const lit = learning ? i < week : true;
                  return (
                    <circle
                      key={i}
                      cx="60"
                      cy="60"
                      r={R}
                      fill="none"
                      stroke={lit ? 'var(--lime)' : 'var(--fill)'}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${grown || !lit ? seg - 9 : 0} ${C}`}
                      strokeDashoffset={-(i * seg + 4.5)}
                      className={lit ? 'score-arc brain-seg' : undefined}
                      style={{ transitionDelay: `${i * 110}ms` }}
                    />
                  );
                })}
              </svg>
              <span className="brain-core absolute inset-0 m-auto grid size-24 place-items-center rounded-full text-lime">
                <Brain className="size-11" strokeWidth={1.5} />
              </span>
            </div>
            <p className="type-caption mt-4 font-semibold text-lime">
              {learning ? `Week ${week} of ${of}` : `${model?.weeksLogged ?? 0} weeks read`}
            </p>
            <h2
              className="mt-1 text-[1.875rem] leading-[1.1] font-bold tracking-[-0.02em] text-text-1"
              data-brain-stage
            >
              {learning ? 'Learning you' : 'It knows you'}
            </h2>
            <p className="type-subhead mt-1.5 max-w-[32ch] text-text-2">
              {learning
                ? `Until week ${of}, your plan uses research defaults. Every workout, meal and weigh-in teaches it how your body responds.`
                : 'Your plan now follows how your own body has responded, and keeps checking every week.'}
            </p>
          </section>

          <Section title="This week it read">
            <ul className="grid grid-cols-3 gap-2">
              <ReadTile
                icon={<Dumbbell />}
                label="Workouts"
                value={thisWeek?.sessions ?? 0}
                of={null}
              />
              <ReadTile
                icon={<Utensils />}
                label="Food days"
                value={thisWeek?.foodDays ?? 0}
                of={LEARNING_FOOD_DAYS}
              />
              <ReadTile
                icon={<Scale />}
                label="Weigh-ins"
                value={thisWeek?.weighIns ?? 0}
                of={LEARNING_WEIGH_INS}
              />
            </ul>
            <p className="type-footnote mt-2 text-text-2">
              {LEARNING_FOOD_DAYS} food days and {LEARNING_WEIGH_INS} weigh-ins a week teach it the
              most.
            </p>
          </Section>

          <Section title="What it knows so far">
            {pro ? (
              <ul className="rounded-panel bg-surface" data-brain-knows>
                {model?.maintenance ? (
                  <KnowRow
                    title="Your maintenance"
                    value={`${formatNumber(Math.round(model.maintenance.value / 10) * 10)} kcal`}
                    note={
                      model.maintenance.confidence === 'personal'
                        ? `From ${model.maintenance.n} weeks of your food and weight`
                        : model.maintenance.confidence === 'learning'
                          ? 'Research estimate, now checking it against your weight'
                          : 'Research estimate from your profile'
                    }
                  />
                ) : null}
                {lifts.map(([id, t]) => (
                  <KnowRow
                    key={id}
                    title={names.get(id) ?? 'Lift'}
                    value={`${t.weekly >= 0 ? '+' : ''}${(t.weekly * 100).toFixed(1)}%`}
                    note={`Estimated 1RM a week, over ${t.weeks} weeks`}
                  />
                ))}
                {found.map((line) => (
                  <KnowRow key={line} title={line} value="" note="Seen in your own logs" />
                ))}
                {!model?.maintenance && lifts.length === 0 && found.length === 0 ? (
                  <li className="type-subhead p-4 text-text-2">
                    Log a few weeks of workouts, food and weight, and what it learns shows here.
                  </li>
                ) : null}
              </ul>
            ) : (
              <ProLock feature="adaptive_plan" />
            )}
          </Section>

          <div>
            <NextWeek lang="en" now={now} />
          </div>

          <Section title="More">
            <ul className="rounded-panel bg-surface">
              {pro ? (
                <li>
                  <button
                    type="button"
                    onClick={() => setHurts(true)}
                    className="pressable flex w-full items-center gap-3 p-4 text-left"
                    data-brain-hurts
                  >
                    <HeartPulse className="size-5 shrink-0 text-lime" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="type-headline block text-text-1">Something hurts</span>
                      <span className="type-footnote block text-text-2">
                        The plan trains around it until it settles
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-text-3" aria-hidden />
                  </button>
                </li>
              ) : null}
              <li className={pro ? 'shadow-[inset_0_0.5px_0_var(--divider)]' : undefined}>
                <Link to="/report" className="pressable flex items-center gap-3 p-4">
                  <FileText className="size-5 shrink-0 text-lime" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="type-headline block text-text-1">Weekly report</span>
                    <span className="type-footnote block text-text-2">
                      Your week read together, every Sunday from 6 pm
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-text-3" aria-hidden />
                </Link>
              </li>
            </ul>
          </Section>
        </div>
      ) : null}
      {pro ? <HurtsSheet open={hurts} onClose={() => setHurts(false)} exerciseId={null} /> : null}
    </>
  );
}

function ReadTile({
  icon,
  label,
  value,
  of,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  of: number | null;
}) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const share = of === null ? (value > 0 ? 1 : 0) : Math.min(1, value / of);
  return (
    <li className="flex flex-col items-center rounded-panel bg-surface px-2 pt-4 pb-3 text-center">
      <span className="relative grid size-12 place-items-center" aria-hidden>
        <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="var(--fill)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="var(--lime)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${share * c} ${c}`}
            className="score-arc"
          />
        </svg>
        <span className="text-lime [&>svg]:size-4">{icon}</span>
      </span>
      <span className="type-headline tabular mt-2 block text-text-1">
        {of !== null ? `${Math.min(value, of)} of ${of}` : value}
      </span>
      <span className="type-caption block text-text-2">{label}</span>
    </li>
  );
}

function KnowRow({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <li className="flex items-start gap-3 p-4 [&+li]:shadow-[inset_0_0.5px_0_var(--divider)]">
      <span className="min-w-0 flex-1">
        <span className="type-headline block text-text-1">{title}</span>
        <span className="type-footnote block text-text-2">{note}</span>
      </span>
      {value ? <span className="type-headline tabular shrink-0 text-lime">{value}</span> : null}
    </li>
  );
}
