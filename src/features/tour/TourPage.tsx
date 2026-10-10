import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  Check,
  ChartNoAxesColumnIncreasing,
  Crown,
  Scale,
  Zap,
  FlaskConical,
  Medal,
  Ruler,
  Sparkles,
  Timer,
  Trophy,
} from 'lucide-react';
import { APP_NAME } from '@/app/navigation';
import { LineChart } from '@/components/charts/LineChart';
import { Button } from '@/components/ui/Button';
import { Badge, IconTile, TextLink } from '@/components/kit';
import { MUSCLE_LABELS } from '@/domain/models/labels';
import { TRIAL_HOURS } from '@/domain/entitlement/entitlement';
import type { Plateau } from '@/domain/analytics/standards';
import { Rings, RingLegend, type RingSpec } from '@/components/ui/Rings';
import { db } from '@/data/db';
import { generateDemoDataset } from '@/data/demo/generate';
import { SYSTEM_EXERCISES } from '@/data/library/exercises';
import { usePreferences } from '@/data/hooks';
import { setMeta, META_KEYS } from '@/data/repositories/meta';
import { bodySnapshot } from '@/domain/analytics/body';
import { buildDashboard } from '@/domain/analytics/dashboard';
import { goalProgress } from '@/domain/analytics/goals';
import { formatRecordValue, PR_LABELS } from '@/domain/analytics/prs';
import { milestones } from '@/domain/analytics/milestones';
import { performanceByExercise } from '@/domain/analytics/performance';
import { buildProgress } from '@/domain/analytics/progress';
import { buildSessions, type TrainingData } from '@/domain/analytics/sessions';
import { loggedDaysPerWeek } from '@/domain/analytics/week';
import { cn } from '@/lib/cn';
import { DEFAULT_PREFERENCES } from '@/domain/models/schemas';
import { ageFromBirthDate, formatDayMonth, formatShortDate } from '@/lib/dates';
import { formatClock } from '@/lib/format';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';

/**
 * A first look at the app with a sample lifter's numbers, computed in memory from the same demo
 * generator and the same analytics as the real screens. Nothing here is written to any
 * database, so it can never mix with the person's own data.
 */
