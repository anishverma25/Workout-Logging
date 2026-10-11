import { useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAccount } from '@/app/account';
import {
  BillingError,
  cancelPlan,
  formatRupees,
  perDay,
  perMonth,
  savingPercent,
  startCheckout,
  usePlans,
  type BillingPlan,
} from '@/app/billing';
import type { EntitlementView } from '@/app/entitlement';
import { ButtonLink } from '@/components/ui/Button';
import {
  Badge,
  Card,
  ConfirmSheet,
  DestructiveButton,
  InlineNotice,
  PrimaryButton,
  Skeleton,
} from '@/components/kit';
import { useProfile } from '@/data/hooks';
import { TRIAL_HOURS } from '@/domain/entitlement/entitlement';
import { cn } from '@/lib/cn';
import { formatCalendarDate } from '@/lib/format';

const TRIAL_DAYS = Math.round(TRIAL_HOURS / 24);

const PERIOD: Record<BillingPlan['id'], string> = {
  monthly: 'a month',
  quarterly: 'every 3 months',
  yearly: 'a year',
};

/** The plan with the lowest price per month, when the plans differ. */
function bestValue(plans: BillingPlan[]): BillingPlan['id'] | null {
  if (plans.length < 2) return null;
  const sorted = [...plans].sort((a, b) => perMonth(a) - perMonth(b));
  return perMonth(sorted[0]!) < perMonth(sorted[1]!) ? sorted[0]!.id : null;
}

/**
 * Honest launch framing: the prices really are introductory, so say so. No countdown and no
 * invented stock; the reason to act is the price itself, which will rise.
 */
function IntroOffer({ plans }: { plans: BillingPlan[] }) {
  const monthly = plans.find((p) => p.id === 'monthly');
  const daily = monthly ? perDay(monthly) : null;
  return (
    <div className="mb-4 rounded-nested bg-lime-dim px-4 py-3" data-testid="intro-offer">
      <p className="type-headline text-text-1">Introductory prices. Not our regular prices.</p>
      <p className="type-meta mt-1 text-text-1">
        Overload is new, so Pro is priced low while we grow. These prices will go up later, so the
        best time to join is now.
      </p>
      {monthly && daily !== null && daily < 1 ? (
        <p className="type-meta tabular mt-1 text-text-1">
          Monthly is just {formatRupees(monthly.priceInr)}, under ₹1 a day.
        </p>
      ) : null}
    </div>
  );
}

