import { useState } from 'react';
import { AlertTriangle, ShieldCheck, Tag } from 'lucide-react';
import { useAccount } from '@/app/account';
import {
  BillingError,
  cancelPlan,
  checkCoupon,
  formatRupees,
  perMonth,
  startCheckout,
  usePlans,
  withCoupon,
  type BillingPlan,
  type Coupon,
} from '@/app/billing';
import type { EntitlementView } from '@/app/entitlement';
import { markProJustStarted } from './justPaid';
import { ButtonLink } from '@/components/ui/Button';
import {
  Badge,
  Card,
  ConfirmSheet,
  DestructiveButton,
  InlineNotice,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  TextButton,
  TextField,
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

const PERIOD_ONCE: Record<BillingPlan['id'], string> = {
  monthly: 'for 1 month',
  quarterly: 'for 3 months',
  yearly: 'for 1 year',
};

type PayMode = 'subscribe' | 'once';

/** The plans as they are priced in the chosen way: renewing, or one payment. */
const priced = (plans: BillingPlan[], mode: PayMode): BillingPlan[] =>
  mode === 'once' ? plans.map((p) => ({ ...p, priceInr: p.oncePriceInr })) : plans;

/** The plan with the lowest price per month, when the plans differ. */
function bestValue(plans: BillingPlan[]): BillingPlan['id'] | null {
  if (plans.length < 2) return null;
  const sorted = [...plans].sort((a, b) => perMonth(a) - perMonth(b));
  return perMonth(sorted[0]!) < perMonth(sorted[1]!) ? sorted[0]!.id : null;
}

function ModeChoice({ value, onChange }: { value: PayMode; onChange: (m: PayMode) => void }) {
  const options: { id: PayMode; title: string; note: string }[] = [
    { id: 'subscribe', title: 'Autopay', note: 'Renews until you cancel' },
    { id: 'once', title: 'Pay once', note: 'No renewal, no mandate' },
  ];
  return (
    <div role="radiogroup" aria-label="How to pay" className="mb-3 grid grid-cols-2 gap-2">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={cn(
              'pressable chrome rounded-nested bg-surface-2 px-3 py-2.5 text-left text-text-1',
              selected && 'ring-2 ring-lime ring-inset',
            )}
          >
            <span className="type-headline block">{o.title}</span>
            <span className="type-caption block text-text-2">{o.note}</span>
          </button>
        );
      })}
    </div>
  );
}

