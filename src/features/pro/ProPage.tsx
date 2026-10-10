import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  Check,
  Copy,
  Crown,
  MessageSquareHeart,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useAccount } from '@/app/account';
import {
  PaymentReferenceError,
  submitPaymentReference,
  useEntitlement,
  type EntitlementView,
} from '@/app/entitlement';
import { PageHeader } from '@/app/layout/PageHeader';
import { accountRef, formatInr, paymentConfig, upiLink, type PaymentConfig } from '@/app/payment';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import {
  FREE_FEATURES,
  formatRemaining,
  PRO_FEATURES,
  TRIAL_HOURS,
} from '@/domain/entitlement/entitlement';
import { cn } from '@/lib/cn';

const dateTime = (d: Date) =>
  d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
const date = (d: Date) =>
  d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export function ProPage() {
  const account = useAccount();
  const entitlement = useEntitlement();
  const signedIn = account.status === 'signedIn';
  return (
    <>
      <PageHeader
        back={{ to: '/more', label: 'More' }}
        title="Pro"
        subtitle="Deeper analysis of your training. Your workouts and history are always yours, with or without Pro."
      />
      <div className="flex max-w-3xl flex-col gap-5">
        <PlanCard entitlement={entitlement} />
        <Benefits unlocked={entitlement.plan === 'founding'} />
        {signedIn && entitlement.plan !== 'founding' ? (
          <PaymentCard entitlement={entitlement} userId={account.user!.id} config={paymentConfig} />
        ) : null}
      </div>
    </>
  );
}

function PlanCard({ entitlement: e }: { entitlement: EntitlementView }) {
  const account = useAccount();

  if (account.status === 'unavailable') {
    return (
      <Card className="p-5">
        <p className="font-semibold">Pro needs an account</p>
        <p className="mt-1 text-sm text-muted">
          Accounts are not set up in this version of the app, so Pro is not available yet. Every
          free feature works on this device.
        </p>
      </Card>
    );
  }
  if (account.status !== 'signedIn') {
    return (
      <Card className="p-5">
        <ExclusivePill />
        <p className="mt-3 font-display text-2xl font-bold">Join while early access is open</p>
        <p className="mt-1 text-muted">
          Overload is opening to a small group first. Create a free account now and you become a
          founding member, with every Pro feature unlocked for as long as early access lasts. No
          payment details, nothing to cancel.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink to="/sign-up?next=/pro">Become a founding member</ButtonLink>
          <ButtonLink to="/sign-in?next=/pro" variant="ghost">
            Sign in
          </ButtonLink>
        </div>
      </Card>
    );
  }
  if (e.loading) {
    return (
      <Card className="p-5" aria-busy>
        <p className="text-muted">Checking your plan...</p>
      </Card>
    );
  }

  if (e.plan === 'founding') return <FoundingCard offline={e.offline} />;

  let title: string;
  let detail: string;
  let progress: number | null = null;
  if (e.plan === 'pro' && e.proEndsAt) {
    title = 'Pro is active';
    detail = `${formatRemaining(e.remainingMs ?? 0)} left. Active until ${dateTime(e.proEndsAt)}. It does not renew by itself.`;
  } else if (e.plan === 'trial' && e.trialEndsAt) {
    title = `Free trial: ${formatRemaining(e.remainingMs ?? 0)} left`;
    detail = `Ends ${dateTime(e.trialEndsAt)}. After that, every free feature keeps working and nothing you logged is lost.`;
    progress = 1 - (e.remainingMs ?? 0) / (TRIAL_HOURS * 3_600_000);
  } else if (e.proEnded && e.proEndsAt) {
    title = 'Your Pro has ended';
    detail = `It ended on ${date(e.proEndsAt)}. Everything you logged is still here, and all free features keep working.`;
  } else if (e.trialEndsAt) {
    title = 'Your free trial has ended';
    detail = `It ended on ${date(e.trialEndsAt)}. Everything you logged is still here, and all free features keep working.`;
  } else {
    title = 'Free plan';
    detail = 'Every free feature is yours to keep.';
  }

  return (
    <Card className="p-5" aria-labelledby="plan-title">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            e.pro ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted',
          )}
        >
          <Crown className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="plan-title" className="font-display text-2xl font-bold leading-tight">
            {title}
          </h2>
          <p className="mt-1 text-muted">{detail}</p>
        </div>
      </div>
      {progress !== null ? (
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-label="Trial used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      ) : null}
      {e.paymentPending && e.paymentReference ? (
        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm" role="status">
          Payment reference <span className="tabular font-semibold">{e.paymentReference}</span>{' '}
          received. Pro starts as soon as the payment is checked.
        </p>
      ) : null}
      {e.offline ? (
        <p className="mt-3 text-sm text-faint">
          Showing your plan as of the last check. It updates when you are back online.
        </p>
      ) : null}
    </Card>
  );
}

function ExclusivePill({ onDark }: { onDark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        onDark ? 'bg-black/25 text-white' : 'bg-accent-soft text-accent-text',
      )}
    >
      <Sparkles className="size-3.5" aria-hidden />
      Exclusive early access
    </span>
  );
}

