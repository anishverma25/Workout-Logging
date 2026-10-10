import { useMemo } from 'react';
import { CalendarRange, Dumbbell, FlaskConical, Sparkles } from 'lucide-react';
import { useAccount } from '@/app/account';
import { buildDashboard } from '@/domain/analytics/dashboard';
import { db } from '@/data/db';
import { loadDemoData } from '@/data/demo/service';
import { usePreferences, useTourPending, useTrainingData } from '@/data/hooks';
import { Navigate } from 'react-router';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { greetingFor } from '@/lib/dates';
import { formatCalendarDate } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { PageHeader } from '@/app/layout/PageHeader';
import { BodyWeightCard } from './BodyWeightCard';
import { InsightCard } from './InsightCard';
import { RecentActivity } from './RecentActivity';
import { RecordCard } from './RecordCard';
import { StrengthCard } from './StrengthCard';
import { TodayCard } from './TodayCard';
import { WeekCard } from './WeekCard';
import { RingsCard } from './RingsCard';
import { CheckinCard } from './CheckinCard';
import { activeRoutine } from '@/domain/analytics/schedule';

export function HomePage() {
  // Demo data lives only in the device-only space, never in an account.
  const signedIn = useAccount().status === 'signedIn';
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();
  const toast = useToast();
  const tour = useTourPending();

  const model = useMemo(
    () => (training.data ? buildDashboard(training.data, prefs, now) : null),
    [training.data, prefs, now],
  );

  const firstName = training.data?.profile?.displayName.split(' ')[0];
  const title = firstName ? `${greetingFor(now)}, ${firstName}` : greetingFor(now);
  const ownProfile = training.data?.profile?.origin === 'user';
  const routineName = training.data ? (activeRoutine(training.data.routines)?.name ?? null) : null;

  // A brand-new install opens with the preview tour, once.
  if (tour.data) return <Navigate to="/welcome" replace />;

  return (
    <>
      <PageHeader title={title} eyebrow={formatCalendarDate(now)} compactTitle="Home" />
      {training.status === 'success' && !ownProfile ? <SetupPrompt /> : null}

      {training.status === 'loading' ? <HomeSkeleton /> : null}
      {training.status === 'error' ? (
        <ErrorState error={training.error} onRetry={() => window.location.reload()} />
      ) : null}

      {model && !model.hasTrainingData && model.today.kind === 'no_routine' ? (
        <EmptyState
          icon={<Dumbbell className="size-5" aria-hidden />}
          title="Your training starts here"
          body={
            signedIn ? (
              <>
                Pick a routine and Home shows what to train today. Every workout you log adds to
                your weekly rhythm, records and strength trends, all calculated from your own sets.
              </>
            ) : (
              <>
                Log a workout and this page fills in with what to train today, your weekly rhythm,
                records and strength trends, all calculated from your own sets. Want to look around
                first? Load the demo athlete.
              </>
            )
          }
          actions={
            signedIn ? (
              <>
                <ButtonLink
                  to="/routines"
                  variant={ownProfile ? 'primary' : 'secondary'}
                  icon={<CalendarRange className="size-4" aria-hidden />}
                >
                  Pick a routine
                </ButtonLink>
                <ButtonLink
                  to="/workout"
                  variant="secondary"
                  icon={<Dumbbell className="size-4" aria-hidden />}
                >
                  Start a workout
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink to="/workout" icon={<Dumbbell className="size-4" aria-hidden />}>
                  Start a workout
                </ButtonLink>
                <Button
                  variant="secondary"
                  icon={<FlaskConical className="size-4" aria-hidden />}
                  onClick={async () => {
                    await loadDemoData(db);
                    toast('Demo data loaded');
                  }}
                >
                  Load demo data
                </Button>
              </>
            )
          }
        />
      ) : null}

      {model && (model.hasTrainingData || model.today.kind !== 'no_routine') ? (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
          {/* Columns flatten on mobile so cards can be ordered by priority. */}
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <TodayCard plan={model.today} unit={prefs.weightUnit} className="order-1" />
            <RingsCard
              week={model.week}
              streak={model.streak}
              routineName={routineName}
              weekStartsOn={prefs.weekStartsOn}
              className="order-2"
            />
            <StrengthCard trends={model.strength} unit={prefs.weightUnit} className="order-4" />
            <RecentActivity items={model.recent} unit={prefs.weightUnit} className="order-6" />
          </div>
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <WeekCard
              days={model.weekDays}
              window={model.recentWindow}
              consistency={model.consistency}
              unit={prefs.weightUnit}
              className="order-2"
            />
            <CheckinCard checkin={model.checkin} unit={prefs.weightUnit} className="order-3" />
            <InsightCard insights={model.insights} className="order-3" />
            <div className="order-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <RecordCard
                record={model.featuredPr}
                recentCount={model.recentPrCount}
                unit={prefs.weightUnit}
              />
              <BodyWeightCard summary={model.bodyWeight} unit={prefs.weightUnit} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Shown until the person has their own profile: setup fits the whole app to them. */
function SetupPrompt() {
  return (
    <section
      aria-labelledby="setup-prompt-title"
      className="mb-4 rounded-panel border border-border bg-surface p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface-2 text-text-2">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="setup-prompt-title" className="type-headline text-text-1">
            Make it yours
          </h2>
          <p className="type-meta mt-0.5 text-text-2">
            Seven quick questions for a routine, rep ranges and daily calories fitted to you.
          </p>
        </div>
        <ButtonLink to="/setup?next=/" variant="secondary" className="shrink-0">
          Set up my plan
        </ButtonLink>
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.45fr_1fr] lg:gap-4"
      aria-busy="true"
      aria-label="Loading your dashboard"
    >
      <Skeleton className="h-72" />
      <Skeleton className="h-56" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
