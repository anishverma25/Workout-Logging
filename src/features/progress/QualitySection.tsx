import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { sharesFor } from '@/data/library/shares';
import { BODY_AREA_LABEL, type BodyArea } from '@/domain/analytics/bodyMap';
import type { ProgressModel } from '@/domain/analytics/progress';
import {
  EFFORT_LOGGED_RIR,
  EFFORT_MIN_PAIRS,
  EFFORT_REP_DROP,
  FATIGUE_MIN_SESSIONS,
  FATIGUE_MIN_SETS,
  HEAVY_MAX_REPS,
  MODERATE_MAX_REPS,
  READY_HOURS,
  RECOVERING_HOURS,
  REP_RANGE_MIN_SETS,
  SIDE_GAP,
  SIDE_MIN_SESSIONS,
  effortCheck,
  fatigueSessions,
  readiness,
  repRangeNote,
  wholeShares,
  repRanges,
  setFatigue,
  sideBalance,
  type ExerciseFatigue,
  type Readiness,
} from '@/domain/analytics/quality';
import { buildSessions, type TrainingData } from '@/domain/analytics/sessions';
import { formatNumber, pluralize } from '@/lib/format';
import { EvidenceLink } from '../science/EvidenceLink';
import { SectionIcon } from './SectionIcon';