export function TourPage() {
  const navigate = useNavigate();
  const prefs = usePreferences();
  const unit = prefs.weightUnit;
  const sample = useMemo(() => buildSample(unit), [unit]);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const slides = SLIDES.length;

  /** Where a button press is scrolling to; scroll positions on the way there are ignored. */
  const target = useRef<number | null>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const at = Math.round(el.scrollLeft / el.clientWidth);
      if (target.current !== null) {
        if (at !== target.current) return;
        target.current = null;
      }
      setIndex(at);
    };
    // A swipe or a drag takes over from any button scroll still in flight.
    const takeOver = () => (target.current = null);
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', takeOver, { passive: true });
    el.addEventListener('wheel', takeOver, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', takeOver);
      el.removeEventListener('wheel', takeOver);
    };
  }, []);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(slides - 1, i));
    target.current = clamped;
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    setIndex(clamped);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1);
      if (e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function finish(to: string) {
    await setMeta(db, META_KEYS.tourPending, false);
    navigate(to, { replace: true });
  }

  const last = index === slides - 1;

  return (
    <div className="flex h-dvh flex-col bg-bg pt-safe">
      <header className="mx-auto flex h-14 w-full max-w-xl shrink-0 items-center justify-between px-safe">
        <span className="type-headline text-text-1">{APP_NAME}</span>
        <Badge icon={<FlaskConical />}>Sample data</Badge>
        <TextLink onClick={() => void finish('/')}>Skip</TextLink>
      </header>

      <div
        ref={track}
        className="flex min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-text snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="Preview of the app"
        // Scrollable, so keyboard users can reach it; arrow keys move between slides.
        tabIndex={0}
      >
        {SLIDES.map((Slide, i) => (
          <section
            key={i}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides}`}
            inert={i !== index}
            className="w-full shrink-0 snap-center overflow-y-auto"
          >
            <div className="mx-auto flex min-h-full max-w-xl flex-col px-safe pb-6 pt-2">
              <Slide sample={sample} unit={unit} active={i === index} />
            </div>
          </section>
        ))}
      </div>

      <footer className="mx-auto w-full max-w-xl shrink-0 px-safe pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-4 flex justify-center gap-1.5" role="tablist" aria-label="Slides">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}`}
              onClick={() => go(i)}
              className={cn(
                'tap-target h-2 rounded-full transition-[width,background-color] duration-300',
                i === index ? 'w-6 bg-lime' : 'w-2 bg-track',
              )}
            />
          ))}
        </div>
        {last ? (
          <div className="flex flex-col gap-2">
            <Button size="lg" block onClick={() => void finish('/setup?next=/')}>
              Set up my plan
            </Button>
            <Button size="lg" block variant="secondary" onClick={() => void finish('/')}>
              Look around first
            </Button>
            <TextLink onClick={() => void finish('/pro')} chevron className="self-center">
              See everything in Pro
            </TextLink>
          </div>
        ) : (
          <Button
            size="lg"
            block
            icon={<ArrowRight className="size-5" aria-hidden />}
            onClick={() => go(index + 1)}
          >
            {index === 0 ? 'Take the tour' : 'Next'}
          </Button>
        )}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function buildSample(unit: WeightUnit) {
  const now = new Date();
  const ds = generateDemoDataset(now);
  const data: TrainingData = { ...ds, exercises: SYSTEM_EXERCISES };
  const sessions = buildSessions(data);
  const dashboard = buildDashboard(data, { ...DEFAULT_PREFERENCES, weightUnit: unit }, now);
  const progress = buildProgress(data, {
    range: 'all',
    exerciseId: null,
    now,
    weekStartsOn: 1,
    unit,
  });
  const history = performanceByExercise(sessions);
  return {
    data,
    dashboard,
    progress,
    body: bodySnapshot({
      profile: data.profile,
      age: data.profile?.birthDate ? ageFromBirthDate(data.profile.birthDate, now) : null,
      bodyWeights: data.bodyWeights,
      measurements: data.measurements,
      loggedDaysPerWeek: loggedDaysPerWeek(sessions, now),
      now,
    }),
    goals: data.goals.map((g) => goalProgress(g, history, data.bodyWeights, now)),
    milestones: milestones(sessions, data.bodyWeights, now, 1, data.profile?.trainingDays ?? null)
      .reverse()
      .slice(0, 3),
  };
}

type Sample = ReturnType<typeof buildSample>;
interface SlideProps {
  sample: Sample;
  unit: WeightUnit;
  active: boolean;
}

function Title({
  icon,
  kicker,
  title,
  body,
}: {
  icon: ReactNode;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mb-6">
      <Badge tone="lime" icon={icon}>
        {kicker}
      </Badge>
      <h1 className="type-display mt-3 text-text-1 [text-wrap:balance]">{title}</h1>
      <p className="type-body mt-2 text-text-2">{body}</p>
    </div>
  );
}

function Welcome({ sample, active }: SlideProps) {
  const w = sample.dashboard.week;
  const rings: (RingSpec & { unit?: string })[] = [
    { hue: 1, label: 'Sessions', value: w.sessions.value, target: w.sessions.target ?? 6 },
    { hue: 2, label: 'Working sets', value: w.sets.value, target: w.sets.target ?? 100 },
    { hue: 3, label: 'Minutes', value: w.minutes.value, target: w.minutes.target ?? 360 },
  ];
  return (
    <div className="flex flex-1 flex-col justify-center">
      <div className="mb-8 flex justify-center">
        {active ? <Rings rings={rings} size={220} /> : <div className="size-[220px]" />}
      </div>
      <h1 className="type-display text-center text-[2.5rem] leading-[1.05] text-text-1">
        Every rep counted.
        <br />
        Every gain proven.
      </h1>
      <p className="type-body mx-auto mt-4 max-w-[36ch] text-center text-text-2">
        The fastest way to log a workout, and the clearest way to see it working. Here is {APP_NAME}{' '}
        with a sample lifter&apos;s numbers. Your own training starts empty and stays yours.
      </p>
      <RingLegend rings={rings} className="mx-auto mt-6 flex-row gap-6" />
    </div>
  );
}

