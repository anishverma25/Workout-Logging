import { Link } from 'react-router';
import { ChevronRight, Crown, Sparkles } from 'lucide-react';
import { useEntitlement } from '@/app/entitlement';
import { SECONDARY_NAV, type NavItem } from '@/app/navigation';
import { PageHeader } from '@/app/layout/PageHeader';
import { ListGroup, ListRow } from '@/components/ui/List';
import { SyncBadge } from '@/features/account/SyncStatus';
import { useProfile } from '@/data/hooks';
import { GOAL_LABEL, EXPERIENCE_LABEL } from '@/domain/models/labels';

const GROUPS: { key: NonNullable<NavItem['group']>; title: string }[] = [
  { key: 'you', title: 'You' },
  { key: 'training', title: 'Training' },
  { key: 'app', title: 'App' },
];

export function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <nav aria-label="More" className="flex max-w-2xl flex-col gap-6">
        <ProfileCard />
        {GROUPS.map((g) => (
          <ListGroup key={g.key} title={g.title}>
            {SECONDARY_NAV.filter((i) => i.group === g.key && i.to !== '/profile').map((i) => (
              <ListRow
                key={i.to}
                to={i.to}
                icon={i.icon}
                tone={i.tone}
                title={i.label}
                pro={i.to === '/pro'}
              />
            ))}
            {g.key === 'app' ? (
              <ListRow to="/welcome" icon={Sparkles} tone="lime" title="Take the tour" />
            ) : null}
          </ListGroup>
        ))}
        <SyncBadge className="-mt-2 px-4" />
      </nav>
    </>
  );
}

/** The person at the top, as in iOS Settings. Opens the profile. */
function ProfileCard() {
  const profile = useProfile().data;
  const entitlement = useEntitlement();
  const planBadge = entitlement.loading
    ? null
    : entitlement.plan === 'trial'
      ? 'Pro trial'
      : entitlement.pro
        ? 'Pro'
        : null;
  const initials = profile?.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <Link
      to="/profile"
      className="pressable chrome flex items-center gap-4 rounded-panel border border-border bg-surface p-4"
    >
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[1.0625rem] font-semibold text-text-1"
      >
        {initials || '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-headline block truncate text-text-1">
          {profile?.displayName ?? 'Set up your profile'}
        </span>
        <span className="type-meta block truncate text-text-2">
          {profile
            ? `${GOAL_LABEL[profile.goal]} · ${EXPERIENCE_LABEL[profile.experience]}`
            : 'Goal, experience and body details'}
        </span>
        {planBadge ? (
          <span className="type-caption mt-1.5 inline-flex h-6 items-center gap-1 rounded-full bg-lime-dim px-2.5 font-semibold text-text-1">
            <Crown className="size-3.5 text-lime" aria-hidden />
            {planBadge}
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}