function PlanChoice({
  plans,
  value,
  onChange,
  periods,
}: {
  plans: BillingPlan[];
  value: BillingPlan['id'];
  onChange: (id: BillingPlan['id']) => void;
  periods: Record<BillingPlan['id'], string>;
}) {
  const best = bestValue(plans);
  return (
    <div role="radiogroup" aria-label="Pro plans" className="flex flex-col gap-2">
      {plans.map((p) => {
        const selected = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p.id)}
            className={cn(
              'pressable chrome flex min-h-16 w-full items-center gap-3 rounded-nested bg-surface-2 px-4 py-3 text-left text-text-1',
              selected && 'ring-2 ring-lime ring-inset',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="type-headline">{p.label}</span>
              {p.id === best ? (
                <span className="type-caption rounded-full bg-lime px-2 py-0.5 font-semibold text-on-lime">
                  Best value
                </span>
              ) : null}
            </span>
            <span className="text-right">
              <span className="type-title tabular block">{formatRupees(p.priceInr)}</span>
              <span className="type-meta block text-text-2">{periods[p.id]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Have a code?": a quiet line that opens one field. The server decides whether the code works
 * for this account, and checks it again when the payment starts.
 */
function CouponBox({
  coupon,
  onChange,
}: {
  coupon: Coupon | null;
  onChange: (c: Coupon | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (coupon) {
    return (
      <div
        className="mt-3 flex items-center gap-3 rounded-nested bg-lime-dim px-4 py-3"
        data-coupon-applied
      >
        <Tag className="size-4 shrink-0 text-lime" aria-hidden />
        <p className="type-meta min-w-0 flex-1 text-text-1">
          <span className="font-semibold">{coupon.code}</span> applied: {coupon.percent}% off your
          first payment.
        </p>
        <TextButton
          onClick={() => {
            onChange(null);
            setCode('');
          }}
        >
          Remove
        </TextButton>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="mt-3 text-center">
        <TextButton onClick={() => setOpen(true)}>Have a code?</TextButton>
      </div>
    );
  }
  const apply = async () => {
    const clean = code.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await checkCoupon(clean));
    } catch (err) {
      setError(err instanceof BillingError ? err.message : 'Could not check the code. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        void apply();
      }}
    >
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            label="Code"
            value={code}
            onChange={(ev) => {
              setCode(ev.target.value.toUpperCase());
              setError(null);
            }}
            maxLength={20}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
        </div>
        <SecondaryButton type="submit" loading={busy} disabled={!code.trim()}>
          Apply
        </SecondaryButton>
      </div>
      {error ? (
        <p role="alert" className="type-footnote text-danger-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}

const PROMISES: Record<PayMode, string[]> = {
  subscribe: [
    'Pay with UPI autopay, cards and more through Razorpay.',
    'Cancel any time here. Pro stays on until the end of what you paid for.',
    'Everything you log stays yours, with or without Pro.',
  ],
  once: [
    'One payment by UPI, card or net banking. No mandate and no automatic charge, ever.',
    'Pro runs for the period you pay for, then stops by itself. Pay again to add more time.',
    'Everything you log stays yours, with or without Pro.',
  ],
};

/**
 * Choosing and buying a plan, or managing the one you have. Prices come from the server. Both
 * ways to pay are always offered: autopay and one payment. A member can always add time: after
 * paying once, or once renewal is off, a new plan starts when the paid time runs out, so
 * nothing is paid for twice.
 */
export function PlansSection({ entitlement: e }: { entitlement: EntitlementView }) {
  const account = useAccount();
  const plans = usePlans();
  const signedIn = account.status === 'signedIn';

  if (signedIn && e.plan === 'founding') return null;
  const member = signedIn && e.plan === 'pro';
  if (member && e.billingPlan && e.renews) return <ManagePlan entitlement={e} />;
  if (plans === null) {
    return (
      <div id="get-pro" aria-busy aria-label="Loading plans">
        <Skeleton height="20rem" radius="panel" />
      </div>
    );
  }
  const buy =
    plans.length > 0 ? (
      <BuyPlan plans={plans} entitlement={e} signedIn={signedIn} extend={member} />
    ) : null;
  if (member && e.billingPlan) {
    return (
      <div className="flex flex-col gap-4">
        <ManagePlan entitlement={e} />
        {buy}
      </div>
    );
  }
  if (!buy) {
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
  return buy;
}

function BuyPlan({
  plans,
  entitlement: e,
  signedIn,
  extend = false,
}: {
  plans: BillingPlan[];
  entitlement: EntitlementView;
  signedIn: boolean;
  /** The person has Pro time left: this adds to it. */
  extend?: boolean;
}) {
  const account = useAccount();
  const profile = useProfile().data;
  const initial = plans.find((p) => p.id === 'yearly')?.id ?? plans[0]!.id;
  const [choice, setChoice] = useState<BillingPlan['id']>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState<PayMode>(extend ? 'once' : 'subscribe');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const shown = priced(plans, mode);
  const plan = shown.find((p) => p.id === choice) ?? shown[0]!;
  const periods = mode === 'once' ? PERIOD_ONCE : PERIOD;
  // A single payment needs no Razorpay plan, so every listed plan can be bought that way.
  const open = mode === 'once' ? true : plan.available;
  const first = withCoupon(plan.priceInr, coupon);
  const until = extend && e.proEndsAt ? formatCalendarDate(e.proEndsAt) : null;

  const pick = (m: PayMode) => {
    setMode(m);
    setError(null);
    setFailed(null);
  };

  const buy = async () => {
    setBusy(true);
    setError(null);
    setFailed(null);
    try {
      const out = await startCheckout(
        plan.id,
        { email: account.user?.email, name: profile?.displayName },
        mode,
        coupon?.code ?? null,
      );
      if (out.result === 'paid') {
        setDone(true);
        // A paid-for page should not keep selling: reload so the whole app, every Pro gate
        // included, comes back with the new plan, and the Pro page opens with the welcome.
        markProJustStarted();
        window.location.reload();
      } else if (out.failed) {
        setFailed(out.failed);
      }
    } catch (err) {
      setError(err instanceof BillingError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const intro = extend
    ? mode === 'once'
      ? `One payment adds time on top of what you have${until ? `, after ${until}` : ''}. Nothing renews.`
      : `Autopay starts ${until ? `on ${until}, ` : ''}when the time you paid for runs out, so you never pay twice.`
    : !signedIn
      ? `Create a free account and every Pro feature is on for ${TRIAL_DAYS} days, with no payment details. Then choose a plan if you want to keep it.`
      : e.plan === 'trial' && e.trialEndsAt
        ? `Your free trial runs until ${formatCalendarDate(e.trialEndsAt)}. Paying now starts your plan today.`
        : mode === 'once'
          ? 'Every Pro feature for the period you choose. One payment, and it does not renew.'
          : 'Every Pro feature, renewed automatically until you cancel.';

  const payOnceInstead = (
    <TextButton onClick={() => pick('once')} data-pay-once-instead>
      Pay once instead
    </TextButton>
  );

  return (
    <Card emphasis as="section" aria-labelledby="plans-title" id="get-pro" data-buy-plan>
      <div className="flex items-start justify-between gap-3">
        <h2 id="plans-title" className="type-title text-text-1">
          {extend ? 'Extend your Pro' : 'Pro plans'}
        </h2>
        {!signedIn ? <Badge tone="lime">{TRIAL_DAYS} days free first</Badge> : null}
      </div>
      <p className="type-meta mt-1 mb-4 text-text-2">{intro}</p>

      <ModeChoice value={mode} onChange={pick} />

      <PlanChoice plans={shown} value={choice} onChange={setChoice} periods={periods} />

      {signedIn ? <CouponBox coupon={coupon} onChange={setCoupon} /> : null}

      <ul className="mt-4 flex flex-col gap-2">
        {PROMISES[mode].map((p) => (
          <li key={p} className="type-meta flex gap-2.5 text-text-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-text-1" aria-hidden />
            {p}
          </li>
        ))}
      </ul>

      {failed ? (
        <InlineNotice
          tone="warning"
          icon={<AlertTriangle />}
          className="mt-4"
          action={mode === 'subscribe' ? payOnceInstead : undefined}
        >
          <span data-payment-failed>
            The last try did not go through. Razorpay says: {failed} Nothing was charged.{' '}
            {mode === 'subscribe'
              ? 'Some UPI apps and wallets do not support autopay; one payment usually works.'
              : 'Try again, or use another UPI app or card.'}
          </span>
        </InlineNotice>
      ) : null}
      {error ? (
        <InlineNotice
          tone="warning"
          className="mt-4"
          action={mode === 'subscribe' ? payOnceInstead : undefined}
        >
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
        ) : open ? (
          <PrimaryButton block loading={busy} onClick={() => void buy()}>
            {mode === 'once'
              ? `Pay ${formatRupees(first)} once ${PERIOD_ONCE[plan.id]}`
              : coupon
                ? `Start autopay, ${formatRupees(first)} today`
                : `Subscribe for ${formatRupees(plan.priceInr)} ${PERIOD[plan.id]}`}
          </PrimaryButton>
        ) : (
          <PrimaryButton block onClick={() => pick('once')}>
            Autopay opens soon. Pay once instead
          </PrimaryButton>
        )}
      </div>
      {signedIn && open ? (
        <p className="type-caption mt-3 text-center text-text-2">
          {mode === 'once'
            ? `Charged once, ${formatRupees(first)}. `
            : coupon
              ? `${formatRupees(first)} today for the first ${PERIOD_ONCE[plan.id].replace('for ', '')}, then ${formatRupees(plan.priceInr)} ${PERIOD[plan.id]} until you cancel. `
              : until
                ? `First charge on ${until}, then ${formatRupees(plan.priceInr)} ${PERIOD[plan.id]} until you cancel. `
                : `Renews ${PERIOD[plan.id]} at ${formatRupees(plan.priceInr)} until you cancel. `}
          Payments by Razorpay; Macrotrophy never sees your card or UPI PIN.
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
        {e.billingPlan === 'coach_monthly'
          ? e.paidOnce
            ? '1:1 coaching with Pro, paid once'
            : '1:1 coaching with Pro, every month'
          : e.paidOnce
            ? `${plan ? plan.label : 'Pro'}, paid once`
            : plan
              ? `${plan.label}, ${formatRupees(plan.priceInr)} ${PERIOD[plan.id]}`
              : 'Pro plan'}
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
        <>
          <p className="type-meta mt-4 text-text-2" data-extend-note>
            Want a longer plan, or to pay once instead? Turn renewal off first. The time you paid
            for stays, and you can then choose any plan to follow it.
          </p>
          <DestructiveButton compact className="mt-4" onClick={() => setConfirming(true)}>
            Turn off renewal
          </DestructiveButton>
        </>
      ) : null}
      <ConfirmSheet
        open={confirming}
        title="Turn off renewal?"
        body={`You will not be charged again. Pro stays on until ${until ?? 'the end of this period'}, and everything you logged stays yours.`}
        confirmLabel="Turn off renewal"
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
