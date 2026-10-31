import { Link } from 'react-router';
import { ChevronRight, ClipboardList } from 'lucide-react';
import { formatRupees, useCoachingPlan } from '@/app/billing';
import { useEntitlement } from '@/app/entitlement';
import { cn } from '@/lib/cn';

/**
 * 1:1 coaching right under Pro on More (November 2026): its real monthly price for people who
 * have not joined, and "Message your coach" for members. Hidden until the server has the plan.
 */
export function CoachingRow({ className }: { className?: string }) {
  const e = useEntitlement();
  const plan = useCoachingPlan();
  if (e.loading || e.plan === 'guest') return null;
  if (!e.coaching && !plan) return null;
  return (
    <Link
      to="/coaching"
      data-coaching-row
      className={cn(
        'pressable chrome flex items-center gap-3 rounded-card bg-surface p-4',
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
      >
        <ClipboardList className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-headline block text-text-1">
          {e.coaching ? 'Your 1:1 coaching' : '1:1 coaching with a real coach'}
        </span>
        <span className="type-subhead block text-text-2">
          {e.coaching
            ? 'Message your coach, and what they know about you'
            : `Training, diet, calls and WhatsApp · ${formatRupees(plan!.priceInr)} a month, Pro included`}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}
