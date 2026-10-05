import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { SECONDARY_NAV } from '@/app/navigation';
import { PageHeader } from '@/app/layout/PageHeader';
import { SyncBadge } from '@/features/account/SyncStatus';

export function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <SyncBadge className="mb-3 -mx-2" />
      <nav
        aria-label="More"
        className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface"
      >
        <ul className="divide-y divide-line">
          {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-14 items-center gap-3.5 px-4 transition-colors hover:bg-surface-2"
              >
                <Icon className="size-5 text-faint" aria-hidden />
                <span className="flex-1 font-medium">{label}</span>
                <ChevronRight className="size-4 text-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
