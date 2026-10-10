import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  CalendarCheck,
  Check,
  ChevronDown,
  Copy,
  Crown,
  FlaskConical,
  Lock,
  Minus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useAccount } from '@/app/account';
import {
  PaymentReferenceError,
  submitPaymentReference,
  useEntitlement,
  type EntitlementView,
} from '@/app/entitlement';
import { accountRef, formatInr, paymentConfig, upiLink, type PaymentConfig } from '@/app/payment';
import { ButtonLink } from '@/components/ui/Button';
import {
  Badge,
  Card,
  IconButton,
  IconTile,
  InlineNotice,
  ProgressBar,
  PushedHeader,
  SecondaryButton,
  TextField,
  TextLink,
} from '@/components/kit';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { useToast } from '@/components/ui/Toast';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { buildProgress } from '@/domain/analytics/progress';
import {
  formatRemaining,
  PRO_FEATURES,
  TRIAL_HOURS,
  type ProFeature,
} from '@/domain/entitlement/entitlement';
import { cn } from '@/lib/cn';
import { formatCalendarDate, formatDateInSentence, pluralize } from '@/lib/format';
import { useNow } from '@/lib/useNow';

const TRIAL_DAYS = Math.round(TRIAL_HOURS / 24);

const time = (d: Date) =>
  d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

const endedOn = (d: Date) => {
  const t = formatDateInSentence(d);
  return t === 'today' || t === 'yesterday' ? t : `on ${t}`;
};

/** "₹3.30", for the price per day. */
const perDay = (config: PaymentConfig) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(config.priceInr / config.periodDays);

/**
 * The Pro page. It sells with the person's own numbers and plain facts: what Pro adds, what
 * stays free for good, the price per day from the configured price, and a trial with no
 * payment details. No invented reviews, counters or deadlines.
 */
