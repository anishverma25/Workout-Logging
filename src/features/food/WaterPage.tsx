import { PageHeader } from '@/app/layout/PageHeader';
import { ErrorState, Skeleton } from '@/components/kit';
import { useNow } from '@/lib/useNow';
import { DayNav } from './DayNav';
import { useDayParam } from './useDayParam';
import { useFoodContext } from './useFoodContext';
import { WaterTab } from './WaterTab';

/** Water: glasses drunk against a target worked out from body weight, or the person's own. */
export function WaterPage() {
  const now = useNow();
  const ctx = useFoodContext(now);
  const { date, today, go, label } = useDayParam(now);
  return (
    <>
      <PageHeader title="Water" subtitle="Glasses today, against your target" />
      {ctx.status === 'loading' ? (
        <Skeleton height={256} radius="panel" />
      ) : ctx.status === 'error' ? (
        <ErrorState
          title="Water could not load"
          message={ctx.error?.message}
          onRetry={() => window.location.reload()}
        />
      ) : (
        <div className="flex max-w-3xl flex-col gap-4">
          <DayNav label={label} onPrev={() => go(-1)} onNext={date < today ? () => go(1) : null} />
          <WaterTab ctx={ctx} date={date} />
        </div>
      )}
    </>
  );
}
