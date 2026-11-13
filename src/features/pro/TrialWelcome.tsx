import { Link, useNavigate, useSearchParams } from 'react-router';
import { BrainCircuit, CalendarCheck2, FileBarChart2, Salad, Sparkles, Star } from 'lucide-react';
import { formatRupees, usePlans } from '@/app/billing';
import { useEntitlement } from '@/app/entitlement';
import { averageRating, REVIEWS, SURVEY_RATINGS } from '@/app/marketing';
import { PrimaryButton, TextButton } from '@/components/kit';
import { formatCalendarDate } from '@/lib/format';

/** The four things Pro does that free does not, each in one line, in the order people use them. */
const FLAGSHIP = [
  {
    icon: BrainCircuit,
    title: 'A plan that adapts every week',
    detail: 'Calories, protein and sets for next week, from your own numbers.',
  },
  {
    icon: Sparkles,
    title: 'Macrotrophy AI',
    detail: 'Snap a plate, read a label or a menu, ask about your training.',
  },
  {
    icon: Salad,
    title: 'Indian meal plan and grocery list',
    detail: 'A week of meals for home, hostel or mess, at your targets.',
  },
  {
    icon: FileBarChart2,
    title: 'Weekly intelligence report',
    detail: 'Training and food read together, with three things to do next.',
  },
] as const;

/**
 * Right after setup, once: Pro is already on for 7 days. It tells the truth plainly (when it
 * ends, what it costs, that nothing is charged unless they choose), shows what they now have,
 * and lets them start training straight away. No countdown timers, no fake scarcity.
 */
export function TrialWelcomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const e = useEntitlement();
  const plans = usePlans();
  const monthly = plans?.find((p) => p.id === 'monthly');
  const yearly = plans?.find((p) => p.id === 'yearly');
  const ends = e.plan === 'trial' && e.trialEndsAt ? formatCalendarDate(e.trialEndsAt) : null;
  const review = REVIEWS[0]!;

  return (
    <div className="flex min-h-dvh flex-col bg-bg pt-safe">
      <main
        className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        data-trial-welcome
      >
        <section className="glow-lime relative mt-10 overflow-hidden rounded-panel bg-surface px-6 pt-8 pb-7 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-lime text-on-lime">
            <CalendarCheck2 className="size-7" aria-hidden />
          </span>
          <h1 className="type-display mt-5 text-text-1">Your 7 days of Pro are on</h1>
          <p className="type-body mt-2 text-text-2 [text-wrap:balance]">
            Everything below is already unlocked{ends ? ` until ${ends}` : ''}. No card, no payment
            details, nothing charged unless you choose a plan.
          </p>
        </section>

        <h2 className="type-section mt-8 text-text-1">Now yours to use</h2>
        <ul className="mt-3 divide-y-[0.5px] divide-divider rounded-card bg-surface px-4">
          {FLAGSHIP.map(({ icon: Icon, title, detail }) => (
            <li key={title} className="flex items-start gap-3 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="type-headline block text-text-1">{title}</span>
                <span className="type-subhead block text-text-2">{detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <figure className="mt-6 rounded-card bg-surface p-5">
          <div className="flex items-center gap-1 text-gold" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className="size-4 fill-current" />
            ))}
          </div>
          <blockquote className="type-subhead mt-2 text-text-1">“{review.quote}”</blockquote>
          <figcaption className="type-caption mt-2 text-text-2">
            {review.name}, Macrotrophy member · {averageRating()} out of 5 from{' '}
            {SURVEY_RATINGS.length} member reviews
          </figcaption>
        </figure>

        {monthly && yearly ? (
          <p className="type-subhead mt-6 text-center text-text-2" data-trial-prices>
            After the trial, keep Pro for {formatRupees(monthly.priceInr)} a month or{' '}
            {formatRupees(yearly.priceInr)} a year. Free stays free, with your whole history.
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-8">
          <PrimaryButton block onClick={() => navigate(next, { replace: true })} data-trial-start>
            Start training
          </PrimaryButton>
          <div className="text-center">
            <TextButton to="/pro#get-pro" data-trial-plans>
              See plans
            </TextButton>
          </div>
          <p className="type-caption text-center text-text-3">
            <Link to="/science" className="underline">
              How every number is worked out
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
