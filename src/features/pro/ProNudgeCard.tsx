import { useEffect, useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { getTrialOffer, usePlans, type TrialOffer } from '@/app/billing';
import { useEntitlement } from '@/app/entitlement';
import { CapsuleButton, TextButton } from '@/components/kit';
import { db } from '@/data/db';
import {
  getNudgeState,
  recordNudgeDismissed,
  recordNudgeShown,
} from '@/data/repositories/proNudge';
import { chooseNudge, type NudgeState } from '@/domain/entitlement/nudge';
import { cn } from '@/lib/cn';

const DAY_MS = 86_400_000;

/**
 * One reminder of Pro for a free member, on Home. The rules for when it appears, and what it
 * can say, are in `domain/entitlement/nudge.ts`: always one of the person's own numbers, the
 * price or a feature, never a made-up deadline, and "Not now" buys a week.
 */
export function ProNudgeCard({
  workoutDates,
  records,
  className,
}: {
  /** Every workout they have logged, so the reminder can count only the honest ones. */
  workoutDates: Date[];
  /** Personal records in their recent training. */
  records: number;
  className?: string;
}) {
  const e = useEntitlement();
  const plans = usePlans();
  const [state, setState] = useState<NudgeState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [offer, setOffer] = useState<TrialOffer | null>(null);
  const free = e.plan === 'free';
  useEffect(() => {
    if (!free) return;
    let live = true;
    void getTrialOffer().then((o) => {
      if (live) setOffer(o);
    });
    return () => {
      live = false;
    };
  }, [free]);

  useEffect(() => {
    let live = true;
    void getNudgeState(db).then((s) => {
      if (live) setState(s);
    });
    return () => {
      live = false;
    };
  }, []);

  const endedAt = useMemo(() => {
    const ends = [e.trialEnded ? e.trialEndsAt : null, e.proEnded ? e.proEndsAt : null].filter(
      (d): d is Date => d !== null,
    );
    return ends.length > 0 ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  }, [e.trialEnded, e.trialEndsAt, e.proEnded, e.proEndsAt]);

  const facts = useMemo(() => {
    const times = workoutDates.map((d) => d.getTime()).filter((t) => !Number.isNaN(t));
    const first = times.length > 0 ? Math.min(...times) : null;
    return {
      pro: e.pro,
      endedAt,
      workoutsSince: endedAt ? times.filter((t) => t > endedAt.getTime()).length : 0,
      historyDays: first === null ? 0 : (e.now.getTime() - first) / DAY_MS,
      records,
      monthlyInr: plans?.find((p) => p.id === 'monthly')?.priceInr ?? null,
      yearlyInr: plans?.find((p) => p.id === 'yearly')?.priceInr ?? null,
    };
  }, [workoutDates, records, e.pro, e.now, endedAt, plans]);

  // Waits for the plans, so the price reminder can be offered with a real price. The 48 hours
  // after the trial show the real offer from the server instead, with its real end.
  const resolved =
    !offer && state && plans !== null && !e.loading ? chooseNudge(facts, state, e.now) : null;

  // The state it was chosen from is read once, on mount, so recording that this reminder was
  // shown cannot change what is on screen while it is being read. The next visit to Home reads
  // the new state, and then stays quiet until the next gap has passed.
  const nudge = resolved;
  useEffect(() => {
    if (nudge) void recordNudgeShown(db, nudge.id);
  }, [nudge]);

  if (offer && !dismissed) {
    const until = offer.endsAt.toLocaleString('en-IN', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
    return (
      <section
        aria-labelledby="trial-offer-title"
        data-home-trial-offer
        className={cn(
          'glow-lime relative mb-4 overflow-hidden rounded-card bg-surface p-4',
          className,
        )}
      >
        <div className="relative flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime"
          >
            <Crown className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="trial-offer-title" className="type-headline text-text-1 [text-wrap:pretty]">
              Your trial has ended. Keep Pro for {offer.percent}% less.
            </h2>
            <p className="type-subhead mt-0.5 text-text-2 [text-wrap:pretty]">
              {offer.percent}% off your first payment, autopay or once, until {until}. No code
              needed.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <CapsuleButton to="/pro#get-pro" tone="lime">
                See plans
              </CapsuleButton>
              <TextButton small onClick={() => setDismissed(true)}>
                Not now
              </TextButton>
            </div>
          </div>
        </div>
      </section>
    );
  }
  if (!nudge || dismissed) return null;

  return (
    <section
      aria-labelledby="pro-nudge-title"
      data-testid="pro-nudge"
      className={cn('mb-4 rounded-card bg-surface p-4', className)}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
        >
          <Crown className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="pro-nudge-title" className="type-headline text-text-1 [text-wrap:pretty]">
            {nudge.title}
          </h2>
          <p className="type-subhead mt-0.5 text-text-2 [text-wrap:pretty]">{nudge.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <CapsuleButton to="/pro" tone="lime" aria-label="See what Pro shows">
              See Pro
            </CapsuleButton>
            <TextButton
              small
              onClick={() => {
                setDismissed(true);
                void recordNudgeDismissed(db, e.now);
              }}
            >
              Not now
            </TextButton>
          </div>
        </div>
      </div>
    </section>
  );
}
