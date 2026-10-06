import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
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
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint/70" aria-hidden />
    </Link>
  );
}
