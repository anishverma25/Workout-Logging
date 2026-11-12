import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { ChipGroup } from '@/components/kit';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useTrainingData } from '@/data/hooks';
import { wrapped, wrappedDue, wrappedStory } from '@/domain/share/wrapped';
import { useNow } from '@/lib/useNow';
import { StoryEditor } from '../share/story/StoryEditor';
import { markWrappedSeen } from './seen';

/**
 * Macrotrophy Wrapped (free): last month in numbers as a story card to share, and the year
 * around its end. Read from the person's own logs; a month with almost no training has none.
 */
export function WrappedPage() {
  const training = useTrainingData();
  const now = useNow();
  const data = training.data;
  const due = wrappedDue(now);
  const [which, setWhich] = useState<'month' | 'year'>('month');
  const dueYear = due.month.year;
  const dueMonth = due.month.month;
  const month = useMemo(
    () => (data ? wrapped(data, { year: dueYear, month: dueMonth }) : null),
    [data, dueYear, dueMonth],
  );
  const year = useMemo(
    () => (data && due.year !== null ? wrapped(data, { year: due.year, month: null }) : null),
    [data, due.year],
  );
  const shown = which === 'year' && year ? year : (month ?? year);
  useEffect(() => {
    if (shown) markWrappedSeen(shown.key);
  }, [shown]);
  const first = data?.profile?.displayName?.trim().split(/\s+/)[0] || null;

  return (
    <>
      <PageHeader back={{ to: '/', label: 'Home' }} title="Wrapped" subtitle="Your training in numbers" />
      {training.status === 'loading' ? <Skeleton className="h-96 rounded-panel" /> : null}
      {training.status === 'error' ? <ErrorState /> : null}
      {data && !shown ? (
        <EmptyState
          icon={<Sparkles />}
          title="Nothing to wrap yet"
          body="Log at least 3 workouts in a month and its recap appears here on the 1st."
        />
      ) : null}
      {shown ? (
        <div className="mx-auto flex max-w-xl flex-col gap-4" data-wrapped={shown.key}>
          {month && year ? (
            <ChipGroup
              label="Period"
              value={which}
              onChange={setWhich}
              options={[
                { value: 'month', label: month.label },
                { value: 'year', label: year.label },
              ]}
            />
          ) : null}
          <StoryEditor
            key={shown.key}
            content={wrappedStory(shown, now)}
            name={first}
            fileName={`macrotrophy-wrapped-${shown.key}.png`}
          />
        </div>
      ) : null}
    </>
  );
}
