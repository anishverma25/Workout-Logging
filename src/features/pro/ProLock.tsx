import { Crown } from 'lucide-react';
import { useAccount } from '@/app/account';
import { useEntitlement } from '@/app/entitlement';
import { ButtonLink } from '@/components/ui/Button';
import { PRO_FEATURES, type ProFeature } from '@/domain/entitlement/entitlement';
import { cn } from '@/lib/cn';

/**
 * Shown in place of a Pro feature. It explains what the feature does and how to get it, and
 * never hides or blurs the person's own data behind it.
 */
export function ProLock({
  feature,
  lead,
  className,
}: {
  feature: ProFeature;
  /** Optional first line that is specific to the person, e.g. "2 lifts are ready to progress." */
  lead?: string;
  className?: string;
}) {
  const account = useAccount();
  const entitlement = useEntitlement();
  const { title, description } = PRO_FEATURES[feature];
  const guest = account.status !== 'signedIn';
  const cta = guest
    ? account.status === 'unavailable'
      ? null
      : { to: '/sign-up?next=/pro', label: 'Create an account to try it free' }
    : { to: '/pro', label: entitlement.trialEnded ? 'See Pro' : 'See your plan' };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5 sm:flex-row sm:items-center',
        className,
      )}
      data-pro-lock={feature}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
        <Crown className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {lead ? <p className="mb-1 font-semibold">{lead}</p> : null}
        <p className={cn('flex flex-wrap items-center gap-2', lead ? 'text-sm' : 'font-semibold')}>
          {title}
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-text">
            Pro
          </span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {description}
          {guest ? ' Every new account includes 7 days of Pro, free.' : ''}
        </p>
      </div>
      {cta ? (
        <ButtonLink to={cta.to} size="sm" variant="secondary" className="w-fit shrink-0">
          {cta.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}
