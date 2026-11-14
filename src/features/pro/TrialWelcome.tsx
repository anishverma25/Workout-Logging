import { Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  BrainCircuit,
  Check,
  ChartSpline,
  Crown,
  FileBarChart2,
  Minus,
  Salad,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useEntitlement } from '@/app/entitlement';
import { SecondaryButton, TextButton } from '@/components/kit';
import { TRIAL_HOURS } from '@/domain/entitlement/entitlement';
import { safeNext } from '@/features/account/next';
import { QuoteSpotlight, RatingLaurel } from '@/features/tour/Reviews';
import { formatCalendarDate } from '@/lib/format';
import { PlansSection } from './Plans';

const TRIAL_DAYS = Math.round(TRIAL_HOURS / 24);

/** What Pro does that free does not, as outcomes, in the order people meet them. */
const WHAT_PRO_DOES: { icon: LucideIcon; title: string; detail: string }[] = [
  {
    icon: BrainCircuit,
    title: 'A plan that adapts',
    detail: 'Next week’s calories, protein and sets, from your own numbers.',
  },
  {
    icon: Sparkles,
    title: 'Macrotrophy AI',
    detail: 'Snap a plate, read a label or a menu, ask about your training.',
  },
  {
    icon: Target,
    title: 'Protein and macros',
    detail: 'Protein, carbs, fat and fibre tracked against your targets.',
  },
  {
    icon: Salad,
    title: 'Indian meal plan',
    detail: 'A week of meals at your targets, with one grocery list.',
  },
  {
    icon: FileBarChart2,
    title: 'Weekly report',
    detail: 'Training and food read together, with what to do next.',
  },
  {
    icon: ChartSpline,
    title: 'All-time progress',
    detail: 'Strength levels, stalled lifts and sets for every muscle.',
  },
];

/** The short version of Free and Pro: a string in Free means a smaller amount. */
const COMPARE: { label: string; free: boolean | string }[] = [
  { label: 'Workout logging and full history', free: true },
  { label: 'Indian food logging with calories', free: true },
  { label: 'Routines', free: '2' },
  { label: 'Progress', free: '7 days' },
  { label: 'Protein, carbs, fat and fibre', free: false },
  { label: 'Plan that adapts every week', free: false },
  { label: 'Macrotrophy AI', free: false },
  { label: 'Meal plan and weekly report', free: false },
];

/**
 * One page, right after a first setup: everything Pro does, Free next to Pro, what members say,
 * and the real prices with checkout right here. It tells the truth plainly (when the trial ends,
 * that nothing is charged unless they choose) and always lets them go straight to training.
 * No countdowns, no fake scarcity. Members who already pay are sent on at once.
 */
export function TrialWelcomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'), '/');
  const e = useEntitlement();
  const trial = e.plan === 'trial';
  const ends = trial && e.trialEndsAt ? formatCalendarDate(e.trialEndsAt) : null;
  const onward = () => navigate(next, { replace: true });

  if (e.plan === 'pro' || e.plan === 'founding') return <Navigate to={next} replace />;

  return (
    <div className="flex min-h-dvh flex-col bg-bg pt-safe">
      <main
        className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        data-trial-welcome
      >
        <div className="flex h-14 items-center justify-end">
          <TextButton onClick={onward} data-trial-skip>
            Not now
          </TextButton>
        </div>

        <section className="offer-hero relative -mx-5 px-5 pt-4 pb-2 text-center">
          <span className="glow-lime mx-auto flex size-16 items-center justify-center rounded-[1.4rem] bg-lime text-on-lime">
            <Crown className="size-8" aria-hidden />
          </span>
          <p className="type-caption mt-5 font-semibold text-lime">
            {trial
              ? ends
                ? `Pro is on until ${ends}`
                : `Your ${e.trialHours ? Math.round(e.trialHours / 24) : TRIAL_DAYS} days of Pro are on`
              : 'Macrotrophy Pro'}
          </p>
          <h1 className="type-display mt-1 text-text-1 [text-wrap:balance]">
            {trial ? 'Everything is unlocked' : 'Train and eat with a plan'}
          </h1>
          <p className="type-body mx-auto mt-2 max-w-[34ch] text-text-2 [text-wrap:balance]">
            {trial
              ? 'No card and nothing to cancel. Keep Pro after the trial only if it is worth it to you.'
              : 'Pro reads every set and every meal, and tells you what to do next.'}
          </p>
        </section>

        <h2 className="type-section mt-8 text-text-1">What Pro does</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2.5" data-offer-features>
          {WHAT_PRO_DOES.map(({ icon: Icon, title, detail }, i) => (
            <li
              key={title}
              className="pro-rise rounded-card bg-surface p-4"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-lime-dim text-lime">
                <Icon className="size-[1.125rem]" aria-hidden />
              </span>
              <p className="type-headline mt-3 text-text-1">{title}</p>
              <p className="type-caption mt-0.5 text-text-2">{detail}</p>
            </li>
          ))}
        </ul>

        <h2 className="type-section mt-8 text-text-1">Free and Pro</h2>
        <div className="mt-3 overflow-hidden rounded-card bg-surface">
          <table className="w-full border-collapse">
            <caption className="sr-only">What the free plan and Pro include</caption>
            <thead>
              <tr className="type-caption text-text-2">
                <th scope="col" className="px-4 py-2.5 text-left font-semibold">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="w-16 py-2.5 text-center font-semibold">
                  Free
                </th>
                <th
                  scope="col"
                  className="w-16 bg-lime-dim py-2.5 text-center font-semibold text-text-1"
                >
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-t-[0.5px] border-divider">
                  <th
                    scope="row"
                    className="type-meta px-4 py-2.5 text-left font-medium text-text-1"
                  >
                    {row.label}
                  </th>
                  <td className="text-center">
                    {typeof row.free === 'string' ? (
                      <span className="type-caption text-text-2">{row.free}</span>
                    ) : row.free ? (
                      <span role="img" aria-label="Included">
                        <Check className="mx-auto size-4 text-text-1" aria-hidden />
                      </span>
                    ) : (
                      <span role="img" aria-label="Not included">
                        <Minus className="mx-auto size-4 text-text-3" aria-hidden />
                      </span>
                    )}
                  </td>
                  <td className="bg-lime-dim text-center">
                    <span role="img" aria-label="Included">
                      <Check className="mx-auto size-4 text-lime" aria-hidden />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-10 flex flex-col gap-6" aria-label="What members say">
          <RatingLaurel />
          <QuoteSpotlight active />
        </section>

        <div className="mt-8" data-trial-prices>
          <PlansSection entitlement={e} />
        </div>

        <div className="mt-6 flex flex-col gap-2 pt-2">
          <SecondaryButton block onClick={onward} data-trial-start>
            {trial ? 'Start training with Pro' : 'Continue with Free'}
          </SecondaryButton>
          <p className="type-caption text-center text-text-2">
            Free stays free, with your whole history, whatever you choose.
          </p>
        </div>
      </main>
    </div>
  );
}