const MiniBody = lazy(() => import('@/components/body/MiniBody'));

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Header({
  id,
  title,
  science,
  detail,
}: {
  id: string;
  title: string;
  science: string;
  detail: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <SectionIcon id={id} />
        <h2 id={`sec-${id}`} className="type-title text-text-1">
          {title}
        </h2>
        <EvidenceLink topic={science} about={title.toLowerCase()} />
      </div>
      <p className="type-meta mt-0.5 mb-3 line-clamp-2 text-text-2">{detail}</p>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Ready to train (Overview)
// ---------------------------------------------------------------------------------------------

const STATUS: Record<Exclude<Readiness, 'untrained'>, { label: string; color: string }> = {
  ready: { label: `Rested ${READY_HOURS} h+`, color: 'var(--lime)' },
  nearly: { label: `${RECOVERING_HOURS} to ${READY_HOURS} h`, color: 'var(--info)' },
  recovering: { label: `Trained in the last ${RECOVERING_HOURS} h`, color: 'var(--warning)' },
};
const ORDER = ['ready', 'nearly', 'recovering'] as const;

const ago = (hours: number) =>
  hours < 24
    ? pluralize(Math.max(1, Math.round(hours)), 'hour')
    : pluralize(Math.floor(hours / 24), 'day');

export function ReadySection({ data, now }: { data: TrainingData; now: Date }) {
  const areas = useMemo(() => readiness(buildSessions(data), sharesFor, now), [data, now]);
  const trained = areas.filter((a) => a.status !== 'untrained');
  const colors = useMemo(
    () =>
      new Map<BodyArea, string>(
        trained.map((a) => [a.area, STATUS[a.status as keyof typeof STATUS].color]),
      ),
    [trained],
  );
  const sex = data.profile?.sex === 'female' ? 'female' : 'male';
  const nextUp = trained.filter((a) => a.status !== 'ready').sort((a, b) => b.hours! - a.hours!)[0];

  return (
    <section
      id="ready"
      aria-labelledby="sec-ready"
      className="mt-8 scroll-mt-28"
      data-ready-section
    >
      <Header
        id="ready"
        title="Ready to train"
        science="recovery-map"
        detail="Hours since each muscle last had hard sets, over the last two weeks."
      />
      {trained.length === 0 ? (
        <p className="type-subhead rounded-panel bg-surface p-4 text-text-2">
          No hard sets in the last two weeks. Log a workout and this shows which muscles are ready
          for the next one.
        </p>
      ) : (
        <div className="rounded-panel bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="h-36 w-32 shrink-0">
              <Suspense fallback={null}>
                <MiniBody levels={new Map()} colors={colors} sex={sex} show="both" />
              </Suspense>
            </div>
            <ul className="min-w-0 flex-1 space-y-3">
              {ORDER.map((status) => {
                const list = trained.filter((a) => a.status === status);
                return (
                  <li key={status} data-ready-status={status}>
                    <span
                      className="type-caption flex items-center gap-1.5 font-semibold"
                      style={{ color: STATUS[status].color }}
                    >
                      <span className="size-2 rounded-full bg-current" aria-hidden />
                      {STATUS[status].label}
                      <span className="tabular text-text-3">{list.length}</span>
                    </span>
                    <span className="type-footnote mt-0.5 block text-text-1">
                      {list.length ? list.map((a) => BODY_AREA_LABEL[a.area]).join(', ') : 'None'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          {nextUp ? (
            <p className="type-footnote mt-3 text-text-2 shadow-[inset_0_0.5px_0_var(--divider)] pt-3">
              <span className="font-semibold text-text-1">{BODY_AREA_LABEL[nextUp.area]}</span> was
              trained {ago(nextUp.hours!)} ago, with {formatNumber(nextUp.sets)} hard sets.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Training quality (Strength)
// ---------------------------------------------------------------------------------------------

function Card({ label, children, data }: { label: string; children: ReactNode; data: string }) {
  return (
    <li className="rounded-panel bg-surface p-4" data-quality={data}>
      <span className="type-caption block font-semibold text-text-2">{label}</span>
      {children}
    </li>
  );
}

function Locked({ have, need, what }: { have: number; need: number; what: string }) {
  const share = Math.min(1, have / need);
  return (
    <div className="mt-2">
      <p className="type-footnote text-text-2">
        Unlocks at {need} {what}. You have <span className="tabular text-text-1">{have}</span>.
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden>
        <div className="score-grow h-full rounded-full bg-lime" style={{ width: pct(share) }} />
      </div>
    </div>
  );
}

/** Heavy sets in lime, moderate in sky, light in grey. */
const RANGE_SHADES = [
  { bg: 'var(--lime)', opacity: 1 },
  { bg: 'var(--info)', opacity: 1 },
  { bg: 'var(--text-3)', opacity: 0.45 },
] as const;

const FATIGUE_COLOR: Record<ExerciseFatigue['verdict'], string> = {
  holding: 'var(--info)',
  normal: 'var(--info)',
  steep: 'var(--warning)',
};
const FATIGUE_WORD: Record<ExerciseFatigue['verdict'], string> = {
  holding: 'Reps hold',
  normal: 'Normal drop',
  steep: 'Steep drop',
};

export function QualitySection({ data, model }: { data: TrainingData; model: ProgressModel }) {
  const sessions = useMemo(() => {
    const start = model.window.start.getTime();
    const end = model.window.end.getTime();
    return buildSessions(data).filter((s) => {
      const t = s.date.getTime();
      return t >= start && t < end;
    });
  }, [data, model.window]);
  const fatigue = useMemo(() => setFatigue(sessions).slice(0, 3), [sessions]);
  const effort = useMemo(() => effortCheck(sessions), [sessions]);
  const ranges = useMemo(() => repRanges(sessions), [sessions]);
  const sides = useMemo(() => sideBalance(sessions).slice(0, 3), [sessions]);
  const note = repRangeNote(ranges, data.profile?.goal);
  const shares = wholeShares([ranges.heavy, ranges.moderate, ranges.light]);

  return (
    <section
      id="quality"
      aria-labelledby="sec-quality"
      className="mt-8 scroll-mt-28"
      data-quality-section
    >
      <Header
        id="quality"
        title="Training quality"
        science="training-quality"
        detail="How your sets hold up, how hard they really are, and the loads you train with."
      />
      <ul className="grid gap-3 lg:grid-cols-2">
        <Card label="Reps across sets" data="fatigue">
          {fatigue.length === 0 ? (
            <Locked
              have={fatigueSessions(sessions)}
              need={FATIGUE_MIN_SESSIONS}
              what={`sessions of one exercise with ${FATIGUE_MIN_SETS}+ sets at one weight`}
            />
          ) : (
            <ul className="mt-2 space-y-3">
              {fatigue.map((f) => (
                <li key={f.exerciseId}>
                  <div className="flex items-baseline gap-2">
                    <span className="type-subhead min-w-0 flex-1 truncate text-text-1">
                      {f.name}
                    </span>
                    <span className="type-footnote tabular shrink-0 text-text-2">
                      {formatNumber(f.firstReps)} → {formatNumber(f.lastReps)} reps
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill" aria-hidden>
                      <div
                        className="score-grow h-full rounded-full"
                        style={{
                          width: pct(Math.max(0.04, 1 - f.drop)),
                          background: FATIGUE_COLOR[f.verdict],
                        }}
                      />
                    </div>
                    <span
                      className="type-caption shrink-0 font-semibold"
                      style={{ color: f.verdict === 'steep' ? 'var(--warning)' : 'var(--text-2)' }}
                    >
                      {FATIGUE_WORD[f.verdict]} {f.drop > 0 ? `−${pct(f.drop)}` : ''}
                    </span>
                  </div>
                </li>
              ))}
              {fatigue.some((f) => f.verdict === 'steep') ? (
                <li className="type-footnote text-text-2">
                  A steep drop at one weight usually means short rest or a first set near failure.
                </li>
              ) : null}
            </ul>
          )}
        </Card>

        <Card label="Effort check" data="effort">
          {effort.verdict === 'not-enough' ? (
            <Locked
              have={effort.pairs}
              need={EFFORT_MIN_PAIRS}
              what={`sets logged at RIR ${EFFORT_LOGGED_RIR}+ followed by a set at the same weight`}
            />
          ) : (
            <>
              <p className="type-metric tabular mt-1 text-text-1">{pct(effort.share)}</p>
              <p className="type-footnote text-text-2">
                of {pluralize(effort.pairs, 'set')} you logged with {EFFORT_LOGGED_RIR}+ reps left
                lost {EFFORT_REP_DROP} or more reps on the next set.
              </p>
              <p
                className="type-footnote mt-2 font-semibold"
                style={{
                  color: effort.verdict === 'harder' ? 'var(--warning)' : 'var(--lime)',
                }}
              >
                {effort.verdict === 'harder'
                  ? 'Your sets may be closer to failure than you log.'
                  : 'Your logged effort matches how your reps hold.'}
              </p>
            </>
          )}
        </Card>

        <Card label="Rep ranges" data="ranges">
          {ranges.total === 0 ? (
            <Locked have={0} need={REP_RANGE_MIN_SETS} what="weighted sets in this period" />
          ) : (
            <>
              <div className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {RANGE_SHADES.map((shade, i) => {
                  const v = [ranges.heavy, ranges.moderate, ranges.light][i]!;
                  return v > 0 ? (
                    <div
                      key={i}
                      className="score-grow h-full"
                      style={{ flex: v, background: shade.bg, opacity: shade.opacity }}
                    />
                  ) : null;
                })}
              </div>
              <dl className="mt-2.5 grid grid-cols-3 gap-2">
                {[
                  `1 to ${HEAVY_MAX_REPS}`,
                  `${HEAVY_MAX_REPS + 1} to ${MODERATE_MAX_REPS}`,
                  `${MODERATE_MAX_REPS + 1}+`,
                ].map((label, i) => (
                  <div key={label}>
                    <dt className="type-caption flex items-center gap-1.5 text-text-2">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{
                          background: RANGE_SHADES[i]!.bg,
                          opacity: RANGE_SHADES[i]!.opacity,
                        }}
                        aria-hidden
                      />
                      {label} reps
                    </dt>
                    <dd className="type-headline tabular text-text-1">{shares[i]}%</dd>
                  </div>
                ))}
              </dl>
              <p className="type-footnote mt-2 text-text-2" data-range-note={note}>
                {note === 'not-enough'
                  ? `${pluralize(ranges.total, 'set')} so far; the mix means more from ${REP_RANGE_MIN_SETS}.`
                  : note === 'add-heavy'
                    ? 'For your strength goal, add some sets of 1 to 5 reps: strength follows heavy loads.'
                    : note === 'fits-strength'
                      ? 'Enough heavy sets for your strength goal.'
                      : 'Any of these grows muscle when sets are taken close to failure.'}
              </p>
            </>
          )}
        </Card>

        {sides.length ? (
          <Card label="Left and right" data="sides">
            <ul className="mt-2 space-y-2.5">
              {sides.map((s) => (
                <li key={s.exerciseId} className="flex items-baseline gap-2">
                  <span className="type-subhead min-w-0 flex-1 truncate text-text-1">{s.name}</span>
                  <span
                    className="type-footnote tabular shrink-0 font-semibold"
                    style={{ color: s.gap > SIDE_GAP ? 'var(--warning)' : 'var(--text-2)' }}
                  >
                    {s.gap > SIDE_GAP && s.stronger !== 'even'
                      ? `${s.stronger === 'left' ? 'Left' : 'Right'} +${pct(s.gap)}`
                      : 'Even'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="type-footnote mt-2 text-text-2">
              Average gap in reps over {SIDE_MIN_SESSIONS}+ sessions. Over {pct(SIDE_GAP)}, start
              each set with the weaker side.
            </p>
          </Card>
        ) : null}
      </ul>
    </section>
  );
}
