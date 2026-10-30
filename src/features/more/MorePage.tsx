import { Link } from 'react-router';
import { ChevronRight, Crown, FileUp, RefreshCw, Sparkles } from 'lucide-react';
import { useAccount } from '@/app/account';
import { useEntitlement } from '@/app/entitlement';
import { applyUpdate, usePwa } from '@/app/pwa';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '@/app/navigation';
import { PageHeader } from '@/app/layout/PageHeader';
import { ListGroup, ListRow } from '@/components/ui/List';
import { SyncBadge } from '@/features/account/SyncStatus';
import { useProfile } from '@/data/hooks';
import { LegalLinks } from '@/features/legal/LegalPage';
import { ProRow } from '@/features/pro/ProRow';
import { GOAL_LABEL, EXPERIENCE_LABEL } from '@/domain/models/labels';

const GROUPS: { key: NonNullable<NavItem['group']>; title: string }[] = [
  { key: 'you', title: 'You' },
  { key: 'training', title: 'Training' },
  { key: 'app', title: 'App' },
];

// Areas kept out of the phone's bottom bar, listed here with the training pages.
const MORE_NAV: NavItem[] = [
  ...PRIMARY_NAV.filter((i) => i.bottom === false).map((i) => ({
    ...i,
    tone: 'sky' as const,
    group: 'training' as const,
  })),
  ...SECONDARY_NAV,
];

export function MorePage() {
  // The email under Account, so signing out is easy to find.
  const email = useAccount().user?.email ?? null;
  return (
    <>
      <PageHeader title="More" />
      <nav aria-label="More" className="flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <ProfileCard />
          {/* Pro sits right under the person, with its price (owner request, UI v3 A2). */}
          <ProRow />
        </div>
        <ReloadNote />
        {GROUPS.map((g) => (
          <ListGroup key={g.key} title={g.title}>
            {MORE_NAV.filter(
              (i) => i.group === g.key && i.to !== '/profile' && i.to !== '/pro',
            ).map((i) => (
              <ListRow
                key={i.to}
                to={i.to}
                icon={i.icon}
                tone={i.tone}
                title={i.label}
                detail={i.to === '/account' ? email : undefined}
              />
            ))}
            {g.key === 'app' ? (
              <>
                <ListRow
                  to="/import?next=/more"
                  icon={FileUp}
                  tone="sky"
                  title="Import from Hevy or Strong"
                />
                <ListRow to="/welcome" icon={Sparkles} tone="lime" title="Take the tour" />
              </>
            ) : null}
          </ListGroup>
        ))}
        <SyncBadge className="-mt-2 px-4" />
        <LegalLinks className="px-4" />
      </nav>
    </>
  );
}

/**
 * New versions go out often, and an installed app can keep running the old one for a while.
 * A small standing reminder, with the reload one tap away.
 */
function ReloadNote() {
  const { updateReady } = usePwa();
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface px-4 py-3" data-reload-note>
      <RefreshCw className="size-4 shrink-0 text-text-2" aria-hidden />
      <p className="type-meta min-w-0 flex-1 text-text-2">
        {updateReady
          ? 'A new version is ready. Reload to get it.'
          : 'We add new features often. Reload the app now and then to get the latest.'}
      </p>
      <button
        type="button"
        onClick={() => (updateReady ? applyUpdate() : window.location.reload())}
        className="pressable chrome type-subhead inline-flex h-8 shrink-0 items-center rounded-full bg-fill px-3 font-semibold text-text-1"
      >
        Reload
      </button>
    </div>
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
      className="pressable chrome flex items-center gap-4 rounded-card bg-surface p-4"
    >
      <span
        aria-hidden
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-fill text-[1.0625rem] font-semibold text-text-1"
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
