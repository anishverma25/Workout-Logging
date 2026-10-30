import { Link } from 'react-router';
import { ChevronRight, Crown } from 'lucide-react';
import { perMonth, usePlans } from '@/app/billing';
import { useEntitlement } from '@/app/entitlement';
import { CapsuleButton } from '@/components/kit';
import { cn } from '@/lib/cn';

const DAY_MS = 86_400_000;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Pro near the top of More and Profile (owner request, UI v3 A2), so buying it is one tap from
 * anywhere in the app. It says the real price first, worked out from the plans the server sent,
 * and never claims anything that is not true for this account: a trial row only during a trial,
 * a member row for members, and no price at all until the plans have loaded.
 */
export function ProRow({ className }: { className?: string }) {
  const e = useEntitlement();
  const plans = usePlans();
  if (e.loading || e.plan === 'guest') return null;

  const buyable = (plans ?? []).filter((p) => p.available);
  const cheapest = buyable.length
    ? Math.min(...buyable.map((p) => perMonth(p)))
    : (plans?.find((p) => p.id === 'monthly')?.priceInr ?? null);
  const price = cheapest !== null ? `from ${rupees(cheapest)} a month` : null;

  const member = e.pro && e.plan !== 'trial';
  const trialDays =
    e.plan === 'trial' && e.remainingMs !== null
      ? Math.max(1, Math.ceil(e.remainingMs / DAY_MS))
      : null;

  const title = member
    ? 'Overload Pro'
    : trialDays !== null
      ? `Pro trial · ${trialDays} ${trialDays === 1 ? 'day' : 'days'} left`
      : 'Get Overload Pro';
  const detail = member
    ? 'Active. Manage your plan'
    : [price, 'cancel any time'].filter(Boolean).join(' · ') ||
      'Progress analysis, food insights and OverloadGPT';

  const body = (
    <>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
      >
        <Crown className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-headline block text-text-1">{title}</span>
        <span className="type-subhead block text-text-2">{detail}</span>
      </span>
    </>
  );

  if (member) {
    return (
      <Link
        to="/pro"
        data-pro-row
        className={cn(
          'pressable chrome flex items-center gap-3 rounded-card bg-surface p-4',
          className,
        )}
      >
        {body}
        <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
      </Link>
    );
  }
  return (
    <div
      data-pro-row
      className={cn('flex items-center gap-3 rounded-card bg-surface p-4', className)}
    >
      <Link to="/pro" className="pressable chrome flex min-w-0 flex-1 items-center gap-3">
        {body}
      </Link>
      <CapsuleButton to="/pro" tone="lime" aria-label={trialDays !== null ? 'Keep Pro' : 'Get Pro'}>
        {trialDays !== null ? 'Keep Pro' : 'Get Pro'}
      </CapsuleButton>
    </div>
  );
}