/** Early access: no clock, no payment, and the person is told why they are special. */
function FoundingCard({ offline }: { offline: boolean }) {
  return (
    <section
      aria-labelledby="plan-title"
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface p-6 text-white"
    >
      <Crown
        className="pointer-events-none absolute -right-6 -top-6 size-36 rotate-12 text-white/10"
        aria-hidden
      />
      <ExclusivePill onDark />
      <h2 id="plan-title" className="mt-4 font-display text-[1.9rem] font-bold leading-[1.1]">
        You are a founding member
      </h2>
      <p className="mt-3 max-w-[52ch] text-[1.02rem] leading-relaxed text-white">
        Overload is opening to a small, invited group before anyone else, and you are one of them.
        Every Pro feature is unlocked on your account for the whole of early access: no trial clock,
        no payment, nothing to cancel.
      </p>
      <p className="mt-3 max-w-[52ch] leading-relaxed text-white">
        Founding members shape what Overload becomes. Tell us what works and what does not; the next
        updates are built around what you say.
      </p>
      <Link
        to="/feedback?from=pro"
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-semibold text-[var(--tile-iris)] transition-transform active:scale-[0.97]"
      >
        <MessageSquareHeart className="size-4" aria-hidden />
        Share your feedback
      </Link>
      <p className="mt-5 border-t border-white/20 pt-4 text-sm leading-relaxed text-white">
        Early access will not stay open forever. You will hear from us before anything changes, and
        your founding member status stays on your account for good.
      </p>
      {offline ? (
        <p className="mt-2 text-sm text-white">
          Showing your plan as of the last check. It updates when you are back online.
        </p>
      ) : null}
    </section>
  );
}

function Benefits({ unlocked }: { unlocked: boolean }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="p-5">
        <h2 className="mb-3 font-display text-xl font-semibold">
          {unlocked ? 'Unlocked for you' : 'What Pro adds'}
        </h2>
        <ul className="flex flex-col gap-3">
          {Object.values(PRO_FEATURES).map((f) => (
            <li key={f.title} className="flex gap-3">
              <Crown className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
              <span>
                <span className="block font-semibold">{f.title}</span>
                <span className="text-sm text-muted">{f.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 font-display text-xl font-semibold">Always free</h2>
        <ul className="flex flex-col gap-2.5">
          {FREE_FEATURES.map((f) => (
            <li key={f} className="flex gap-3 text-[0.95rem]">
              <Check className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-faint">{label}</p>
        <p className="tabular truncate font-semibold">{value}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        aria-label={`Copy ${label.toLowerCase()}`}
        icon={<Copy className="size-4" aria-hidden />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast(`${label} copied`);
          } catch {
            toast('Could not copy. Select it and copy by hand.');
          }
        }}
      >
        Copy
      </Button>
    </div>
  );
}

function PaymentCard({
  entitlement: e,
  userId,
  config,
}: {
  entitlement: EntitlementView;
  userId: string;
  config: PaymentConfig | null;
}) {
  const toast = useToast();
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = accountRef(userId);

  if (!config) {
    return (
      <Card className="p-5">
        <h2 className="mb-1 font-display text-xl font-semibold">Getting Pro</h2>
        <p className="text-muted">
          Payments are not open yet. When they are, this page will show the price and how to pay
          with UPI.
        </p>
      </Card>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitPaymentReference(reference);
      setReference('');
      toast('Reference sent. Pro starts once the payment is checked.');
    } catch (err) {
      setError(
        err instanceof PaymentReferenceError ? err.message : 'Could not send it. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const renewing = e.plan === 'pro';
  return (
    <Card className="p-5" aria-labelledby="pay-title">
      <h2 id="pay-title" className="font-display text-xl font-semibold">
        {renewing ? 'Add more Pro time' : 'Get Pro'}
      </h2>
      <p className="mt-1 text-muted">
        <span className="font-semibold text-text">{formatInr(config.priceInr)}</span> for{' '}
        {config.periodDays} days of Pro, paid once with UPI. It does not renew by itself.
      </p>

      <ol className="mt-5 flex flex-col gap-5">
        <li>
          <p className="font-semibold">1. Pay {formatInr(config.priceInr)} with any UPI app</p>
          <div className="mt-2 flex flex-col gap-2">
            <CopyValue label="UPI ID" value={config.upiId} />
            <p className="text-sm text-muted">
              Payee: {config.payeeName}. Add <span className="tabular font-semibold">{ref}</span> to
              the payment note so it can be matched to your account.
            </p>
            <ButtonLink
              to={upiLink(config, ref)}
              reloadDocument
              variant="secondary"
              className="w-fit sm:hidden"
              icon={<Smartphone className="size-4" aria-hidden />}
            >
              Open a UPI app
            </ButtonLink>
          </div>
        </li>
        <li>
          <p className="font-semibold">2. Send the transaction reference</p>
          <p className="mt-1 text-sm text-muted">
            Your UPI app shows it after paying, often called UTR or UPI reference number.
          </p>
          <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={submit}>
            <TextField
              label="UPI transaction reference"
              hideLabel
              placeholder="UPI transaction reference"
              className="sm:flex-1"
              autoComplete="off"
              inputMode="text"
              maxLength={40}
              required
              value={reference}
              error={error}
              onChange={(ev) => setReference(ev.target.value)}
            />
            <Button type="submit" disabled={busy || reference.trim().length < 6} className="h-12">
              {busy ? 'Sending...' : 'Send reference'}
            </Button>
          </form>
        </li>
        <li>
          <p className="font-semibold">3. Pro starts once the payment is checked</p>
          <p className="mt-1 text-sm text-muted">
            Payments are checked by hand. This page updates by itself when Pro is on.
          </p>
        </li>
      </ol>

      <p className="mt-5 flex gap-2.5 rounded-xl border border-line px-4 py-3 text-sm text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
        Never share your UPI PIN, OTP or bank password with anyone. Overload will never ask for
        them. This page only takes the transaction reference.
      </p>
    </Card>
  );
}
