import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  CalendarCheck,
  Check,
  ClipboardList,
  Crown,
  Dumbbell,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { useAccount } from '@/app/account';
import {
  BillingError,
  formatRupees,
  startCheckout,
  useCoachingPlan,
  usePlans,
} from '@/app/billing';
import {
  CoachingError,
  submitIntake,
  useCoaching,
  whatsappLink,
  type CoachingIntake,
  type CoachingState,
} from '@/app/coaching';
import { useEntitlement, type EntitlementView } from '@/app/entitlement';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  Card,
  InlineNotice,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  TextField,
} from '@/components/kit';
import { useProfile, useTrainingData } from '@/data/hooks';
import { isAlive } from '@/domain/analytics/sessions';
import { formatCalendarDate } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * 1:1 coaching (November 2026): Rs 999 a month for a personal, science-based coach on calls and
 * WhatsApp, with Pro included. Every price comes from the server's plans; nothing here is a
 * made-up claim, count, review or deadline. People who have coaching see their coach and the
 * short form that starts it; everyone else sees what it is and can join.
 */
export function CoachingPage() {
  const e = useEntitlement();
  const [params] = useSearchParams();
  const [version, setVersion] = useState(0);
  const coaching = useCoaching(e.coaching, version);
  const joined = params.get('joined') === '1';

  return (
    <>
      <PageHeader back={{ to: '/more', label: 'More' }} title="1:1 coaching" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-10" data-coaching-page>
        {e.loading ? (
          <Skeleton height="24rem" radius="panel" />
        ) : e.coaching ? (
          <Member
            entitlement={e}
            state={coaching.data}
            loading={coaching.loading}
            error={coaching.error}
            joined={joined}
            onSaved={() => setVersion((v) => v + 1)}
          />
        ) : (
          <Sell entitlement={e} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// For people without coaching
// ---------------------------------------------------------------------------------------------

const INCLUDED: { icon: typeof Dumbbell; title: string; body: string }[] = [
  {
    icon: Dumbbell,
    title: 'Your training plan',
    body: 'A split, exercises, sets, reps and progression written for your goal, your days and your gym, and changed as you progress.',
  },
  {
    icon: Utensils,
    title: 'Your diet, Indian food included',
    body: 'Calories and protein for your goal, and meals built from the food you already eat at home.',
  },
  {
    icon: PhoneCall,
    title: 'Calls with your coach',
    body: 'One to one, to set your plan, check your form on video and answer whatever you are unsure about.',
  },
  {
    icon: MessageCircle,
    title: 'Your coach on WhatsApp',
    body: 'Message your coach between calls. Check-ins on your weight, lifts and food, and what to change next.',
  },
  {
    icon: Crown,
    title: 'Overload Pro for the month',
    body: 'Every Pro feature, OverloadGPT included, for as long as your coaching runs.',
  },
];

function Sell({ entitlement: e }: { entitlement: EntitlementView }) {
  const plan = useCoachingPlan();
  const proPlans = usePlans();
  const training = useTrainingData();
  const profile = useProfile().data;
  const account = useAccount();
  const [busy, setBusy] = useState<'subscribe' | 'once' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workouts =
    training.data?.workouts.filter((w) => isAlive(w) && w.status === 'completed').length ?? 0;
  const proMonthly = proPlans?.find((p) => p.id === 'monthly')?.priceInr ?? null;
  const perDay = plan ? Math.round(plan.priceInr / 30) : null;
  // A renewing Pro plan has to stop renewing before coaching can be bought (one plan renews at a
  // time); the server says so too, this only explains it up front.
  const blockedByPro = e.renews && e.billingPlan !== 'coach_monthly';

  async function buy(mode: 'subscribe' | 'once') {
    if (!plan) return;
    setBusy(mode);
    setError(null);
    try {
      const result = await startCheckout(
        plan.id,
        { email: account.user?.email, name: profile?.displayName },
        mode,
      );
      if (result === 'paid') {
        // Reload so every gate and the coaching view come back with the new plan.
        window.location.replace('/coaching?joined=1');
      }
    } catch (err) {
      setError(err instanceof BillingError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="rounded-panel bg-surface px-5 pb-6 pt-7 text-center" data-coaching-hero>
        <span
          aria-hidden
          className="mx-auto flex size-16 items-center justify-center rounded-full bg-lime-dim text-lime"
        >
          <ClipboardList className="size-8" strokeWidth={1.6} />
        </span>
        <p className="type-subhead mt-4 font-semibold text-lime">New: 1:1 coaching</p>
        <h1 className="type-title-1 mt-1 text-text-1 [text-wrap:balance]">
          A real coach, working on your plan with you
        </h1>
        <p className="type-body mx-auto mt-2 max-w-[44ch] text-text-2">
          An experienced, science-based coach builds your training and diet, talks to you on calls
          and stays with you on WhatsApp. You keep logging in Overload; your coach helps you act on
          it.
        </p>
        {plan === undefined ? (
          <Skeleton height="4rem" className="mx-auto mt-5 max-w-60" />
        ) : plan ? (
          <div className="mt-5" data-coaching-price>
            <p className="tabular font-display text-[2.5rem] font-bold leading-none text-text-1">
              {formatRupees(plan.priceInr)}
              <span className="type-body ml-1 font-normal text-text-2">a month</span>
            </p>
            <p className="type-meta mt-2 text-text-2">
              About {formatRupees(perDay!)} a day · Pro included · cancel any time
            </p>
          </div>
        ) : null}
      </section>

      {workouts > 0 ? (
        <InlineNotice icon={<CalendarCheck />}>
          Your coach starts from what you have already done: {workouts}{' '}
          {workouts === 1 ? 'workout' : 'workouts'} logged in Overload, every set and record in your
          history.
        </InlineNotice>
      ) : null}

      <Card as="section" aria-labelledby="coaching-included">
        <h2 id="coaching-included" className="type-title text-text-1">
          Everything in one plan
        </h2>
        <ul className="mt-4 flex flex-col gap-4">
          {INCLUDED.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-lime"
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="type-headline block text-text-1">{title}</span>
                <span className="type-subhead block text-text-2">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        {plan && proMonthly ? (
          <p className="type-meta mt-4 rounded-nested bg-surface-2 p-3 text-text-2">
            Pro alone is {formatRupees(proMonthly)} a month. With coaching it is part of the{' '}
            {formatRupees(plan.priceInr)}, so you pay for one plan, not two.
          </p>
        ) : null}
      </Card>

      <Card as="section" aria-labelledby="coaching-how">
        <h2 id="coaching-how" className="type-title text-text-1">
          How it starts
        </h2>
        <ol className="mt-4 flex flex-col gap-3">
          {[
            'Join here. Payment is by Razorpay, by UPI or card.',
            'Tell your coach your goal, your schedule and your number. It takes two minutes.',
            'Your coach messages you on WhatsApp to set up your first call.',
          ].map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="type-headline tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime">
                {i + 1}
              </span>
              <span className="type-body pt-0.5 text-text-1">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card emphasis as="section" aria-labelledby="coaching-join" id="join">
        <h2 id="coaching-join" className="type-title text-text-1">
          Join 1:1 coaching
        </h2>
        {plan === undefined ? (
          <Skeleton height="7rem" className="mt-4" />
        ) : !plan ? (
          <InlineNotice className="mt-4" icon={<ShieldCheck />}>
            Coaching could not be loaded. Check your connection and open this page again.
          </InlineNotice>
        ) : (
          <>
            <ul className="mt-3 flex flex-col gap-2">
              {[
                'Renews every month until you cancel, from Pro in the app',
                'Cancel and you are not charged again; coaching runs to the end of the month',
                'Or pay once for one month, with nothing renewing',
              ].map((t) => (
                <li key={t} className="type-meta flex gap-2.5 text-text-1">
                  <Check className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            {blockedByPro ? (
              <InlineNotice className="mt-4" tone="warning">
                Your Pro plan renews by itself. Cancel its renewal on the Pro page first (Pro stays
                on until it ends), then you can join coaching here.
              </InlineNotice>
            ) : null}
            {error ? (
              <InlineNotice className="mt-4" tone="warning">
                {error}
              </InlineNotice>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <PrimaryButton
                block
                loading={busy === 'subscribe'}
                disabled={!plan.available || blockedByPro || busy !== null}
                onClick={() => void buy('subscribe')}
                data-join-coaching
              >
                {plan.available
                  ? `Start coaching, ${formatRupees(plan.priceInr)} a month`
                  : 'Opening soon'}
              </PrimaryButton>
              <SecondaryButton
                block
                loading={busy === 'once'}
                disabled={blockedByPro || busy !== null}
                onClick={() => void buy('once')}
                data-join-coaching-once
              >
                Pay once for one month, {formatRupees(plan.oncePriceInr)}
              </SecondaryButton>
            </div>
            <p className="type-caption mt-3 text-center text-text-2">
              Payments by Razorpay; Overload never sees your card or UPI PIN.
            </p>
          </>
        )}
      </Card>

      <section aria-labelledby="coaching-questions">
        <h2 id="coaching-questions" className="type-title mb-3 text-text-1">
          Questions
        </h2>
        <dl className="flex flex-col gap-4">
          <Question q="Who will coach me?">
            An experienced strength and nutrition coach who works from published research. You see
            your coach&apos;s name and WhatsApp as soon as you join.
          </Question>
          <Question q="I am a beginner. Is it for me?">
            Yes. Your plan starts from where you are: your experience, your days, your equipment and
            any injuries you mention.
          </Question>
          <Question q="Do I still need Pro?">
            No. Pro is included for as long as your coaching runs. If you already paid for Pro, the
            month of coaching is added on top of it.
          </Question>
          <Question q="Can I stop?">
            Any time. Cancel and you are not charged again; your coaching and Pro run to the end of
            the month you paid for, and everything you logged stays yours.
          </Question>
        </dl>
      </section>
    </>
  );
}

function Question({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="rounded-card bg-surface p-4">
      <dt className="type-headline text-text-1">{q}</dt>
      <dd className="type-body mt-1 text-text-2">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// For members
// ---------------------------------------------------------------------------------------------

function Member({
  entitlement: e,
  state,
  loading,
  error,
  joined,
  onSaved,
}: {
  entitlement: EntitlementView;
  state: CoachingState | null;
  loading: boolean;
  error: boolean;
  joined: boolean;
  onSaved: () => void;
}) {
  const until = e.coachingEndsAt ? formatCalendarDate(e.coachingEndsAt) : null;
  const renews = e.renews && e.billingPlan === 'coach_monthly';
  const [editing, setEditing] = useState(false);
  const intake = state?.intake ?? null;
  const showForm = !loading && state && (!intake || editing);

  return (
    <>
      <section className="rounded-panel bg-surface px-5 pb-6 pt-7 text-center" data-coaching-member>
        <span
          aria-hidden
          className="mx-auto flex size-16 items-center justify-center rounded-full bg-lime-dim text-lime"
        >
          <Check className="size-8" strokeWidth={2} />
        </span>
        <p className="type-subhead mt-4 font-semibold text-lime">
          {joined ? 'Welcome to 1:1 coaching' : '1:1 coaching is on'}
        </p>
        <h1 className="type-title-1 mt-1 text-text-1">
          {state?.coachName ? `Your coach: ${state.coachName}` : 'Your coach'}
        </h1>
        <p className="type-meta mt-2 text-text-2">
          {until ? (renews ? `Renews on ${until}.` : `Runs until ${until}.`) : null} Pro is
          included.
        </p>
        {loading ? (
          <Skeleton height="3.25rem" className="mx-auto mt-5 max-w-72" />
        ) : state?.coachWhatsapp ? (
          <a
            href={whatsappLink(state.coachWhatsapp, state.coachName)}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable chrome type-headline mx-auto mt-5 flex h-13 max-w-80 items-center justify-center gap-2 rounded-nested bg-lime px-6 text-on-lime"
            data-whatsapp-coach
          >
            <MessageCircle className="size-5" aria-hidden />
            Message your coach on WhatsApp
          </a>
        ) : (
          <p className="type-body mt-5 text-text-2">
            Your coach will message you on WhatsApp at the number you give below.
          </p>
        )}
      </section>

      {error ? (
        <InlineNotice tone="warning">
          Your coaching details could not be loaded. Check your connection and open this page again.
        </InlineNotice>
      ) : null}

      {loading ? (
        <Skeleton height="16rem" radius="panel" />
      ) : showForm ? (
        <IntakeForm
          initial={intake}
          onSaved={() => {
            setEditing(false);
            onSaved();
          }}
          onCancel={intake ? () => setEditing(false) : undefined}
        />
      ) : intake ? (
        <Card as="section" aria-labelledby="coaching-told" data-coaching-intake>
          <div className="flex items-start justify-between gap-3">
            <h2 id="coaching-told" className="type-title text-text-1">
              What your coach knows
            </h2>
            <SecondaryButton compact onClick={() => setEditing(true)}>
              Edit
            </SecondaryButton>
          </div>
          <dl className="mt-3 flex flex-col gap-3">
            <Told label="Goal">{intake.goal}</Told>
            {intake.schedule ? (
              <Told label="When you train and can talk">{intake.schedule}</Told>
            ) : null}
            <Told label="Phone">{intake.phone}</Told>
            {intake.notes ? <Told label="Anything else">{intake.notes}</Told> : null}
          </dl>
        </Card>
      ) : null}

      <Card as="section" aria-labelledby="coaching-next">
        <h2 id="coaching-next" className="type-title text-text-1">
          Get the most from it
        </h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            'Log every workout and meal in Overload, so your coach and you are looking at the same numbers.',
            'Share your Progress and food screens on your calls, or send them on WhatsApp.',
            'Ask OverloadGPT anything between calls; it is included.',
          ].map((t) => (
            <li key={t} className="type-body flex gap-2.5 text-text-1">
              <Check className="mt-1 size-4 shrink-0 text-lime" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Told({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="type-meta text-text-2">{label}</dt>
      <dd className="type-body whitespace-pre-line text-text-1">{children}</dd>
    </div>
  );
}

/** The two-minute form that starts coaching: goal, schedule, number, anything else. */
function IntakeForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: CoachingIntake | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [goal, setGoal] = useState(initial?.goal ?? '');
  const [schedule, setSchedule] = useState(initial?.schedule ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await submitIntake({ phone, goal, schedule, notes });
      onSaved();
    } catch (err) {
      setError(err instanceof CoachingError ? err.message : 'Could not send it. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card emphasis as="section" aria-labelledby="coaching-form" data-coaching-form>
      <h2 id="coaching-form" className="type-title text-text-1">
        {initial ? 'Update what your coach knows' : 'Tell your coach about you'}
      </h2>
      <p className="type-meta mt-1 text-text-2">
        Only your coach sees this. It takes about two minutes.
      </p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Your goal"
          value={goal}
          onChange={(ev) => setGoal(ev.target.value)}
          placeholder="For example: lose 8 kg and bench 80 kg"
          maxLength={500}
          required
        />
        <TextField
          label="When you train, and when you can talk"
          value={schedule}
          onChange={(ev) => setSchedule(ev.target.value)}
          placeholder="For example: gym at 7 am, free after 8 pm"
          maxLength={300}
        />
        <TextField
          label="WhatsApp number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(ev) => setPhone(ev.target.value)}
          placeholder="+91 98765 43210"
          maxLength={20}
          required
        />
        <label className="flex flex-col gap-1.5">
          <span className="type-meta text-text-2">Injuries, diet or anything else (optional)</span>
          <textarea
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
            maxLength={1000}
            rows={3}
            className={cn(
              'w-full rounded-field bg-surface-2 px-3.5 py-3 text-[1.0625rem] leading-[1.375rem] text-text-1 outline-none placeholder:text-text-3',
            )}
            placeholder="For example: vegetarian, a sore left knee"
          />
        </label>
        {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
        <div className="flex flex-col gap-2 tab:flex-row">
          <PrimaryButton type="submit" block loading={busy} data-send-intake>
            {initial ? 'Save' : 'Send to my coach'}
          </PrimaryButton>
          {onCancel ? (
            <SecondaryButton block onClick={onCancel}>
              Cancel
            </SecondaryButton>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