/** A working set row you can tick, and the rest timer that starts. */
function Logger({ unit }: SlideProps) {
  const [done, setDone] = useState<number[]>([]);
  const [restEnds, setRestEnds] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!restEnds) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [restEnds]);
  const left = restEnds ? Math.max(0, restEnds - now) : 0;
  const kg = (v: number) => formatWeightValue(v, unit);
  const sets = [
    { last: `${kg(80)} × 8`, w: kg(82.5), r: 8 },
    { last: `${kg(80)} × 8`, w: kg(82.5), r: 8 },
    { last: `${kg(80)} × 7`, w: kg(82.5), r: 7 },
  ];
  return (
    <>
      <Title
        icon={<Check className="size-4" aria-hidden />}
        kicker="The logger"
        title="Last time sits next to every set"
        body="Tap the check and last time's numbers fill in. The rest timer starts by itself. Try it."
      />
      <div className="rounded-[var(--radius-card)] bg-surface py-4">
        <div className="px-4">
          <p className="font-display text-[1.35rem] font-bold">Barbell bench press</p>
          <p className="text-sm text-text-2">Target 3 × 6 to 10 · RIR 2</p>
        </div>
        <div className="mt-3 grid grid-cols-[1.6rem_minmax(0,1fr)_4rem_3rem_2.75rem] gap-1.5 px-3 pb-1 text-xs font-medium text-text-2">
          <span className="text-center">Set</span>
          <span>Last</span>
          <span className="text-center">{unit}</span>
          <span className="text-center">Reps</span>
          <span />
        </div>
        {sets.map((s, i) => {
          const ticked = done.includes(i);
          return (
            <div
              key={i}
              className={cn(
                'mx-2 grid grid-cols-[1.6rem_minmax(0,1fr)_4rem_3rem_2.75rem] items-center gap-1.5 rounded-xl px-1 py-1 transition-colors',
                ticked && 'set-done bg-accent-soft',
              )}
            >
              <span className="text-center font-display font-bold text-text-2">{i + 1}</span>
              <span className="tabular text-sm text-text-2">{s.last}</span>
              <span className="tabular rounded-lg bg-surface-2 py-2.5 text-center font-display font-semibold">
                {ticked ? s.w : <span className="text-text-2">{s.w}</span>}
              </span>
              <span className="tabular rounded-lg bg-surface-2 py-2.5 text-center font-display font-semibold">
                {ticked ? s.r : <span className="text-text-2">{s.r}</span>}
              </span>
              <button
                type="button"
                aria-pressed={ticked}
                aria-label={ticked ? `Set ${i + 1} done` : `Mark sample set ${i + 1} done`}
                onClick={() => {
                  if (ticked) return;
                  setDone((d) => [...d, i]);
                  navigator.vibrate?.(12);
                  setRestEnds(Date.now() + 90_000);
                  setNow(Date.now());
                }}
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl border-2 transition-colors active:scale-90',
                  ticked
                    ? 'set-check border-accent bg-accent text-accent-ink'
                    : 'border-line-strong bg-surface-2 text-text-2',
                )}
              >
                <Check className="size-5" strokeWidth={3} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
      <div
        className={cn(
          'mt-3 flex items-center gap-3 rounded-[1.1rem] px-4 py-3 transition-opacity duration-300',
          restEnds ? 'bg-surface opacity-100' : 'opacity-0',
        )}
        aria-live="polite"
      >
        <Timer className="size-5 text-accent-text" aria-hidden />
        <span className="tabular font-display text-[1.4rem] font-semibold">
          {formatClock(Math.ceil(left / 1000))}
        </span>
        <span className="text-sm text-text-2">rest, then the next set</span>
      </div>
      <p className="mt-auto pt-4 text-sm text-text-2">
        It works offline, survives closing the app, and suggests when to add weight.
      </p>
    </>
  );
}

function Records({ sample, unit }: SlideProps) {
  // The newest record per lift, so three different exercises show.
  const seen = new Set<string>();
  const prs = [...sample.progress.records]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .filter((r) => !seen.has(r.exerciseId) && seen.add(r.exerciseId))
    .slice(0, 3);
  return (
    <>
      <Title
        icon={<Trophy className="size-4" aria-hidden />}
        kicker="Records"
        title="Every best, the moment it happens"
        body="Heaviest lifts, estimated maxes and rep records are found from your sets, and celebrated when you finish."
      />
      <div className="record-sweep relative overflow-hidden rounded-[var(--radius-card)] bg-surface p-5">
        <p className="flex items-center gap-2 font-display text-xl font-semibold">
          <Trophy className="trophy-lift size-5 text-accent-text" aria-hidden />
          Latest records
        </p>
        <ul className="mt-3 divide-y divide-line">
          {prs.map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{p.exerciseName}</span>
                <span className="block text-sm text-text-2">{PR_LABELS[p.type]}</span>
              </span>
              <span className="tabular shrink-0 font-display text-lg font-semibold">
                {formatRecordValue(p.type, p.value, unit)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <Medal className="size-4" aria-hidden /> Milestones
        </p>
        {sample.milestones.map((m) => (
          <p key={m.id} className="mt-1.5 font-display text-[1.25rem] font-bold leading-tight">
            {m.title}
          </p>
        ))}
      </div>
    </>
  );
}

function Progress({ sample, unit }: SlideProps) {
  const sel = sample.progress.selected;
  const points = (sel?.points ?? []).filter((p) => p.bestE1rm !== null);
  const levels = sample.progress.strength.levels;
  return (
    <>
      <Title
        icon={<ChartNoAxesColumnIncreasing className="size-4" aria-hidden />}
        kicker="Progress"
        title="Strength you can see, worked out honestly"
        body="Estimated maxes, volume, sets per muscle, strength levels and stalled lifts. Every formula is explained."
      />
      {sel && points.length >= 2 ? (
        <div className="rounded-[var(--radius-card)] bg-surface p-4">
          <p className="mb-2 font-semibold">{sel.name}, estimated 1RM</p>
          <LineChart
            label={`${sel.name} estimated 1RM, sample data`}
            height={170}
            series={[
              {
                id: 'session',
                label: 'Session best',
                color: 'var(--chart-2)',
                style: 'dots',
                points: points.map((p) => ({
                  x: p.date.getTime(),
                  y: toDisplayWeight(p.bestE1rm!, unit),
                })),
              },
              {
                id: 'best',
                label: 'All-time best',
                color: 'var(--chart-1)',
                style: 'line',
                points: points
                  .filter((p) => p.runningBestE1rm !== null)
                  .map((p) => ({
                    x: p.date.getTime(),
                    y: toDisplayWeight(p.runningBestE1rm!, unit),
                  })),
              },
            ]}
            formatY={(v) => v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            formatX={(x) => formatDayMonth(new Date(x))}
            formatXLong={(x) => formatShortDate(new Date(x))}
          />
        </div>
      ) : null}
      {levels.length > 0 ? (
        <ul className="mt-3 rounded-[var(--radius-card)] bg-surface px-4">
          {levels.slice(0, 3).map((l, i) => (
            <li key={l.key} className={cn('py-3', i > 0 && 'border-t border-line')}>
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{l.name}</span>
                <span className="text-text-2">{l.level ?? 'Starting'}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--ring-track)]">
                <div
                  className="h-full rounded-full bg-[var(--ring-1)]"
                  style={{
                    width: `${Math.min(100, ((l.level ? ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'].indexOf(l.level) + 1 : 0) + l.progress) * 20)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function Body({ sample, unit }: SlideProps) {
  const b = sample.body;
  const tiles: [string, string, string][] = [
    [
      'Daily calories',
      b.energy ? `${b.energy.targetKcal.toLocaleString('en-GB')}` : 'None',
      'kcal',
    ],
    [
      'Protein',
      b.energy
        ? `${b.energy.proteinG[0].toFixed(1)} to ${b.energy.proteinG[1].toFixed(1)}`
        : 'None',
      'g',
    ],
    ['BMI', b.bmi ? b.bmi.value.toFixed(1) : 'None', ''],
    ['Body fat', b.bodyFat ? b.bodyFat.pct.toFixed(1) : 'None', '%'],
  ];
  return (
    <>
      <Title
        icon={<Ruler className="size-4" aria-hidden />}
        kicker="Body"
        title="Your numbers, from published formulas"
        body="Calories and protein for your goal, a smoothed weight trend, BMI, body fat from a tape measure. Each shows its formula."
      />
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map(([label, value, u]) => (
          <div key={label} className="rounded-[1.1rem] bg-surface p-4">
            <p className="text-[0.8125rem] font-medium text-text-2">{label}</p>
            <p className="tabular mt-1 font-display text-[1.6rem] font-semibold tracking-tight">
              {value}
              {u ? <span className="ml-1 text-base text-text-2">{u}</span> : null}
            </p>
          </div>
        ))}
      </div>
      {b.trend.length >= 2 ? (
        <div className="mt-3 rounded-[var(--radius-card)] bg-surface p-4">
          <p className="mb-2 font-semibold">Weight trend</p>
          <LineChart
            label="Body weight, sample data"
            height={130}
            series={[
              {
                id: 'w',
                label: 'Weigh-in',
                color: 'var(--chart-2)',
                style: 'dots',
                points: b.trend.map((t) => ({
                  x: t.date.getTime(),
                  y: toDisplayWeight(t.kg, unit),
                })),
              },
              {
                id: 't',
                label: 'Trend',
                color: 'var(--chart-1)',
                style: 'line',
                points: b.trend.map((t) => ({
                  x: t.date.getTime(),
                  y: toDisplayWeight(t.trendKg, unit),
                })),
              },
            ]}
            formatY={(v) => v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}
            formatX={(x) => formatDayMonth(new Date(x))}
          />
        </div>
      ) : null}
    </>
  );
}

function Journey({ sample, unit }: SlideProps) {
  return (
    <>
      <Title
        icon={<Sparkles className="size-4" aria-hidden />}
        kicker="Your journey"
        title="Goals with a date you can trust"
        body="Set a target, and the app works out when you will get there at your current rate. Add progress photos that stay on your phone."
      />
      <div className="flex flex-col gap-2.5">
        {sample.goals.map((g) => (
          <div key={g.goal.id} className="rounded-[var(--radius-card)] bg-surface p-4">
            <p className="font-semibold">
              {g.goal.kind === 'body_weight'
                ? `Weigh ${formatWeightValue(g.goal.targetValue, unit)} ${unit}`
                : `Bench press ${formatWeightValue(g.goal.targetValue, unit)} ${unit}`}
            </p>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--ring-track)]">
              <div
                className="h-full rounded-full bg-lime"
                style={{ width: `${(g.fraction ?? 0) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-sm text-text-2">
              {g.projected ? `On course for ${formatShortDate(g.projected)}` : 'Tracking'}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

const TRIAL_DAYS = Math.round(TRIAL_HOURS / 24);

const PLATEAU_FIX: Record<Plateau['suggestion'], string> = {
  rep_range: 'Try a new rep range for the next 4 weeks',
  deload: 'Take a lighter week, then build back up',
  variation: 'Swap in a close variation for a few weeks',
};

/** What Pro adds, shown with the sample lifter's own Pro results. */
function ProSlide({ sample }: SlideProps) {
  const p = sample.progress;
  const plateau = p.plateaus[0];
  const plateauName = plateau
    ? (SYSTEM_EXERCISES.find((e) => e.id === plateau.exerciseId)?.name ?? null)
    : null;
  const weeks = Math.max(1, p.muscles.weeks);
  const muscles = [...p.muscles.workload]
    .sort((a, b) => b.weighted - a.weighted)
    .slice(0, 4)
    .map((m) => ({ label: MUSCLE_LABELS[m.muscle], perWeek: m.weighted / weeks }));
  const top = muscles[0]?.perWeek ?? 1;
  const pushPull = p.balance.find((b) => b.key === 'push_pull' && b.ratio !== null);
  return (
    <>
      <Title
        icon={<Crown className="size-4" aria-hidden />}
        kicker="Overload Pro"
        title="It tells you what to do next"
        body="Pro reads every set and turns it into decisions: when to add weight, what has stalled, which muscles need more. Here is what it found for the sample lifter."
      />
      <div className="flex flex-col gap-2.5">
        {plateau && plateauName ? (
          <div className="pro-rise flex items-center gap-3 rounded-panel border border-border bg-surface p-4">
            <IconTile pro icon={<Zap />} />
            <span className="min-w-0">
              <span className="type-headline block text-text-1">
                {plateauName} has stalled for {plateau.weeks} weeks
              </span>
              <span className="type-meta block text-text-2">{PLATEAU_FIX[plateau.suggestion]}</span>
            </span>
          </div>
        ) : null}
        {muscles.length > 0 ? (
          <div
            className="pro-rise rounded-panel border border-border bg-surface p-4"
            style={{ animationDelay: '90ms' }}
          >
            <p className="type-headline text-text-1">Sets per muscle, each week</p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {muscles.map((m) => (
                <li
                  key={m.label}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3"
                >
                  <span className="type-meta text-text-2">{m.label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-track">
                    <span
                      className="block h-full rounded-full bg-lime"
                      style={{ width: `${(m.perWeek / top) * 100}%` }}
                    />
                  </span>
                  <span className="type-meta tabular text-right text-text-1">
                    {Math.round(m.perWeek)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {pushPull ? (
          <div
            className="pro-rise flex items-center gap-3 rounded-panel border border-border bg-surface p-4"
            style={{ animationDelay: '180ms' }}
          >
            <IconTile pro icon={<Scale />} />
            <span className="min-w-0 flex-1">
              <span className="type-headline block text-text-1">Push to pull</span>
              <span className="type-meta block text-text-2">
                {pushPull.a.sets} push sets, {pushPull.b.sets} pull sets
              </span>
            </span>
            <span className="type-title tabular text-text-1">
              {(pushPull.ratio ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 2 })}
            </span>
          </div>
        ) : null}
      </div>
      <p className="type-meta mt-auto pt-4 text-text-2">
        Also in Pro: progression suggestions, strength levels, weekly check-ins, goal dates and
        all-time trends. Free for your first {TRIAL_DAYS} days with an account.
      </p>
    </>
  );
}

function YourTurn() {
  return (
    <div className="flex flex-1 flex-col justify-center text-center">
      <span className="mx-auto flex size-20 items-center justify-center rounded-panel bg-lime text-on-lime">
        <Sparkles className="size-10" aria-hidden />
      </span>
      <h1 className="type-display mt-6 text-text-1">Now make it yours</h1>
      <p className="type-body mx-auto mt-3 max-w-[36ch] text-text-2">
        A few quick questions, then a routine, rep ranges and daily calories fitted to you. The
        sample lifter goes away; your training starts here.
      </p>
      <ul className="mx-auto mt-6 flex flex-col gap-2 text-left">
        {[
          'Logging, history and records free for good',
          `Every Pro feature free for ${TRIAL_DAYS} days with an account`,
          'No payment details, nothing renews by itself',
        ].map((t) => (
          <li key={t} className="type-meta flex gap-2.5 text-text-1">
            <Check className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SLIDES = [Welcome, Logger, Records, Progress, Body, Journey, ProSlide, YourTurn];
