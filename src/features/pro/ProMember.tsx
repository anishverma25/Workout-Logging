import { useEffect, useState, type ReactNode } from 'react';
import {
  CalendarCheck,
  CalendarRange,
  Check,
  Crown,
  FlaskConical,
  LineChart,
  PartyPopper,
  Scale,
  Target,
  TrendingUp,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import type { EntitlementView } from '@/app/entitlement';
import { Badge, Card, IconTile, ListGroup, ListRow, TextLink } from '@/components/kit';
import { PRO_FEATURES, type ProFeature } from '@/domain/entitlement/entitlement';
import { clearProJustStarted, proJustStarted } from './justPaid';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { formatCalendarDate } from '@/lib/format';

/**
 * What a paying member sees on the Pro page: confirmation that it is on, how long is left, and
 * where each Pro feature actually lives in the app. Nothing is sold here again; this is the
 * membership itself.
 */

const DAY_MS = 86_400_000;

/** Whole days left, rounded up, so the last part-day still counts as a day. */
const daysLeft = (ms: number) => Math.max(0, Math.ceil(ms / DAY_MS));

/** Where each Pro feature can be used, grouped the way someone would go looking for it. */
const WHERE: { icon: ReactNode; title: string; to: string; features: ProFeature[] }[] = [
  {
    icon: <TrendingUp />,
    title: 'Progress',
    to: '/progress',
    features: ['progression', 'plateaus', 'muscle_balance', 'training_balance', 'strength_levels'],
  },
  {
    icon: <LineChart />,
    title: 'All of your history',
    to: '/progress?range=all',
    features: ['long_range'],
  },
  { icon: <CalendarCheck />, title: 'Home', to: '/', features: ['weekly_checkin'] },
  { icon: <Target />, title: 'Journey', to: '/journey', features: ['goal_projection', 'recaps'] },
  { icon: <UtensilsCrossed />, title: 'Food', to: '/food', features: ['ai_food', 'food_insights'] },
  { icon: <Sparkles />, title: 'OverloadGPT', to: '/coach', features: ['ai_coach'] },
];

export function ProMemberSection({ entitlement: e }: { entitlement: EntitlementView }) {
  const [welcome] = useState(proJustStarted);
  useEffect(() => {
    if (!welcome) return;
    clearProJustStarted();
    haptic('success');
  }, [welcome]);

  const founding = e.plan === 'founding';
  const left = e.remainingMs ?? null;

  return (
    <section aria-labelledby="member-title" className="flex flex-col gap-4">
      <Card emphasis className="overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <Badge tone="lime" icon={<Crown />}>
            Pro member
          </Badge>
          {welcome ? <Badge icon={<PartyPopper />}>Payment confirmed</Badge> : null}
        </div>
        <h2 id="member-title" className="type-display mt-4 text-text-1 [text-wrap:balance]">
          {welcome ? 'Welcome to Pro' : 'Your Pro membership'}
        </h2>
        <p className="type-body mt-2 text-text-2 [text-wrap:balance]">
          {welcome
            ? 'Every analysis feature is on from right now. Your whole history has been read, so the numbers below are already yours.'
            : 'Every analysis feature is on. Here is what is running and where to find it.'}
        </p>

        {founding || left === null || !e.proEndsAt ? (
          <div className="mt-5 rounded-nested bg-lime-dim px-4 py-3.5">
            <p className="type-headline text-text-1">Open with no end date</p>
            <p className="type-meta mt-0.5 text-text-1">
              Every Pro feature is on for your account, and there is nothing to renew.
            </p>
          </div>
        ) : (
          <div className="pro-rise mt-5 flex items-center gap-4 rounded-nested bg-lime-dim px-4 py-3.5">
            <span className="text-center">
              <span className="type-stat tabular block text-text-1">{daysLeft(left)}</span>
              <span className="type-caption block text-text-1">
                {daysLeft(left) === 1 ? 'day' : 'days'}
              </span>
            </span>
            <span className="min-w-0">
              <span className="type-headline block text-text-1">
                {e.renews ? 'Until your next payment' : 'Of Pro left'}
              </span>
              <span className="type-meta tabular block text-text-1">
                {e.renews
                  ? `Renews on ${formatCalendarDate(e.proEndsAt)}, so Pro never stops mid-training.`
                  : `Pro runs to ${formatCalendarDate(e.proEndsAt)} and then stops. Nothing is charged again.`}
              </span>
            </span>
          </div>
        )}

        <ul className="mt-5 flex flex-col gap-2.5">
          {[
            'Every number comes from your own sets and a published formula.',
            'Your history and everything you log stay yours, with or without Pro.',
            e.renews
              ? 'Cancel any time below. Pro stays on until the end of what you paid for.'
              : 'No mandate on your account. You choose when to pay again.',
          ].map((line) => (
            <li key={line} className="type-meta flex gap-2.5 text-text-2">
              <Check className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </Card>

      <div>
        <h3 className="type-title text-text-1">What is open to you now</h3>
        <p className="type-meta mt-1 text-text-2">
          Ten features, across five screens. Tap any one to use it.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {WHERE.map((group) => (
            <ListGroup key={group.title} label={group.title}>
              {group.features.map((f) => (
                <li key={f}>
                  <ListRow
                    to={group.to}
                    leading={<IconTile pro icon={group.icon} />}
                    title={PRO_FEATURES[f].title}
                    subtitle={PRO_FEATURES[f].description}
                    chevron
                  />
                </li>
              ))}
            </ListGroup>
          ))}
        </div>
      </div>

      <Card className="flex items-start gap-4">
        <IconTile icon={<FlaskConical />} />
        <div className="min-w-0">
          <h3 className="type-headline text-text-1">Where the numbers come from</h3>
          <p className="type-meta mt-1 text-text-2">
            Every formula Pro uses is written out, with the research behind it, on the science page.
          </p>
          <TextLink to="/science" chevron small className="mt-1">
            Read how each number is worked out
          </TextLink>
        </div>
      </Card>
    </section>
  );
}

/** Two quick ways into Pro work, for the member view only. */
export function ProNextSteps({ className }: { className?: string }) {
  const steps: { icon: ReactNode; title: string; detail: string; to: string }[] = [
    {
      icon: <CalendarRange />,
      title: 'See your all-time trends',
      detail: 'Months of strength, volume and consistency in one view.',
      to: '/progress?range=all',
    },
    {
      icon: <Scale />,
      title: 'Set a goal with a date',
      detail: 'Pro works out when you will reach it at your current rate.',
      to: '/journey',
    },
  ];
  return (
    <div className={cn('grid gap-3 tab:grid-cols-2', className)}>
      {steps.map((s) => (
        <Card key={s.title} className="flex items-start gap-3">
          <IconTile pro icon={s.icon} />
          <div className="min-w-0">
            <p className="type-headline text-text-1">{s.title}</p>
            <p className="type-meta mt-0.5 text-text-2">{s.detail}</p>
            <TextLink to={s.to} chevron small className="mt-1">
              Open
            </TextLink>
          </div>
        </Card>
      ))}
    </div>
  );
}