function PlanChoice({
  plans,
  value,
  onChange,
}: {
  plans: BillingPlan[];
  value: BillingPlan['id'];
  onChange: (id: BillingPlan['id']) => void;
}) {
  const best = bestValue(plans);
  return (
    <div role="radiogroup" aria-label="Pro plans" className="flex flex-col gap-2">
      {plans.map((p) => {
        const selected = p.id === value;
        const saving = savingPercent(p, plans);
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p.id)}
            className={cn(
              'pressable chrome flex min-h-16 w-full items-center gap-3 rounded-nested border px-4 py-3 text-left',
              selected ? 'border-text-1 bg-text-1 text-bg' : 'border-transparent bg-surface-2',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="type-headline">{p.label}</span>
                {p.id === best ? (
                  <span
                    className={cn(
                      'type-caption rounded-full px-2 py-0.5 font-semibold',
                      selected ? 'bg-bg text-text-1' : 'bg-lime-dim text-text-1',
                    )}
                  >
                    Best value
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'type-meta tabular mt-0.5 block',
                  selected ? 'text-bg/75' : 'text-text-2',
                )}
              >
                {p.months > 1
                  ? `${formatRupees(Math.round(perMonth(p) * 100) / 100)} a month`
                  : 'Billed monthly'}
                {saving ? ` · save ${saving}%` : ''}
              </span>
            </span>
            <span className="text-right">
              <span className="type-title tabular block">{formatRupees(p.priceInr)}</span>
              <span className={cn('type-meta block', selected ? 'text-bg/75' : 'text-text-2')}>
                {PERIOD[p.id]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const PROMISES = [
  'Pay with UPI autopay, cards and more through Razorpay.',
  'Cancel any time here. Pro stays on until the end of what you paid for.',
  'Everything you log stays yours, with or without Pro.',
];

/**
 * Choosing and buying a plan, or managing the one you have. Prices come from the server. A plan
 * that is not connected to Razorpay yet shows its price with "Opening soon".
 */
export function PlansSection({ entitlement: e }: { entitlement: EntitlementView }) {
  const account = useAccount();
  const plans = usePlans();
  const signedIn = account.status === 'signedIn';

  if (signedIn && e.billingPlan && e.plan === 'pro') return <ManagePlan entitlement={e} />;
  if (signedIn && e.plan === 'founding') return null;
  if (plans === null) {
    return (
      <div id="get-pro" aria-busy aria-label="Loading plans">
        <Skeleton height="20rem" radius="panel" />
      </div>
    );
  }
  if (plans.length === 0) {
    return (
      <section id="get-pro" aria-labelledby="plans-title">
        <h2 id="plans-title" className="type-title mb-3 text-text-1">
          Pro plans
        </h2>
        <InlineNotice icon={<ShieldCheck />}>
          Plans could not be loaded. Check your connection and open this page again.
        </InlineNotice>
      </section>
    );
  }
  return <BuyPlan plans={plans} entitlement={e} signedIn={signedIn} />;
}

function BuyPlan({
  plans,
  entitlement: e,
  signedIn,
}: {
  plans: BillingPlan[];
  entitlement: EntitlementView;
  signedIn: boolean;
}) {
  const account = useAccount();
  const profile = useProfile().data;
  const initial = plans.find((p) => p.id === 'yearly')?.id ?? plans[0]!.id;
  const [choice, setChoice] = useState<BillingPlan['id']>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const plan = plans.find((p) => p.id === choice) ?? plans[0]!;
  const anyOpen = plans.some((p) => p.available);

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await startCheckout(plan.id, {
        email: account.user?.email,
        name: profile?.displayName,
      });
      if (result === 'paid') setDone(true);
    } catch (err) {
      setError(err instanceof BillingError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card emphasis as="section" aria-labelledby="plans-title" id="get-pro">
      <div className="flex items-start justify-between gap-3">
        <h2 id="plans-title" className="type-title text-text-1">
          Pro plans
        </h2>
        {!signedIn ? <Badge tone="lime">{TRIAL_DAYS} days free first</Badge> : null}
      </div>
      <p className="type-meta mt-1 mb-4 text-text-2">
        {!signedIn
          ? `Create a free account and every Pro feature is on for ${TRIAL_DAYS} days, with no payment details. Then choose a plan if you want to keep it.`
          : e.plan === 'trial' && e.trialEndsAt
            ? `Your free trial runs until ${formatCalendarDate(e.trialEndsAt)}. Subscribing now starts your plan today.`
            : 'Every Pro feature, renewed automatically until you cancel.'}
      </p>

      <IntroOffer plans={plans} />

      <PlanChoice plans={plans} value={choice} onChange={setChoice} />

      {perDay(plan) < 1 ? (
        <p className="type-meta tabular mt-3 text-center text-text-1">
          {plan.label} works out to about{' '}
          <span className="font-semibold">{formatRupees(Math.floor(perDay(plan) * 100) / 100)}</span>{' '}
          a day. Less than ₹1 a day for every Pro feature.
        </p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-2">
        {PROMISES.map((p) => (
          <li key={p} className="type-meta flex gap-2.5 text-text-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-text-1" aria-hidden />
            {p}
          </li>
        ))}
      </ul>

      {error ? (
        <InlineNotice tone="warning" className="mt-4">
          {error}
        </InlineNotice>
      ) : null}
      {done ? (
        <InlineNotice icon={<ShieldCheck />} className="mt-4">
          Payment confirmed. Pro is on.
        </InlineNotice>
      ) : null}

      <div className="mt-5">
        {!signedIn ? (
          <ButtonLink to="/sign-up?next=/pro" size="lg" block>
            Start {TRIAL_DAYS} days free
          </ButtonLink>
        ) : plan.available ? (
          <PrimaryButton block loading={busy} onClick={() => void buy()}>
            Subscribe for {formatRupees(plan.priceInr)} {PERIOD[plan.id]}
          </PrimaryButton>
        ) : (
          <PrimaryButton block disabled>
            {anyOpen ? 'This plan opens soon' : 'Plans open soon'}
          </PrimaryButton>
        )}
      </div>
      {signedIn && plan.available ? (
        <p className="type-caption mt-3 text-center text-text-2">
          Renews {PERIOD[plan.id]} at {formatRupees(plan.priceInr)} until you cancel. Payments by
          Razorpay; Overload never sees your card or UPI PIN.
        </p>
      ) : null}
    </Card>
  );
}

function ManagePlan({ entitlement: e }: { entitlement: EntitlementView }) {
  const plans = usePlans();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = plans?.find((p) => p.id === e.billingPlan);
  const until = e.proEndsAt ? formatCalendarDate(e.proEndsAt) : null;

  return (
    <Card as="section" aria-labelledby="manage-title" id="get-pro">
      <h2 id="manage-title" className="type-title text-text-1">
        Your plan
      </h2>
      <p className="type-body mt-1 text-text-1">
        {plan ? `${plan.label}, ${formatRupees(plan.priceInr)} ${PERIOD[plan.id]}` : 'Pro plan'}
      </p>
      <p className="type-meta mt-1 text-text-2">
        {e.renews && until
          ? `Renews on ${until}.`
          : until
            ? `Ends on ${until}. It will not renew.`
            : null}
      </p>
      {e.paymentIssue ? (
        <InlineNotice tone="warning" icon={<AlertTriangle />} className="mt-4">
          Razorpay could not take the last payment. Pro stays on until {until}; Razorpay will try
          again, or you can update your payment method from the link Razorpay sent you.
        </InlineNotice>
      ) : null}
      {error ? (
        <InlineNotice tone="warning" className="mt-4">
          {error}
        </InlineNotice>
      ) : null}
      {e.renews ? (
        <DestructiveButton compact className="mt-5" onClick={() => setConfirming(true)}>
          Cancel plan
        </DestructiveButton>
      ) : null}
      <ConfirmSheet
        open={confirming}
        title="Cancel your plan?"
        body={`You will not be charged again. Pro stays on until ${until ?? 'the end of this period'}, and everything you logged stays yours.`}
        confirmLabel="Cancel plan"
        cancelLabel="Keep my plan"
        destructive
        busy={busy}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          setBusy(true);
          setError(null);
          try {
            await cancelPlan();
            setConfirming(false);
          } catch (err) {
            setError(err instanceof BillingError ? err.message : 'Could not cancel. Try again.');
            setConfirming(false);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}
