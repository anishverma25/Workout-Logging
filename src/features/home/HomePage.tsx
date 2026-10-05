import { useMemo } from 'react';
import { Dumbbell, FlaskConical } from 'lucide-react';
import { buildDashboard } from '@/domain/analytics/dashboard';
import { db } from '@/data/db';
import { loadDemoData } from '@/data/demo/service';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { formatLongDay, greetingFor } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { PageHeader } from '@/app/layout/PageHeader';
import { BodyWeightCard } from './BodyWeightCard';
import { InsightCard } from './InsightCard';
import { RecentActivity } from './RecentActivity';
import { RecordCard } from './RecordCard';
import { StrengthCard } from './StrengthCard';
import { TodayCard } from './TodayCard';
import { WeekCard } from './WeekCard';

export function HomePage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();
  const toast = useToast();

  const model = useMemo(
    () => (training.data ? buildDashboard(training.data, prefs, now) : null),
    [training.data, prefs, now],
  );

  const firstName = training.data?.profile?.displayName.split(' ')[0];
  const title = firstName ? `${greetingFor(now)}, ${firstName}` : greetingFor(now);

  return (
    <>
      <PageHeader title={title} subtitle={formatLongDay(now)} />

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
              Log a workout and this page fills in with what to train today, your weekly rhythm,
              records and strength trends, all calculated from your own sets. Want to look around
              first? Load the demo athlete.
            </>
          }
          actions={
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
          }
        />
      ) : null}

      {model && (model.hasTrainingData || model.today.kind !== 'no_routine') ? (
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Columns flatten on mobile so cards can be ordered by priority. */}
          <div className="contents lg:flex lg:flex-col lg:gap-6">
            <TodayCard plan={model.today} unit={prefs.weightUnit} className="order-1" />
            <StrengthCard trends={model.strength} unit={prefs.weightUnit} className="order-4" />
            <RecentActivity items={model.recent} unit={prefs.weightUnit} className="order-6" />
          </div>
          <div className="contents lg:flex lg:flex-col lg:gap-6">
            <WeekCard
              window={model.recentWindow}
              consistency={model.consistency}
              unit={prefs.weightUnit}
              className="order-2"
            />
            <InsightCard insights={model.insights} className="order-3" />
            <div className="order-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6">
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

function HomeSkeleton() {
  return (
    <div
      className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.45fr_1fr] lg:gap-6"
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