export function ProPage() {
  const account = useAccount();
  const entitlement = useEntitlement();
  const signedIn = account.status === 'signedIn';
  const unavailable = account.status === 'unavailable';
  // A trial is still a sale: the hero keeps its offer until Pro is paid for.
  const hasPro =
    signedIn && entitlement.pro && !entitlement.loading && entitlement.plan !== 'trial';
  const canPay = signedIn && !entitlement.loading && entitlement.plan !== 'founding';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-8">
      <div>
        <PushedHeader backLabel="More" backTo="/more" />
        <Hero
          hasPro={hasPro}
          signedIn={signedIn}
          unavailable={unavailable}
          entitlement={entitlement}
        />
      </div>

      {signedIn ? <PlanCard entitlement={entitlement} /> : null}
      {unavailable ? (
        <InlineNotice icon={<Lock />}>
          Accounts are not set up in this version of the app, so Pro is not available yet. Every
          free feature works on this device.
        </InlineNotice>
      ) : null}

      <YourNumbers hasPro={hasPro} />
      <Pillars />
      <Compare />
      <Evidence />

      {canPay ? (
        <PaymentCard entitlement={entitlement} userId={account.user!.id} config={paymentConfig} />
      ) : !signedIn && !unavailable ? (
        <GuestOffer config={paymentConfig} />
      ) : null}

      <Faq config={paymentConfig} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Hero

function Hero({
  hasPro,
  signedIn,
  unavailable,
  entitlement: e,
}: {
  hasPro: boolean;
  signedIn: boolean;
  unavailable: boolean;
  entitlement: EntitlementView;
}) {
  return (
    <section aria-labelledby="pro-hero-title" className="flex flex-col gap-5">
      <Badge tone="lime" icon={<Crown />} className="w-fit">
        Overload Pro
      </Badge>
      <div>
        <h1 id="pro-hero-title" className="type-display text-text-1 [text-wrap:balance]">
          {hasPro ? 'Your training, fully analysed' : 'Stop guessing. Start progressing.'}
        </h1>
        <p className="type-body mt-2 max-w-[56ch] text-text-2">
          Pro reads every set you log and tells you when to add weight, which lifts have stalled,
          which muscles need more work and when you will reach your goals. Every number comes from
          your own sets and a published formula.
        </p>
      </div>

      <InsightPreview />

      {hasPro ? null : unavailable ? null : !signedIn ? (
        <div className="flex flex-col gap-3">
          <ButtonLink to="/sign-up?next=/pro" size="lg" block className="tab:w-fit">
            Try Pro free for {TRIAL_DAYS} days
          </ButtonLink>
          <p className="type-meta text-text-2">
            Free account. No payment details. Nothing renews by itself.{' '}
            <TextLink to="/sign-in?next=/pro" small className="align-baseline">
              Sign in
            </TextLink>
          </p>
        </div>
      ) : e.loading ? null : (
        <div className="flex flex-col gap-2">
          <a href="#get-pro" className={buttonClasses({ size: 'lg', block: true }, 'tab:w-fit')}>
            {e.plan === 'trial' ? 'Keep Pro after your trial' : 'Get Pro'}
          </a>
          {paymentConfig ? (
            <p className="type-meta text-text-2">
              {formatInr(paymentConfig.priceInr)} for {paymentConfig.periodDays} days. That is{' '}
              <span className="tabular font-semibold text-text-1">{perDay(paymentConfig)}</span> a
              day.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Three example outputs, so the page shows what Pro says rather than describing it. */
function InsightPreview() {
  const items: { icon: ReactNode; title: string; detail: string }[] = [
    {
      icon: <TrendingUp />,
      title: 'Bench press: add weight next time',
      detail: 'Top of 6 to 10 reps on every set at RIR 2',
    },
    {
      icon: <Zap />,
      title: 'Squat has stalled for 3 weeks',
      detail: 'Try a new rep range for the next block',
    },
    {
      icon: <Target />,
      title: 'Goal on course for 14 March',
      detail: 'At your current rate of progress',
    },
  ];
  return (
    <figure className="rounded-panel border border-border bg-surface p-2">
      <ul className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li
            key={it.title}
            className={cn(
              'pro-rise flex items-center gap-3 rounded-nested bg-surface-2 px-3.5 py-3',
              i === 1 && 'tab:ml-6',
              i === 2 && 'tab:ml-12',
            )}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <IconTile pro icon={it.icon} />
            <span className="min-w-0">
              <span className="type-headline block text-text-1">{it.title}</span>
              <span className="type-meta block text-text-2">{it.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="type-caption px-2 pt-2 text-text-2">
        Examples of what Pro tells you. Yours come from your own sets.
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------------------------
// Plan status

function PlanCard({ entitlement: e }: { entitlement: EntitlementView }) {
  if (e.loading) {
    return (
      <Card aria-busy>
        <p className="type-body text-text-2">Checking your plan...</p>
      </Card>
    );
  }

  let badge: ReactNode;
  let title: string;
  let detail: string;
  let progress: number | null = null;
  if (e.plan === 'founding') {
    badge = <Badge tone="lime">Pro</Badge>;
    title = 'Pro is active';
    detail = 'Every Pro feature is on for your account.';
  } else if (e.plan === 'pro' && e.proEndsAt) {
    badge = <Badge tone="lime">Pro</Badge>;
    title = 'Pro is active';
    detail = `${formatRemaining(e.remainingMs ?? 0)} left. Active until ${formatCalendarDate(e.proEndsAt)}, ${time(e.proEndsAt)}. It does not renew by itself.`;
  } else if (e.plan === 'trial' && e.trialEndsAt) {
    badge = <Badge tone="lime">Trial</Badge>;
    title = `Free trial: ${formatRemaining(e.remainingMs ?? 0)} left`;
    detail = `Every Pro feature is on until ${formatCalendarDate(e.trialEndsAt)}, ${time(e.trialEndsAt)}. After that, everything you logged stays and every free feature keeps working.`;
    progress = 1 - (e.remainingMs ?? 0) / (TRIAL_HOURS * 3_600_000);
  } else if (e.proEnded && e.proEndsAt) {
    badge = <Badge>Pro ended</Badge>;
    title = 'Your Pro has ended';
    detail = `It ended ${endedOn(e.proEndsAt)}. Everything you logged is still here, and all free features keep working.`;
  } else if (e.trialEndsAt) {
    badge = <Badge>Trial ended</Badge>;
    title = 'Your free trial has ended';
    detail = `It ended ${endedOn(e.trialEndsAt)}. Everything you logged is still here, and all free features keep working.`;
  } else {
    badge = <Badge>Free</Badge>;
    title = 'Free plan';
    detail = 'Every free feature is yours to keep.';
  }

  return (
    <Card aria-labelledby="plan-title">
      {badge}
      <h2 id="plan-title" className="type-title mt-3 text-text-1">
        {title}
      </h2>
      <p className="type-meta mt-1 text-text-2">{detail}</p>
      {progress !== null ? (
        <ProgressBar value={progress} label="Trial used" className="mt-4" />
      ) : null}
      {e.paymentPending && e.paymentReference ? (
        <InlineNotice icon={<Check />} className="mt-4">
          Payment reference <span className="tabular font-semibold">{e.paymentReference}</span>{' '}
          received. Pro starts as soon as the payment is checked.
        </InlineNotice>
      ) : null}
      {e.offline ? (
        <p className="type-meta mt-3 text-text-2">
          Showing your plan as of the last check. It updates when you are back online.
        </p>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// The person's own numbers

/** Counts from the person's own log: what Pro has found, without the details behind the gate. */
function YourNumbers({ hasPro }: { hasPro: boolean }) {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();
  const model = useMemo(
    () =>
      training.data && training.data.workouts.length > 0
        ? buildProgress(training.data, {
            range: 'all',
            exerciseId: null,
            now,
            weekStartsOn: prefs.weekStartsOn,
            unit: prefs.weightUnit,
          })
        : null,
    [training.data, now, prefs.weekStartsOn, prefs.weightUnit],
  );
  if (!model || !model.hasAnyData) return null;

  const tiles = [
    {
      n: model.progression.length,
      label:
        model.progression.length === 1
          ? 'lift ready for more weight'
          : 'lifts ready for more weight',
    },
    {
      n: model.plateaus.length,
      label: model.plateaus.length === 1 ? 'lift has stalled' : 'lifts have stalled',
    },
    {
      n: model.strength.levels.length,
      label:
        model.strength.levels.length === 1
          ? 'lift with a strength level'
          : 'lifts with a strength level',
    },
    {
      n: model.records.length,
      label: model.records.length === 1 ? 'personal record found' : 'personal records found',
    },
  ].filter((t) => t.n > 0);
  if (tiles.length === 0) return null;

  return (
    <section aria-labelledby="your-numbers-title">
      <h2 id="your-numbers-title" className="type-title text-text-1">
        In your training right now
      </h2>
      <p className="type-meta mt-1 text-text-2">
        Worked out on this device from {pluralize(model.sessionsInWindow, 'workout')} you logged.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-panel border border-border bg-surface p-4">
            <dd className="type-stat tabular text-text-1">{t.n}</dd>
            <dt className="type-meta mt-1 text-text-2">{t.label}</dt>
          </div>
        ))}
      </dl>
      <p className="type-meta mt-3 text-text-2">
        {hasPro
          ? 'Open Progress to see each one and what to do next.'
          : 'Pro shows you which ones, and exactly what to do next.'}
      </p>
      {hasPro ? (
        <TextLink to="/progress" chevron small className="mt-1">
          Open Progress
        </TextLink>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// What Pro adds

const PILLARS: { icon: ReactNode; title: string; line: string; features: ProFeature[] }[] = [
  {
    icon: <TrendingUp />,
    title: 'Know your next move',
    line: 'Walk into every session knowing what to lift.',
    features: ['progression', 'plateaus', 'weekly_checkin'],
  },
  {
    icon: <Sparkles />,
    title: 'See the whole picture',
    line: 'Months of training, not just this week.',
    features: ['long_range', 'muscle_balance', 'training_balance', 'strength_levels'],
  },
  {
    icon: <CalendarCheck />,
    title: 'Stay on course',
    line: 'A date for every goal, and a record of how you got there.',
    features: ['goal_projection', 'recaps'],
  },
];

function Pillars() {
  return (
    <section aria-labelledby="pillars-title">
      <h2 id="pillars-title" className="type-title text-text-1">
        Everything in Pro
      </h2>
      <div className="mt-4 grid gap-3 tab:grid-cols-3">
        {PILLARS.map((p) => (
          <Card key={p.title} className="flex flex-col">
            <IconTile pro icon={p.icon} />
            <h3 className="type-headline mt-3 text-text-1">{p.title}</h3>
            <p className="type-meta mt-0.5 text-text-2">{p.line}</p>
            <ul className="mt-4 flex flex-col gap-3 border-t-[0.5px] border-divider pt-4">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-text-1" aria-hidden />
                  <span className="min-w-0">
                    <span className="type-meta block font-semibold text-text-1">
                      {PRO_FEATURES[f].title}
                    </span>
                    <span className="type-meta block text-text-2">
                      {PRO_FEATURES[f].description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

const COMPARE: { label: string; free: boolean }[] = [
  { label: 'Unlimited logging, routines and custom exercises', free: true },
  { label: 'Full workout history and every personal record', free: true },
  { label: 'Body weight, measurements, calories and protein', free: true },
  { label: 'Goals, milestones and progress photos', free: true },
  { label: 'Progress for the last 7 and 30 days', free: true },
  { label: 'Backup and sync across your devices', free: true },
  { label: PRO_FEATURES.long_range.title, free: false },
  { label: PRO_FEATURES.progression.title, free: false },
  { label: PRO_FEATURES.plateaus.title, free: false },
  { label: PRO_FEATURES.muscle_balance.title, free: false },
  { label: PRO_FEATURES.strength_levels.title, free: false },
  { label: PRO_FEATURES.training_balance.title, free: false },
  { label: PRO_FEATURES.weekly_checkin.title, free: false },
  { label: PRO_FEATURES.goal_projection.title, free: false },
  { label: PRO_FEATURES.recaps.title, free: false },
];

function Compare() {
  return (
    <section aria-labelledby="compare-title">
      <h2 id="compare-title" className="type-title text-text-1">
        Free and Pro
      </h2>
      <p className="type-meta mt-1 text-text-2">
        The free plan is a complete logger. Pro adds the analysis on top.
      </p>
      <Card flush className="mt-4 overflow-hidden">
        <table className="w-full border-collapse">
          <caption className="sr-only">What the free plan and Pro include</caption>
          <thead>
            <tr className="type-caption text-text-2">
              <th scope="col" className="px-4 py-3 text-left font-semibold">
                Feature
              </th>
              <th scope="col" className="w-16 py-3 text-center font-semibold">
                Free
              </th>
              <th
                scope="col"
                className="w-16 bg-lime-dim py-3 text-center font-semibold text-text-1"
              >
                Pro
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((row) => (
              <tr key={row.label} className="border-t-[0.5px] border-divider">
                <th scope="row" className="type-meta px-4 py-3 text-left font-medium text-text-1">
                  {row.label}
                </th>
                <td className="text-center">
                  {row.free ? (
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
      </Card>
      <p className="type-meta mt-3 text-text-2">Your workout history always stays free.</p>
    </section>
  );
}

function Evidence() {
  return (
    <Card className="flex items-start gap-4">
      <IconTile icon={<FlaskConical />} />
      <div className="min-w-0">
        <h2 className="type-headline text-text-1">Built on research, not hype</h2>
        <p className="type-meta mt-1 text-text-2">
          Every number Pro shows uses a published method, and the app shows you the formula and the
          studies behind it. No black box, and no AI guessing at your numbers.
        </p>
        <TextLink to="/science" chevron small className="mt-1">
          How every number is calculated
        </TextLink>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Getting Pro

const PROMISES = [
  'One payment. Nothing renews by itself.',
  'No card needed. Pay with any UPI app.',
  'Everything you log stays yours, with or without Pro.',
];

function PriceBlock({ config }: { config: PaymentConfig }) {
  return (
    <>
      <p className="flex items-baseline gap-1.5">
        <span className="type-display tabular text-text-1">{formatInr(config.priceInr)}</span>
        <span className="type-meta text-text-2">/ {config.periodDays} days</span>
      </p>
      <p className="type-meta mt-1 text-text-2">
        That is <span className="tabular font-semibold text-text-1">{perDay(config)}</span> a day
        for every Pro feature.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {PROMISES.map((p) => (
          <li key={p} className="type-meta flex gap-2.5 text-text-1">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
    </>
  );
}

function GuestOffer({ config }: { config: PaymentConfig | null }) {
  return (
    <Card emphasis aria-labelledby="offer-title" id="get-pro">
      <Badge tone="lime">{TRIAL_DAYS} days free</Badge>
      <h2 id="offer-title" className="type-title mt-3 text-text-1">
        Try every Pro feature free
      </h2>
      <p className="type-meta mt-1 mb-4 text-text-2">
        Create a free account and Pro is on for your first {TRIAL_DAYS} days. No payment details,
        nothing to cancel.
      </p>
      {config ? <PriceBlock config={config} /> : null}
      <ButtonLink to="/sign-up?next=/pro" size="lg" block className="mt-5">
        Start {TRIAL_DAYS} days free
      </ButtonLink>
    </Card>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="flex items-center justify-between gap-3 rounded-field bg-surface-2 px-4 py-3">
      <div className="min-w-0">
        <p className="type-caption text-text-2">{label}</p>
        <p className="type-headline tabular truncate text-text-1">{value}</p>
      </div>
      <IconButton
        label={`Copy ${label}`}
        icon={<Copy />}
        className="bg-surface"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast(`${label} copied`);
          } catch {
            toast('Could not copy. Select it and copy by hand.');
          }
        }}
      />
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="type-meta tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-text-1"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-headline text-text-1">
          <span className="sr-only">{n}. </span>
          {title}
        </p>
        {children}
      </div>
    </li>
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
      <section id="get-pro" aria-labelledby="pay-title">
        <h2 id="pay-title" className="type-title mb-3 text-text-1">
          Getting Pro
        </h2>
        <InlineNotice icon={<Crown />}>
          Payments are not open yet. When they are, this page will show the price and how to pay
          with UPI.
        </InlineNotice>
      </section>
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
    <Card emphasis aria-labelledby="pay-title" id="get-pro" as="section">
      <h2 id="pay-title" className="type-title text-text-1">
        {renewing ? 'Add more Pro time' : 'Get Pro'}
      </h2>
      <p className="type-meta mt-1 mb-4 text-text-2">
        {renewing
          ? 'Pay again and the new days are added to the end of your current Pro.'
          : 'Pay once with UPI and every Pro feature is on.'}
      </p>
      <PriceBlock config={config} />

      <ol className="mt-6 flex flex-col gap-5 border-t-[0.5px] border-divider pt-5">
        <Step n={1} title={`Pay ${formatInr(config.priceInr)} with any UPI app`}>
          <div className="mt-2 flex flex-col gap-2">
            <CopyRow label="UPI ID" value={config.upiId} />
            <p className="type-meta text-text-2">
              Payee: {config.payeeName}. Add{' '}
              <span className="tabular font-semibold text-text-1">{ref}</span> to the payment note
              so it can be matched to your account.
            </p>
            <a
              href={upiLink(config, ref)}
              className="pressable chrome type-headline inline-flex h-13 items-center justify-center gap-2 rounded-nested bg-lime px-5 text-on-lime tab:hidden"
            >
              <Smartphone className="size-5" aria-hidden />
              Open a UPI app
            </a>
          </div>
        </Step>
        <Step n={2} title="Send the transaction reference">
          <p className="type-meta mt-1 text-text-2">
            Your UPI app shows it after paying, often called UTR or UPI reference number.
          </p>
          <form className="mt-3 flex flex-col gap-3" onSubmit={submit}>
            <TextField
              label="UPI transaction reference"
              hideLabel
              placeholder="UPI transaction reference"
              autoComplete="off"
              inputMode="text"
              maxLength={40}
              required
              value={reference}
              error={error}
              onChange={(ev) => setReference(ev.target.value)}
            />
            <SecondaryButton
              type="submit"
              loading={busy}
              disabled={reference.trim().length < 6}
              block
            >
              Send reference
            </SecondaryButton>
          </form>
        </Step>
        <Step n={3} title="Pro starts once the payment is checked">
          <p className="type-meta mt-1 text-text-2">
            Payments are checked by hand. This page updates by itself when Pro is on.
          </p>
        </Step>
      </ol>

      <InlineNotice icon={<ShieldCheck />} className="mt-5">
        Never share your UPI PIN, OTP or bank password with anyone. Overload will never ask for
        them. This page only takes the transaction reference.
      </InlineNotice>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Questions

function Faq({ config }: { config: PaymentConfig | null }) {
  const items: [string, string][] = [
    [
      'What happens when the trial or Pro ends?',
      'Nothing you logged is lost or locked. Logging, routines, your full history, records, body metrics and the last 30 days of progress keep working. Only the Pro analysis pauses, and it comes back the moment Pro is on again.',
    ],
    [
      'Does it renew or charge me automatically?',
      `No. You pay once${config ? ` for ${config.periodDays} days` : ''} and it simply ends. There is no card on file and nothing to cancel.`,
    ],
    [
      'How do I pay?',
      'With any UPI app. Pay to the UPI ID shown on this page, then send the transaction reference here. You never share a PIN, OTP or bank details.',
    ],
    [
      'Can I use Pro on more than one device?',
      'Yes. Pro belongs to your account, and your workouts sync to every device you sign in on.',
    ],
    [
      'Where do the numbers come from?',
      'From your own sets and published formulas, worked out on your device. Each one links to the method and research behind it.',
    ],
  ];
  return (
    <section aria-labelledby="faq-title">
      <h2 id="faq-title" className="type-title text-text-1">
        Questions
      </h2>
      <div className="mt-4 divide-y-[0.5px] divide-divider rounded-panel border border-border bg-surface px-4">
        {items.map(([q, a]) => (
          <details key={q} className="group">
            <summary className="pressable chrome flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
              <span className="type-headline text-text-1">{q}</span>
              <ChevronDown
                className="size-5 shrink-0 text-text-2 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="type-meta pb-4 text-text-2">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
