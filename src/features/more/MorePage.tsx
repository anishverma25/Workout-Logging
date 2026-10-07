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
              <ListRow key={i.to} to={i.to} icon={i.icon} tone={i.tone} title={i.label} />
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
  const founding = useEntitlement().foundingMember;
  const initials = profile?.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <Link
      to="/profile"
      className="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 transition-colors active:bg-surface-2"
    >
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--tile-iris)] to-[var(--tile-plum)] font-display text-xl font-semibold text-white"
      >
        {initials || '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[1.25rem] font-semibold tracking-tight">
          {profile?.displayName ?? 'Set up your profile'}
        </span>
        <span className="block truncate text-sm text-faint">
          {profile
            ? `${GOAL_LABEL[profile.goal]}, ${EXPERIENCE_LABEL[profile.experience].toLowerCase()}`
            : 'Goal, experience and body details'}
        </span>
        {founding ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">
            <Crown className="size-3.5" aria-hidden />
            Founding member
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint/70" aria-hidden />
    </Link>
  );
}
