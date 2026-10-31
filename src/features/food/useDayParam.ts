import { useSearchParams } from 'react-router';
import { addDays, formatRelativeDay, toDateKey } from '@/lib/dates';

/** The day being looked at, from `?date=`; today when missing, never in the future. */
export function useDayParam(now: Date) {
  const [params, setParams] = useSearchParams();
  const today = toDateKey(now);
  const requested = params.get('date');
  const date =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const go = (days: number) => {
    const next = toDateKey(addDays(new Date(`${date}T12:00:00`), days));
    setParams(next === today ? {} : { date: next }, { replace: true });
  };
  const label = date === today ? 'Today' : formatRelativeDay(new Date(`${date}T12:00:00`), now);
  return { date, today, go, label };
}
