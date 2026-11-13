import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { SecondaryButton } from '@/components/kit';
import { eventsFrom } from '@/data/repositories/plan';
import { EVENT_LABEL } from '@/domain/brain/life';
import { toDateKey } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { ComingUpSheet } from './ComingUpSheet';
import { usePlanItems } from './useBrain';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/**
 * The one "Coming up" row on Routines (Pro): what the weekly plan will work around next, and a
 * way to add to it. The same list as in the weekly review.
 */
export function ComingUpRow() {
  const pro = useFeature('adaptive_plan');
  const items = usePlanItems();
  const now = useNow();
  const [open, setOpen] = useState(false);
  if (!pro || items.status !== 'success') return null;
  const next = eventsFrom(items.data, toDateKey(now))[0];
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-card bg-surface p-4" data-coming-up-row>
      <div className="min-w-0">
        <p className="type-headline text-text-1">Coming up</p>
        <p className="type-subhead mt-0.5 text-text-2">
          {next
            ? `${EVENT_LABEL[next.kind].en}, ${next.start === next.end ? dayMonth(next.start) : `${dayMonth(next.start)} to ${dayMonth(next.end)}`}. Your weekly plan works around it.`
            : 'Exams, travel or a fast? Your weekly plan works around it.'}
        </p>
      </div>
      <SecondaryButton compact icon={<CalendarPlus />} onClick={() => setOpen(true)}>
        Add
      </SecondaryButton>
      <ComingUpSheet open={open} onClose={() => setOpen(false)} now={now} />
    </div>
  );
}
