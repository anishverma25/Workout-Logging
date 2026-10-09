import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  Check,
  ChartNoAxesColumnIncreasing,
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
        <span className="font-display text-[1.05rem] font-semibold">{APP_NAME}</span>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-warn-soft px-2.5 text-xs font-semibold text-warn">
          <FlaskConical className="size-3.5" aria-hidden />
          Sample data
        </span>
        <button
          type="button"
          onClick={() => void finish('/')}
          className="tap-target rounded-full px-2 py-2 font-medium text-faint hover:text-text"
        >
          Skip
        </button>
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
                i === index ? 'w-6 bg-accent' : 'w-2 bg-[var(--line-strong)]',
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
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-accent-text">
        {icon}
        {kicker}
      </p>
      <h1 className="font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.02em]">
        {title}
      </h1>
      <p className="mt-2.5 text-muted">{body}</p>
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
      <h1 className="text-center font-display text-[2.4rem] font-bold leading-[1.05] tracking-[-0.025em]">
        Log fast.
        <br />
        Watch it add up.
      </h1>
      <p className="mx-auto mt-4 max-w-[34ch] text-center text-muted">
        A quick look at what {APP_NAME} does, with the numbers of a sample lifter. Your own training
        starts empty and stays yours.
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
          <p className="text-sm text-muted">Target 3 × 6–10 · RIR 2</p>
        </div>
        <div className="mt-3 grid grid-cols-[1.6rem_minmax(0,1fr)_4rem_3rem_2.75rem] gap-1.5 px-3 pb-1 text-xs font-medium text-faint">
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
              <span className="text-center font-display font-bold text-muted">{i + 1}</span>
              <span className="tabular text-sm text-faint">{s.last}</span>
              <span className="tabular rounded-lg bg-surface-2 py-2.5 text-center font-display font-semibold">
                {ticked ? s.w : <span className="text-faint">{s.w}</span>}
              </span>
              <span className="tabular rounded-lg bg-surface-2 py-2.5 text-center font-display font-semibold">
                {ticked ? s.r : <span className="text-faint">{s.r}</span>}
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
                    : 'border-line-strong bg-surface-2 text-faint',
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
        <span className="text-sm text-faint">rest, then the next set</span>
      </div>
      <p className="mt-auto pt-4 text-sm text-faint">
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
                <span className="block text-sm text-faint">{PR_LABELS[p.type]}</span>
              </span>
              <span className="tabular shrink-0 font-display text-lg font-semibold">
                {formatRecordValue(p.type, p.value, unit)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-3 rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--tile-iris)] to-[var(--tile-plum)] p-5 text-white">
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
            formatY={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
                <span className="text-faint">{l.level ?? 'Starting'}</span>
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
    ['Daily calories', b.energy ? `${b.energy.targetKcal.toLocaleString()}` : '–', 'kcal'],
    [
      'Protein',
      b.energy ? `${b.energy.proteinG[0].toFixed(1)}–${b.energy.proteinG[1].toFixed(1)}` : '–',
      'g',
    ],
    ['BMI', b.bmi ? b.bmi.value.toFixed(1) : '–', ''],
    ['Body fat', b.bodyFat ? b.bodyFat.pct.toFixed(1) : '–', '%'],
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
            <p className="text-[0.8125rem] font-medium text-faint">{label}</p>
            <p className="tabular mt-1 font-display text-[1.6rem] font-semibold tracking-tight">
              {value}
              {u ? <span className="ml-1 text-base text-faint">{u}</span> : null}
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
            formatY={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 })}
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
                className="h-full rounded-full bg-gradient-to-r from-[var(--ring-2)] to-[var(--ring-2-to)]"
                style={{ width: `${(g.fraction ?? 0) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-sm text-faint">
              {g.projected ? `On course for ${formatShortDate(g.projected)}` : 'Tracking'}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

function YourTurn() {
  return (
    <div className="flex flex-1 flex-col justify-center text-center">
      <span className="mx-auto flex size-20 items-center justify-center rounded-[1.5rem] bg-accent text-accent-ink">
        <Sparkles className="size-10" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-[2.2rem] font-bold leading-[1.08] tracking-[-0.02em]">
        Now make it yours
      </h1>
      <p className="mx-auto mt-3 max-w-[34ch] text-muted">
        A few quick questions, then a routine, rep ranges and daily calories fitted to you. The
        sample lifter goes away; your training starts here.
      </p>
    </div>
  );
}

const SLIDES = [Welcome, Logger, Records, Progress, Body, Journey, YourTurn];
