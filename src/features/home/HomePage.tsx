import { useMemo, useState } from 'react';
import { CalendarRange, Dumbbell, FileUp, Sparkles, X } from 'lucide-react';
import { CapsuleButton } from '@/components/kit';
import { buildDashboard } from '@/domain/analytics/dashboard';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { greetingFor } from '@/lib/dates';
import { formatCalendarDate } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { PageHeader } from '@/app/layout/PageHeader';
import { ProNudgeCard } from '@/features/pro/ProNudgeCard';
import { isAlive } from '@/domain/analytics/sessions';
import { Highlights } from './Highlights';
import { StrengthCard } from './StrengthCard';
import { TodayCard } from './TodayCard';
import { WeekCard } from './WeekCard';
import { FoodCard } from './FoodCard';
import { activeRoutine } from '@/domain/analytics/schedule';

export function HomePage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();

  const model = useMemo(
    () => (training.data ? buildDashboard(training.data, prefs, now) : null),
    [training.data, prefs, now],
  );

  // Only their own finished workouts count towards anything the app says about their training.
  const workoutDates = useMemo(
    () =>
      (training.data?.workouts ?? [])
        .filter((w) => isAlive(w) && w.status === 'completed' && w.origin === 'user')
        .map((w) => new Date(w.startedAt)),
    [training.data],
  );

  const firstName = training.data?.profile?.displayName.split(' ')[0];
  const title = firstName ? `${greetingFor(now)}, ${firstName}` : greetingFor(now);
  const ownProfile = training.data?.profile?.origin === 'user';
  const routineName = training.data ? (activeRoutine(training.data.routines)?.name ?? null) : null;

  return (
    <>
      <PageHeader title={title} eyebrow={formatCalendarDate(now)} compactTitle="Home" />
      {training.status === 'success' && !ownProfile ? <SetupPrompt /> : null}
      {model ? <ProNudgeCard workoutDates={workoutDates} records={model.recentPrCount} /> : null}

      {training.status === 'loading' ? <HomeSkeleton /> : null}
      {training.status === 'error' ? (
        <ErrorState error={training.error} onRetry={() => window.location.reload()} />
      ) : null}

      {model && !model.hasTrainingData && model.today.kind === 'no_routine' ? (
        <EmptyState
          icon={<Dumbbell className="size-5" aria-hidden />}
          title="Your training starts here"
          body={
            <>
              Pick a routine and Home shows what to train today. Every workout you log adds to your
              weekly rhythm, records and strength trends, all calculated from your own sets.
            </>
          }
          actions={
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
              <ButtonLink
                to="/import?next=/"
                variant="secondary"
                icon={<FileUp className="size-4" aria-hidden />}
              >
                Import from Hevy or Strong
              </ButtonLink>
            </>
          }
        />
      ) : null}

      {model && (model.hasTrainingData || model.today.kind !== 'no_routine') ? (
        // UI v3 (S3): Today, This week, today's numbers, highlights, strength. Last week moved
        // to Progress, the record and body weight cards became rows (nothing was removed).
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start lg:gap-x-6">
          <div className="flex flex-col gap-8">
            <TodayCard plan={model.today} unit={prefs.weightUnit} />
            <WeekCard
              days={model.weekDays}
              week={model.week}
              streak={model.streak}
              routineName={routineName}
              window={model.recentWindow}
              consistency={model.consistency}
              unit={prefs.weightUnit}
            />
          </div>
          <div className="flex flex-col gap-8">
            {training.data?.profile ? (
              <FoodCard training={training} now={now} unit={prefs.weightUnit} />
            ) : null}
            <Highlights
              record={model.featuredPr}
              recentCount={model.recentPrCount}
              checkin={model.checkin}
              unit={prefs.weightUnit}
            />
            <StrengthCard trends={model.strength.slice(0, 3)} unit={prefs.weightUnit} />
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Shown until the person has their own profile: setup fits the whole app to them (S3.2). */
function SetupPrompt() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(SETUP_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <section
      aria-labelledby="setup-prompt-title"
      className="mb-4 flex items-center gap-3 rounded-card bg-surface py-3 pr-2 pl-4"
    >
      <span className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-fill text-text-1">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="setup-prompt-title" className="type-headline text-text-1">
          Make it yours
        </h2>
        <p className="type-subhead truncate text-text-2">7 quick questions</p>
      </div>
      <CapsuleButton to="/setup?next=/" aria-label="Set up my plan">
        Start
      </CapsuleButton>
      <button
        type="button"
        aria-label="Hide for now"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(SETUP_HIDDEN_KEY, '1');
          } catch {
            // Hidden for this visit only.
          }
        }}
        className="pressable chrome tap-target inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-3"
      >
        <X className="size-4" aria-hidden />
      </button>
    </section>
  );
}

const SETUP_HIDDEN_KEY = 'overload.setupPromptHidden';

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
