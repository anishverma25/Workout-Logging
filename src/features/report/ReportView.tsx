import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from '@/app/layout/BrandMark';
import { muscleName, type WeeklyReport } from '@/domain/analytics/weekly';
import { cn } from '@/lib/cn';
import { css } from '../share/story/fonts';

/**
 * The weekly report on screen (approved design, Project doc `claude/weekly-intelligence-preview.html`).
 * Quick summary or the full report; every number comes from `WeeklyReport`, which the phone
 * calculated from the person's own logs. Charts are SVG in the theme's colours.
 */

export const DISPLAY = { fontFamily: css('bric') };
export const BODY = { fontFamily: css('dmsans') };
export const MONO = { fontFamily: css('dmmono') };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const isoDate = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
export function rangeLabel(r: WeeklyReport) {
  const a = isoDate(r.weekStart);
  const b = isoDate(r.weekEnd);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} to ${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} to ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}
export const madeLabel = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  return `${LONG_DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

const TONE = {
  good: 'text-up',
  close: 'text-warning',
  off: 'text-danger-text',
  none: 'text-text-2',
} as const;

function Pill({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <span
      className={cn(
        'type-meta inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-0.5 whitespace-nowrap',
        TONE[tone],
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function SectionHead({ eyebrow, title, children, id }: { eyebrow: string; title: string; children?: ReactNode; id: string }) {
  return (
    <div className="mb-5 flex flex-col gap-2" data-report-block>
      <span className="text-[12px] text-text-3" style={MONO}>
        {eyebrow}
      </span>
      <h2 id={id} className="text-[clamp(1.75rem,7vw,2.25rem)] leading-[1.05] font-bold tracking-[-0.03em] text-balance text-text-1" style={DISPLAY}>
        {title}
      </h2>
      {children ? <p className="max-w-[54ch] text-[15px] text-text-2">{children}</p> : null}
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('min-w-0 rounded-[22px] bg-surface p-4 sm:p-5', className)} data-report-block>{children}</div>;
}

function Why({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mt-1 grid">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-1 gap-1 border-t border-divider py-2.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
          <dt className="text-[12px] text-text-3" style={MONO}>
            {k}
          </dt>
          <dd className="m-0 text-[14.5px] text-text-2">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------------------------

/** The ring's filled arc as path data (from 12 o'clock, clockwise), drawn the same in the PDF. */
export function ringArc(cx: number, cy: number, r: number, frac: number): string | null {
  const f = Math.max(0, Math.min(1, frac));
  if (f <= 0) return null;
  if (f >= 0.9999) return `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  const a = f * 2 * Math.PI;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  return `M${cx} ${cy - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

export function RingSvg({ value, of, color }: { value: number; of: number; color: string }) {
  const arc = ringArc(40, 40, 30, of > 0 ? value / of : 0);
  return (
    <svg viewBox="0 0 80 80" className="size-full" aria-hidden>
      <circle cx="40" cy="40" r="30" fill="none" stroke="var(--track)" strokeWidth="7" />
      {arc ? <path d={arc} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" /> : null}
    </svg>
  );
}

function Ring({ value, of, label, color }: { value: number; of: number; label: string; color: string }) {
  return (
    <div className="relative min-w-0 text-center">
      <div className="relative mx-auto aspect-square w-full max-w-[84px]">
        <RingSvg value={value} of={of} color={color} />
        <span className="tabular absolute inset-0 flex items-center justify-center text-[18px] font-bold text-text-1" style={DISPLAY}>
          {value}
          <small className="text-[11px] font-medium text-text-3" style={MONO}>
            /{of}
          </small>
        </span>
      </div>
      <div className="mt-2 text-[12.5px] leading-tight text-text-2">{label}</div>
    </div>
  );
}

export function Timeline({ r }: { r: WeeklyReport }) {
  const target = r.targets.kcal;
  const maint = r.targets.maintenance;
  const max = Math.max(3200, ...r.days.map((d) => d.kcal ?? 0), target ?? 0, maint ?? 0) * 1.05;
  const x0 = 8;
  const step = 46;
  const bw = 26;
  const top = 34;
  const bot = 186;
  const y = (v: number) => bot - (v / max) * (bot - top);
  return (
    <svg viewBox="0 0 340 360" className="block h-auto w-full" role="img" aria-label="Each day of the week: training, calories, protein and weigh-in">
      {[0, 1000, 2000, 3000].map((g) => (
        <line key={g} x1="4" x2="336" y1={y(g)} y2={y(g)} stroke="var(--grid)" />
      ))}
      {target ? <line x1="4" x2="336" y1={y(target)} y2={y(target)} stroke="var(--lime)" strokeDasharray="4 4" strokeWidth="1.4" /> : null}
      {maint ? <line x1="4" x2="336" y1={y(maint)} y2={y(maint)} stroke="var(--report-body)" strokeDasharray="4 4" strokeWidth="1.4" /> : null}
      {[
        ['Calories eaten, green dot when within 10% of target', 224],
        ['Protein, g, green dot at 90% of target', 274],
        ['Weigh-in, kg', 330],
      ].map(([t, yy]) => (
        <text key={t} x="4" y={Number(yy) - 4} fontSize="10" fill="var(--text-3)" style={MONO}>
          {t}
        </text>
      ))}
      {r.days.map((d, i) => {
        const cx = x0 + i * step + step / 2;
        const train = !!d.session;
        return (
          <g key={d.date}>
            {d.kcal !== null ? <rect x={cx - bw / 2} y={y(d.kcal)} width={bw} height={bot - y(d.kcal)} rx="6" fill="var(--report-food)" opacity={train ? 1 : 0.4} /> : null}
            {train ? (
              <>
                <rect x={cx - 20} y="4" width="40" height="22" rx="11" fill="var(--lime)" />
                <text x={cx} y="19" textAnchor="middle" fontSize="10.5" fontWeight="500" fill="var(--on-lime)" style={MONO}>
                  {d.session!.length > 6 ? `${d.session!.slice(0, 5)}.` : d.session}
                </text>
              </>
            ) : (
              <text x={cx} y="19" textAnchor="middle" fontSize="11" fill="var(--text-3)" style={MONO}>
                Rest
              </text>
            )}
            <text x={cx} y={bot + 18} textAnchor="middle" fontSize="11" fill="var(--text-1)" style={MONO}>
              {DAYS[d.weekday]}
            </text>
            <text x={cx} y="245" textAnchor="middle" fontSize="11" fill={d.kcal === null ? 'var(--text-3)' : 'var(--text-1)'} style={MONO}>
              {d.kcal === null ? 'none' : fmt(d.kcal)}
            </text>
            {d.kcalOk !== null ? <circle cx={cx} cy="254" r="2.7" fill={d.kcalOk ? 'var(--up)' : 'var(--warning)'} /> : null}
            <text x={cx} y="295" textAnchor="middle" fontSize="11" fill={d.proteinG === null ? 'var(--text-3)' : 'var(--text-1)'} style={MONO}>
              {d.proteinG === null ? 'none' : d.proteinG}
            </text>
            {d.proteinOk !== null ? <circle cx={cx} cy="304" r="2.7" fill={d.proteinOk ? 'var(--up)' : 'var(--danger)'} /> : null}
            <text x={cx} y="349" textAnchor="middle" fontSize="11" fill={d.weightKg === null ? 'var(--text-3)' : 'var(--report-body)'} style={MONO}>
              {d.weightKg === null ? 'none' : d.weightKg.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LiftChart({ lift }: { lift: WeeklyReport['lifts'][number] }) {
  const W = 340;
  const H = 64;
  const p = 6;
  const vals = lift.weeks.filter((v): v is number => v !== null);
  const mn = Math.min(...vals, lift.base * 0.95) - 1;
  const mx = Math.max(...vals, lift.base * 1.05) + 1;
  const X = (i: number) => p + (i * (W - 2 * p)) / 7;
  const Y = (v: number) => H - p - ((v - mn) / (mx - mn)) * (H - 2 * p);
  const pts = lift.weeks.map((v, i) => (v === null ? null : `${X(i).toFixed(1)} ${Y(v).toFixed(1)}`)).filter(Boolean);
  const col = lift.real ? 'var(--lime)' : 'var(--text-2)';
  const lastI = lift.weeks[7] !== null ? 7 : 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
      <rect x={X(3)} y={Y(lift.base * 1.05)} width={X(7) - X(3)} height={Y(lift.base * 0.95) - Y(lift.base * 1.05)} fill="var(--lime-dim)" />
      <path d={`M${pts.join(' L')}`} fill="none" stroke={col} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={X(3)} cy={Y(lift.base)} r="3.5" fill="var(--surface)" stroke="var(--text-3)" strokeWidth="1.6" />
      <circle cx={X(lastI)} cy={Y(lift.now)} r="4.5" fill={col} />
    </svg>
  );
}

export function MuscleChart({ rows }: { rows: WeeklyReport['muscles'] }) {
  const shown = rows.slice(0, 10);
  const max = Math.max(18, ...shown.map((m) => Math.max(m.sets, m.usual ?? 0)));
  const lx = 92;
  const W = 196;
  const rh = 30;
  return (
    <svg viewBox={`0 0 340 ${shown.length * rh + 24}`} className="block h-auto w-full" role="img" aria-label="Hard sets per muscle this week against your 4 week average">
      <text x={lx + W + 10} y="10" fontSize="10" fill="var(--text-3)" style={MONO}>
        days
      </text>
      {shown.map((m, i) => {
        const y = i * rh + 20;
        const w = (m.sets / max) * W;
        const low = m.usual !== null && m.sets < m.usual - 0.5;
        return (
          <g key={m.muscle}>
            <text x="0" y={y + 15} fontSize="11" fill="var(--text-1)" style={MONO}>
              {muscleName(m.muscle)}
            </text>
            <rect x={lx} y={y} width={W} height="22" rx="8" fill="var(--grid)" />
            <rect x={lx} y={y} width={Math.max(w, 2)} height="22" rx="8" fill={low ? 'var(--report-food)' : 'var(--lime)'} />
            {m.usual !== null ? <rect x={lx + (m.usual / max) * W - 1.5} y={y - 3} width="3" height="28" rx="1.5" fill="var(--text-1)" /> : null}
            <text x={lx + 8} y={y + 15} fontSize="11" fontWeight="500" fill="var(--on-lime)" style={MONO}>
              {m.sets}
            </text>
            <text x={lx + W + 10} y={y + 15} fontSize="11" fill="var(--text-3)" style={MONO}>
              {m.sessions}x
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function WeightChart({ body }: { body: NonNullable<WeeklyReport['body']> }) {
  const pts = body.points;
  const W = 340;
  const H = 220;
  const l = 34;
  const rt = 8;
  const t = 10;
  const b = 28;
  const kgs = pts.flatMap((p) => [p.kg, p.trend ?? p.kg]);
  const mn = Math.floor(Math.min(...kgs) - 0.4);
  const mx = Math.ceil(Math.max(...kgs) + 0.4);
  const first = isoDate(pts[0]!.date).getTime();
  const span = Math.max(1, (isoDate(pts[pts.length - 1]!.date).getTime() - first) / 864e5);
  const X = (k: string) => l + ((isoDate(k).getTime() - first) / 864e5 / span) * (W - l - rt);
  const Y = (v: number) => t + ((mx - v) / (mx - mn)) * (H - t - b);
  const ticks = Array.from({ length: mx - mn + 1 }, (_, i) => mn + i).filter((v, _, a) => a.length <= 6 || v % 2 === 0);
  const trend = pts.filter((p) => p.trend !== null);
  let band: ReactNode = null;
  if (body.band && trend.length) {
    const s0 = isoDate(body.band.start).getTime();
    const edge = (rate: number) =>
      trend.map((p) => `${X(p.date).toFixed(1)},${Y(body.band!.startKg * (1 - (rate / 100) * ((isoDate(p.date).getTime() - s0) / 6048e5))).toFixed(1)}`);
    band = <polygon points={[...edge(0.5), ...edge(1).reverse()].join(' ')} fill="var(--report-body)" opacity="0.16" />;
  }
  const last = trend[trend.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Body weight over 4 weeks with the 7 day average">
      {ticks.map((g) => (
        <g key={g}>
          <line x1={l} x2={W - rt} y1={Y(g)} y2={Y(g)} stroke="var(--grid)" />
          <text x={l - 6} y={Y(g) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)" style={MONO}>
            {g}
          </text>
        </g>
      ))}
      {band}
      {pts.map((p) => (
        <circle key={p.date} cx={X(p.date)} cy={Y(p.kg)} r="2.5" fill="var(--report-body)" opacity="0.5" />
      ))}
      {trend.length > 1 ? (
        <path d={`M${trend.map((p) => `${X(p.date).toFixed(1)} ${Y(p.trend!).toFixed(1)}`).join(' L')}`} fill="none" stroke="var(--report-body)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {last ? (
        <>
          <circle cx={X(last.date)} cy={Y(last.trend!)} r="5" fill="var(--report-body)" />
          <text x={X(last.date) - 4} y={Y(last.trend!) + 22} textAnchor="end" fontSize="13" fill="var(--text-1)" style={MONO}>
            {last.trend!.toFixed(1)} kg
          </text>
        </>
      ) : null}
    </svg>
  );
}

export function MealChart({ meals, aim }: { meals: NonNullable<WeeklyReport['nutrition']>['meals']; aim: number | null }) {
  const bot = 150;
  const top = 26;
  const max = Math.max(50, ...meals.map((m) => m.avgG), aim ?? 0) * 1.1;
  // Bars stay left of a 40 unit gutter that holds the aim label, so a tall bar never covers it.
  const step = 300 / Math.max(4, meals.length);
  const bw = Math.min(56, step - 26);
  const y = (v: number) => bot - (v / max) * (bot - top);
  const label = { breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Snacks', dinner: 'Dinner' } as const;
  return (
    <svg viewBox="0 0 340 190" className="block h-auto w-full" role="img" aria-label="Average protein at each meal">
      {aim ? (
        <>
          <line x1="0" x2="340" y1={y(aim)} y2={y(aim)} stroke="var(--lime)" strokeDasharray="4 4" />
          <text x="340" y={y(aim) - 6} textAnchor="end" fontSize="11" fill="var(--lime)" style={MONO}>
            {aim} g
          </text>
        </>
      ) : null}
      {meals.map((m, i) => {
        const cx = step * i + step / 2;
        const low = aim !== null && m.avgG < aim * 0.9;
        return (
          <g key={m.meal}>
            <rect x={cx - bw / 2} y={y(m.avgG)} width={bw} height={bot - y(m.avgG)} rx="9" fill={low ? 'var(--report-food)' : 'var(--text-3)'} />
            {/* A backing in the panel colour keeps the value readable where the aim line crosses it. */}
            <rect x={cx - (String(m.avgG).length + 2) * 4.2} y={y(m.avgG) - 21} width={(String(m.avgG).length + 2) * 8.4} height="18" rx="4" fill="var(--surface)" />
            <text x={cx} y={y(m.avgG) - 7} textAnchor="middle" fontSize="13" fill="var(--text-1)" style={MONO}>
              {m.avgG} g
            </text>
            <text x={cx} y={bot + 20} textAnchor="middle" fontSize="11" fill="var(--text-1)" style={MONO}>
              {label[m.meal]}
            </text>
          </g>
        );
      })}
      <line x1="0" x2="340" y1={bot} y2={bot} stroke="var(--border-strong)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------


type Head = { eyebrow: string; title: string; intro?: string };

/** Section headings, shared by the screen and the PDF. */
export function sectionCopy(r: WeeklyReport): Record<
  'numbers' | 'last' | 'days' | 'short' | 'find' | 'strength' | 'volume' | 'body' | 'food' | 'next' | 'inputs' | 'method',
  Head
> {
  const c = r.counts;
  const missing = r.inputs.filter((i) => !i.has).length;
  const moved = r.lifts.filter((l) => l.real && l.pct > 0).length;
  const ch = r.body?.changeKg ?? null;
  const n = r.actions.length;
  return {
    numbers: {
      eyebrow: 'Your week in numbers',
      title: c.planned && c.sessions >= c.planned ? 'Showing up was not the problem' : 'Your week in numbers',
    },
    last: { eyebrow: "Last week's plan", title: 'Did the changes happen?' },
    days: { eyebrow: 'Training meets food', title: 'The week, day by day' },
    short: { eyebrow: 'What we noticed', title: 'The short version' },
    find: {
      eyebrow: 'What both logs say together',
      title: 'Patterns from your week',
      intro:
        'Established means a clear rule on your own numbers. Early signal means a pattern worth watching that does not prove cause, and it never changes your advice.',
    },
    strength: {
      eyebrow: 'Strength',
      title: `${moved} of ${r.lifts.length} ${plural(r.lifts.length, 'lift')} moved`,
      intro: 'Estimated 1RM over 8 weeks. Week to week moves under 5% are noise, so we judge over 4 weeks.',
    },
    volume: {
      eyebrow: 'Training volume',
      title: 'Sets for each muscle',
      intro:
        'Weekly hard sets: working sets within 4 reps of failure. A muscle used as a helper counts half, so muscle totals add up to more than your sets.',
    },
    body: {
      eyebrow: 'Body and energy',
      title:
        ch === null
          ? 'Your weight'
          : ch === 0
            ? `Weight steady at ${r.body?.weekMean ?? ''} kg`
            : `Weight ${ch < 0 ? 'down' : 'up'} ${Math.abs(ch)} kg`,
      intro: `Daily weights are noisy, so the line is your 7 day average.${r.body?.band ? ' The band is the 0.5 to 1% a week pace often used on a cut.' : ''} Scale weight includes water, so it shows pace, not how much of it was fat.`,
    },
    food: { eyebrow: 'Nutrition', title: 'Your food against your own targets' },
    next: {
      eyebrow: 'Next week',
      title: `${n === 1 ? 'One change' : `${n === 2 ? 'Two' : 'Three'} changes`}, each with a check`,
      intro: 'Picked from the biggest gaps above. Your next report marks each one.',
    },
    inputs: {
      eyebrow: 'Make it yours',
      title: missing
        ? `Your report gets sharper with ${missing} more ${plural(missing, 'input')}`
        : 'Every input is in',
      intro: `Core data this week: ${c.sessions} ${plural(c.sessions, 'workout')}, ${c.foodDays} food ${plural(c.foodDays, 'day')} and ${c.weighIns} ${plural(c.weighIns, 'weigh-in')}.${missing ? ' These optional extras make the report more precise.' : ''}`,
    },
    method: { eyebrow: 'How this was made', title: 'Maths decides. Nothing is guessed.' },
  };
}

export const SOURCES = [
  "Morton et al. 2018. Br J Sports Med 52(6):376 to 384. Protein benefits plateau near 1.6 g per kg.",
  "Helms et al. 2014. J Int Soc Sports Nutr 11:20. Losing 0.5 to 1% of body weight a week keeps muscle.",
  "Orsama et al. 2014. Obesity Facts 7(1):36 to 47. Weight swings across the week; use a 7 day average.",
  "Grgic et al. 2020. Sports Med Open 6:31. 1RM test noise is about 4%.",
  "Pelland et al. 2026. Sports Med 56(2):481 to 505. More hard sets build more muscle, with diminishing returns.",
  "Schoenfeld, Grgic, Krieger 2019. J Sports Sci 37(11):1286 to 1295. Frequency matters less when volume is equal.",
];

export const METHOD_TEXT =
  'Every number, finding and change in this report comes from fixed rules on your own logs, calculated on your phone. A part with too little data is left out instead of guessed.';
export const DISCLAIMER = 'Educational information about training and nutrition, not medical advice.';

/** The nutrition table: label, detail, value and unit. */
export function foodRows(r: WeeklyReport, n: NonNullable<WeeklyReport['nutrition']>): [string, string, string, string][] {
  return [
                  n.proteinTarget ? ['Protein against your target', `You ate ${n.proteinAvg} g a day${n.proteinPerKg ? `, ${n.proteinPerKg} g per kg` : ''}`, `${Math.round((n.proteinAvg / n.proteinTarget) * 100)}%`, `of ${n.proteinTarget} g`] : ['Protein a day', n.proteinPerKg ? `${n.proteinPerKg} g per kg` : 'No target set', `${n.proteinAvg}`, 'g'],
                  ['Days logged well', 'Days with at least 1,000 kcal logged', `${n.loggedDays} of 7`, 'days'],
                  ...(n.calorieDays !== null ? [['Calorie adherence', `Within 10% of target; ${n.caloriePct !== null ? `${Math.abs(n.caloriePct)}% ${n.caloriePct >= 0 ? 'over' : 'under'} on average` : ''}`, `${n.calorieDays} of ${n.loggedDays}`, 'days']] : []),
                  ...(r.energy ? [energyRow(r.energy)] : []),
                  ] as [string, string, string, string][];
}

export const MEAL_SUMMARY = (n: NonNullable<WeeklyReport['nutrition']>) =>
  `Also: fibre was ${n.fibreAvg} g against about ${n.fibreAim} g${n.carbsTraining !== null ? `, and training day carbs ${n.carbsTraining} g per kg against 4 or more` : ''}.`;

/** The first sentence of a longer text, with one full stop. */
export const firstSentence = (s: string) => `${s.split('. ')[0]!.replace(/\.+$/, '')}.`;

const balance = (kcal: number) => (kcal >= 0 ? 'deficit' : 'surplus');

/** The energy row of the nutrition table, worded by whether it was a deficit or a surplus. */
export function energyRow(e: NonNullable<WeeklyReport['energy']>): [string, string, string, string] {
  const kind = balance(e.actualDeficit);
  return [
    `${kind === 'deficit' ? 'Deficit' : 'Surplus'} that happened`,
    e.plannedDeficit !== null ? `Your target plans a ${fmt(Math.abs(e.plannedDeficit))} kcal ${balance(e.plannedDeficit)}` : 'From your intake and weight trend',
    `about ${fmt(Math.abs(e.actualDeficit))}`,
    'kcal a day',
  ];
}

export function energyNote(e: NonNullable<WeeklyReport['energy']>): string {
  const planned =
    e.plannedDeficit !== null
      ? `Your target plans a ${fmt(Math.abs(e.plannedDeficit))} kcal ${balance(e.plannedDeficit)} a day; your intake and weight show about a ${fmt(Math.abs(e.actualDeficit))} kcal ${balance(e.actualDeficit)}. `
      : '';
  return `${planned}Maintenance is estimated from 4 weeks of your intake and weight, which usually beats a formula but is still an estimate.`;
}

export type ReportMode = 'quick' | 'full';
export type ReportLang = 'en' | 'hi';

export const TILE: Record<WeeklyReport['tiles'][number]['key'], { label: string; unit: string; fmt: (v: number) => string }> = {
  hardSets: { label: 'Hard sets', unit: '', fmt: (v) => fmt(v) },
  volume: { label: 'Volume lifted', unit: 't', fmt: (v) => (v / 1000).toFixed(1) },
  minutes: { label: 'Time training', unit: '', fmt: (v) => `${Math.floor(v / 60)}h ${String(Math.round(v % 60)).padStart(2, '0')}` },
  effort: { label: 'Effort', unit: 'RIR', fmt: (v) => v.toFixed(1) },
  kcal: { label: 'Calories a day', unit: 'kcal', fmt: (v) => fmt(v) },
  protein: { label: 'Protein a day', unit: 'g', fmt: (v) => fmt(v) },
};

export function tileNote(t: WeeklyReport['tiles'][number]) {
  if (t.key === 'effort') return 'Reps left in the tank, average';
  if (t.usual === null) return 'This week';
  const d = t.value - t.usual;
  if (Math.abs(d) < Math.max(1, t.usual * 0.03)) return 'Same as usual';
  if (t.key === 'volume' || t.key === 'minutes') return `${Math.abs(Math.round((d / Math.max(1, t.usual)) * 100))}% ${d > 0 ? 'more' : 'less'} than usual`;
  return `${fmt(Math.abs(d))} ${d > 0 ? 'more' : 'fewer'} than usual`;
}

export function ReportView({
  report: r,
  number,
  mode,
  onMode,
  lang,
  onLang,
  actions,
}: {
  report: WeeklyReport;
  number: number;
  mode: ReportMode;
  onMode: (m: ReportMode) => void;
  lang: ReportLang;
  onLang: (l: ReportLang) => void;
  actions?: ReactNode;
}) {
  const full = mode === 'full';
  const n = r.nutrition;
  const c = r.counts;
  const copy = sectionCopy(r);
  return (
    <article className="mx-auto w-full max-w-[720px] pb-10 text-text-1" style={BODY} data-report>
      <header className="relative pt-2 pb-2" data-report-block>
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-[34px] shrink-0" />
          <b className="text-[21px] font-bold tracking-[-0.02em]" style={DISPLAY}>
            Macrotrophy
          </b>
          <span className="ml-auto text-[12px] text-text-3" style={MONO}>
            Weekly intelligence
          </span>
        </div>
        <div className="mt-8 text-[13px] text-lime" style={MONO}>
          Report {number}
        </div>
        <h1 className="mt-2 text-[clamp(3.25rem,15vw,5.5rem)] leading-[0.92] font-extrabold tracking-[-0.04em]" style={DISPLAY} data-report-title>
          {rangeLabel(r)}
        </h1>
        <p className="mt-3.5 text-[14px] text-text-2">
          Made {madeLabel(r.madeAt)}, from {c.sessions} {plural(c.sessions, 'workout')}, {c.foodDays} food {plural(c.foodDays, 'day')} and {c.weighIns} {plural(c.weighIns, 'weigh-in')}.
        </p>
        <p className="mt-6 max-w-[26ch] text-[clamp(1.375rem,5.6vw,1.875rem)] leading-[1.22] font-semibold tracking-[-0.02em] text-balance" style={DISPLAY} data-report-verdict>
          {lang === 'hi' ? r.verdict.hi : r.verdict.en}
        </p>
        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[12.5px] text-text-3">
          <span>Read it in</span>
          {(['en', 'hi'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => onLang(l)} className={cn('rounded-full border px-3 py-1 text-[12.5px]', lang === l ? 'border-text-1 bg-text-1 text-bg' : 'border-border-strong text-text-2')}>
              {l === 'en' ? 'English' : 'Hinglish'}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Reading mode" className="mt-5 flex w-max max-w-full gap-1.5 rounded-full border border-border-strong p-1">
          {(['quick', 'full'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => onMode(m)} className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-medium', mode === m ? 'bg-text-1 text-bg' : 'text-text-2')}>
              {m === 'quick' ? 'Quick summary' : 'Full report'}
            </button>
          ))}
        </div>
        {actions}
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          {(
            [
              ['Training', r.pillars.training, 'var(--lime)'],
              ['Nutrition', r.pillars.nutrition, 'var(--report-food)'],
              ['Body', r.pillars.body, 'var(--report-body)'],
            ] as const
          ).map(([k, p, col]) => (
            <div key={k} className="flex min-w-0 flex-col gap-2 rounded-[18px] bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[12.5px] text-text-2">
                <span aria-hidden className="size-2 rounded-full" style={{ background: col }} />
                {k}
              </div>
              <div className="text-[19px] leading-[1.1] font-bold tracking-[-0.02em] break-words" style={DISPLAY}>
                {p.label}
              </div>
              <div className="text-[12px] leading-snug text-text-3">{p.detail}</div>
            </div>
          ))}
        </div>
        {r.win ? (
          <div className="mt-3 grid gap-1.5 rounded-[22px] border border-lime/25 bg-lime-dim p-5" data-report-win>
            <span className="text-[12px] text-lime" style={MONO}>
              Win of the week
            </span>
            <div className="tabular text-[clamp(3rem,14vw,4.25rem)] leading-none font-extrabold tracking-[-0.04em] text-lime" style={DISPLAY}>
              {r.win.big}
            </div>
            <p className="text-[14.5px] text-text-2">
              <b className="font-semibold text-text-1">{r.win.title}.</b> {r.win.detail}
            </p>
          </div>
        ) : null}
        {r.actions.length ? (
          <div className="mt-3 rounded-[22px] border border-border-strong bg-surface p-4">
            <h3 className="mb-1.5 text-[16px] font-semibold" style={DISPLAY}>
              What to do differently next week
            </h3>
            {r.actions.map((a, i) => (
              <div key={a.id} className="grid grid-cols-[26px_1fr] items-start gap-2.5 border-t border-divider py-2.5 first-of-type:border-t-0">
                <i className="grid size-[26px] place-items-center rounded-full bg-lime text-[13px] font-extrabold text-on-lime not-italic" style={DISPLAY}>
                  {i + 1}
                </i>
                <div className="text-[14.5px]">
                  {lang === 'hi' ? a.titleHi : a.title}
                  <span className="block text-[13px] text-text-2">{firstSentence(a.detail)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </header>

      <Section id="r-numbers" {...copy.numbers}>
        <Panel>
          <div className="grid grid-cols-4 gap-1.5">
            <Ring value={c.sessions} of={Math.max(c.planned ?? c.sessions, c.sessions, 1)} label="Sessions" color="var(--lime)" />
            {c.calorieDays !== null ? <Ring value={c.calorieDays} of={7} label="Calorie days" color="var(--report-food)" /> : <Ring value={c.foodDays} of={7} label="Food days" color="var(--report-food)" />}
            {c.proteinDays !== null ? <Ring value={c.proteinDays} of={7} label="Protein days" color="var(--report-food)" /> : <Ring value={c.records} of={Math.max(c.records, 1)} label="Records" color="var(--report-food)" />}
            <Ring value={c.weighIns} of={7} label="Weigh-ins" color="var(--report-body)" />
          </div>
        </Panel>
        {full && r.tiles.length ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-divider sm:grid-cols-3" data-report-block>
              {r.tiles.map((t) => (
                <div key={t.key} className="min-w-0 bg-surface px-3.5 py-4">
                  <div className="text-[13px] text-text-2">{TILE[t.key].label}</div>
                  <div className="tabular mt-1.5 text-[30px] leading-[1.1] font-bold tracking-[-0.035em]" style={DISPLAY}>
                    {TILE[t.key].fmt(t.value)}
                    {TILE[t.key].unit ? <small className="ml-1 text-[14px] font-semibold tracking-normal text-text-2" style={BODY}>{TILE[t.key].unit}</small> : null}
                  </div>
                  <div className={cn('mt-1.5 text-[12.5px] text-text-3', t.usual !== null && t.value > t.usual * 1.03 && t.key !== 'kcal' && 'text-up')}>{tileNote(t)}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] text-text-3">Compared with your average of the 4 weeks before, when your history covers them. A calorie day lands within 10% of your target; a protein day reaches 90% of it.</p>
          </>
        ) : null}
      </Section>

      {r.lastWeek?.length ? (
        <Section id="r-last" {...copy.last}>
          <Panel>
            {r.lastWeek.map((x) => (
              <div key={x.title} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 border-t border-divider py-3 first:border-t-0">
                <span className={cn('grid size-7 place-items-center rounded-full text-[14px] font-bold', x.done ? 'bg-up-dim text-up' : 'bg-down-dim text-down-text')} aria-hidden>
                  {x.done ? '✓' : '×'}
                </span>
                <div>
                  <b className="block text-[14.5px] leading-tight font-semibold">{x.title}</b>
                  <span className="mt-0.5 block text-[13px] text-text-2">{x.result}</span>
                </div>
                <span className="text-[12.5px] whitespace-nowrap text-text-2" style={MONO}>
                  {x.done ? 'Done' : 'Missed'}
                </span>
              </div>
            ))}
          </Panel>
        </Section>
      ) : null}

      <Section id="r-days" {...copy.days}>
        <Panel>
          <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-text-2">
            <span className="inline-flex items-center gap-1.5"><i className="size-[11px] rounded-[3px] bg-report-food" aria-hidden />Calories eaten</span>
            {r.targets.kcal ? <span className="inline-flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-lime" aria-hidden />Target {fmt(r.targets.kcal)}</span> : null}
            {r.targets.maintenance ? <span className="inline-flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-report-body" aria-hidden />Estimated maintenance {fmt(r.targets.maintenance)}</span> : null}
          </div>
          <Timeline r={r} />
        </Panel>
      </Section>

      {!full && r.findings.length ? (
        <Section id="r-short" {...copy.short}>
          <Panel>
            {r.findings.slice(0, 3).map((f) => (
              <div key={f.id} className="grid grid-cols-[auto_1fr] items-start gap-3 border-t border-divider py-3.5 first:border-t-0 first:pt-0">
                <Pill tone={f.label === 'established' ? 'good' : 'none'}>{f.label === 'established' ? 'Established' : 'Early signal'}</Pill>
                <div>
                  <b className="block text-[15px] font-semibold">{f.title}</b>
                  <span className="mt-0.5 block text-[13.5px] text-text-2">{f.saw}</span>
                </div>
              </div>
            ))}
          </Panel>
          <p className="mt-3 text-[12.5px] text-text-3">The full report adds the 8 week strength charts, muscle volume, body and energy, nutrition detail and the evidence behind each number.</p>
        </Section>
      ) : null}

      {full && r.findings.length ? (
        <Section id="r-find" {...copy.find}>
          <div className="flex flex-col gap-3">
            {r.findings.map((f) => (
              <Panel key={f.id}>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <Pill tone={f.label === 'established' ? 'good' : 'none'}>{f.label === 'established' ? 'Established' : 'Early signal'}</Pill>
                </div>
                <h3 className="mt-3 text-[20px] leading-tight font-bold" style={DISPLAY}>{f.title}</h3>
                <Why rows={[['What we saw', f.saw], [f.label === 'early' ? 'How sure we are' : 'Why it matters', f.why], ...(f.evidence.length ? ([['Evidence', f.evidence.join(', ')]] as [string, ReactNode][]) : [])]} />
              </Panel>
            ))}
          </div>
        </Section>
      ) : null}

      {full && r.lifts.length ? (
        <Section id="r-strength" {...copy.strength}>
          <Panel>
            <div className="grid gap-6">
              {r.lifts.map((l) => (
                <div key={l.exerciseId}>
                  <div className="mb-2 flex flex-col items-start gap-2">
                    <div>
                      <div className="text-[17px] font-semibold" style={DISPLAY}>{l.name}</div>
                      <div className="tabular text-[13px] text-text-2">{l.now} kg now, {l.base} kg four weeks ago</div>
                    </div>
                    <Pill tone={l.real ? (l.pct > 0 ? 'good' : 'close') : 'none'}>{l.pct > 0 ? '+' : ''}{l.pct}% {l.real ? (l.pct > 0 ? 'real gain' : 'real drop') : 'within noise'}</Pill>
                  </div>
                  <LiftChart lift={l} />
                </div>
              ))}
            </div>
          </Panel>
          <p className="mt-3 text-[12.5px] text-text-3">Epley estimate from sets of up to 10 reps; an estimate, not a tested max. The shaded strip is the 5% band around the level 4 weeks ago.</p>
        </Section>
      ) : null}

      {full && r.muscles.length ? (
        <Section id="r-volume" {...copy.volume}>
          <Panel>
            <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-text-2">
              <span className="inline-flex items-center gap-1.5"><i className="size-[11px] rounded-[3px] bg-lime" aria-hidden />This week</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-[11px] rounded-[3px] bg-report-food" aria-hidden />Below your usual</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-[13px] w-[3px] rounded-[2px] bg-text-1" aria-hidden />Your 4 week average</span>
            </div>
            <MuscleChart rows={r.muscles} />
            <p className="mt-2 text-[13.5px] text-text-2">What matters most is enough hard sets for each muscle across the week, usually spread over about 2 sessions. We compare you with your own average, not a fixed number.</p>
          </Panel>
        </Section>
      ) : null}

      {full && r.body ? (
        <Section id="r-body" {...copy.body}>
          <Panel>
            <WeightChart body={r.body} />
            {r.body.projection ? (
              <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4 border-t border-divider pt-4">
                <div className="tabular text-[34px] leading-none font-extrabold tracking-[-0.04em] text-report-body" style={DISPLAY}>
                  {r.body.projection.weeksLo === r.body.projection.weeksHi ? r.body.projection.weeksLo : `${r.body.projection.weeksLo} to ${r.body.projection.weeksHi}`}
                  <small className="ml-1 text-[14px] font-semibold tracking-normal text-text-2">weeks</small>
                </div>
                <p className="text-[14px] text-text-2">Estimate: if your recent pace holds, <b className="text-text-1">{r.body.projection.targetKg} kg</b> lands in this range. It moves as your trend moves.</p>
              </div>
            ) : null}
            {r.energy ? (
              <>
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-1.5 border-t border-divider pt-4 text-center">
                  <div><div className="tabular text-[24px] leading-tight font-bold" style={DISPLAY}>{fmt(r.energy.meanIntake)}</div><div className="mt-1 text-[12px] leading-snug text-text-2">Eaten a day, average kcal</div></div>
                  <div className="pt-1 text-[20px] text-text-3" style={MONO}>{r.energy.actualDeficit >= 0 ? '+' : '−'}</div>
                  <div><div className="tabular text-[24px] leading-tight font-bold" style={DISPLAY}>{fmt(Math.abs(r.energy.actualDeficit))}</div><div className="mt-1 text-[12px] leading-snug text-text-2">{r.energy.actualDeficit >= 0 ? 'From your body' : 'Stored by your body'}, {Math.abs(r.energy.changeKgPerWeek)} kg a week</div></div>
                  <div className="pt-1 text-[20px] text-text-3" style={MONO}>=</div>
                  <div><div className="tabular text-[24px] leading-tight font-bold text-report-body" style={DISPLAY}>{fmt(r.energy.maintenance)}</div><div className="mt-1 text-[12px] leading-snug text-text-2">Estimated maintenance</div></div>
                </div>
                <p className="mt-3.5 text-[14px] text-text-2">
                  {energyNote(r.energy)}
                </p>
              </>
            ) : null}
          </Panel>
          <p className="mt-3 text-[12.5px] text-text-3">One kilogram of body weight is treated as 7,700 kcal. Sources: Orsama 2014, Helms 2014.</p>
        </Section>
      ) : null}

      {full && n ? (
        <Section id="r-food" {...copy.food}>
          <Panel>
            <div className="grid">
              {foodRows(r, n).map(([k, d, v, u]) => (
                <div key={k} className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-t border-divider py-3 first:border-t-0 first:pt-0.5">
                  <div className="text-[14px] text-text-2"><b className="block text-[14.5px] font-semibold text-text-1">{k}</b>{d}</div>
                  <div className="tabular text-right text-[20px] font-bold tracking-[-0.02em]" style={DISPLAY}>{v}<small className="block text-[12px] font-normal tracking-normal text-text-3" style={MONO}>{u}</small></div>
                </div>
              ))}
            </div>
          </Panel>
          {n.meals.length ? (
            <Panel className="mt-3">
              <h3 className="text-[18px] font-semibold" style={DISPLAY}>Protein at each meal</h3>
              {n.mealAim ? <p className="mt-1.5 text-[14px] text-text-2">Aim for about {n.mealAim} g a meal, which is 0.4 g per kg of your weight.</p> : null}
              <MealChart meals={n.meals} aim={n.mealAim} />
              <p className="mt-1 text-[14px] text-text-2">
                {MEAL_SUMMARY(n)}
              </p>
            </Panel>
          ) : null}
          <p className="mt-3 text-[12.5px] text-text-3">Protein benefits level off around 1.6 g per kg a day (Morton 2018).</p>
        </Section>
      ) : null}

      {r.actions.length ? (
        <Section id="r-next" {...copy.next}>
          <Panel>
            {r.actions.map((a, i) => (
              <div key={a.id} className="grid grid-cols-[34px_1fr] gap-3.5 border-t border-divider py-4 first:border-t-0 first:pt-0.5">
                <div className="grid size-[34px] place-items-center rounded-full bg-lime text-[16px] font-extrabold text-on-lime" style={DISPLAY}>{i + 1}</div>
                <div>
                  <h3 className="text-[19px] leading-tight font-semibold" style={DISPLAY}>{lang === 'hi' ? a.titleHi : a.title}</h3>
                  <p className="mt-1.5 text-[14.5px] text-text-2">{a.detail}</p>
                  <div className="mt-2.5 rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] text-text-2"><b className="font-semibold text-text-1">We will check:</b> {a.checkText}</div>
                </div>
              </div>
            ))}
          </Panel>
        </Section>
      ) : null}

      {full ? (
        <Section id="r-inputs" {...copy.inputs}>
          <Panel>
            <div className="flex items-baseline justify-between">
              <h3 className="text-[18px] font-semibold" style={DISPLAY}>Optional tracking inputs</h3>
              <span className="tabular text-[12px] text-text-3" style={MONO}>{r.inputs.filter((i) => i.has).length} of {r.inputs.length} available</span>
            </div>
            <div className="mt-3.5 mb-1.5 h-2.5 overflow-hidden rounded-full bg-track"><i className="block h-full rounded-full bg-lime" style={{ width: `${(r.inputs.filter((i) => i.has).length / r.inputs.length) * 100}%` }} /></div>
            <div className="mt-3 grid gap-3">
              {r.inputs.map((i) => (
                <div key={i.key} className={cn('flex items-start gap-2.5 text-[14px]', !i.has && 'text-text-2')}>
                  <span className={cn('grid size-[22px] shrink-0 place-items-center rounded-full text-[12px] font-bold', i.has ? 'bg-up-dim text-up' : 'bg-track text-text-3')} aria-hidden>{i.has ? '✓' : '-'}</span>
                  <span>
                    {i.label}
                    {!i.has ? <span className="block text-[13px] text-text-3">{i.unlock}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </Section>
      ) : null}

      {full ? (
        <Section id="r-method" {...copy.method}>
          <Panel>
            <p className="text-[14px] text-text-2">Every number, finding and change in this report comes from fixed rules on your own logs, calculated on your phone. A part with too little data is left out instead of guessed.</p>
            <div className="mt-3.5 grid gap-1.5 text-[12.5px] text-text-2" style={MONO}>
              {SOURCES.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </Panel>
          <p className="mt-3 text-[12.5px] text-text-3">
            {DISCLAIMER}{' '}
            <Link to="/science#weekly-report" className="text-lime underline-offset-2 hover:underline">
              Every rule explained
            </Link>
          </p>
        </Section>
      ) : null}
    </article>
  );
}

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="pt-14" aria-labelledby={id} data-report-section={id}>
      <SectionHead id={id} eyebrow={eyebrow} title={title}>
        {intro}
      </SectionHead>
      {children}
    </section>
  );
}

/** Remembered on this phone: how the report opens and in which language. */
export function useReportPrefs() {
  const read = <T extends string>(k: string, d: T, ok: readonly T[]): T => {
    try {
      const v = localStorage.getItem(k);
      return v && (ok as readonly string[]).includes(v) ? (v as T) : d;
    } catch {
      return d;
    }
  };
  const [mode, setMode] = useState<ReportMode>(() => read('overload.report.mode', 'quick', ['quick', 'full'] as const));
  const [lang, setLang] = useState<ReportLang>(() => read('overload.report.lang', 'en', ['en', 'hi'] as const));
  const save = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // Not remembered in a private window; it still applies now.
    }
  };
  return {
    mode,
    lang,
    setMode: (m: ReportMode) => {
      setMode(m);
      save('overload.report.mode', m);
    },
    setLang: (l: ReportLang) => {
      setLang(l);
      save('overload.report.lang', l);
    },
  };
}
