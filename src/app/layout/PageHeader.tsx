import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Ellipsis } from 'lucide-react';
import { DemoPill } from './AppShell';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/** Page title row. On mobile it carries the link to secondary areas (More). */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="pb-6 pt-6 lg:pt-10">
      <div className="flex items-start justify-between gap-4">
        <h1 className="min-w-0 font-display text-[1.85rem] font-bold leading-[1] tracking-[0.005em] sm:text-[2.15rem] lg:text-[2.6rem]">
          {title}
        </h1>
        <div className="-mt-1 flex shrink-0 items-center gap-2">
          <DemoPill className="lg:hidden" />
          {actions}
          <Link
            to="/more"
            aria-label="More"
            className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-text lg:hidden"
          >
            <Ellipsis className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
      {subtitle ? <p className="mt-2 max-w-[60ch] text-[0.95rem] text-muted">{subtitle}</p> : null}
    </header>
  );
}
