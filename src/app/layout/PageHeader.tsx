import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import { useProfile } from '@/data/hooks';
import { DemoPill } from './AppShell';

interface PageHeaderProps {
  title: ReactNode;
  /** Short line under the title. */
  subtitle?: ReactNode;
  /** Small line above the title (a date, a section name). */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Plain-text title for the compact bar, when `title` is not a string. */
  compactTitle?: string;
}

/**
 * Large title, as in iOS. When it scrolls away a compact bar with the title fades in at the
 * top, so you always know where you are. On phones the avatar opens More.
 */
export function PageHeader({ title, subtitle, eyebrow, actions, compactTitle }: PageHeaderProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => setCompact(!entries[0]?.isIntersecting), {
      rootMargin: '-8px 0px 0px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const small = compactTitle ?? (typeof title === 'string' ? title : null);

  return (
    <>
      {small ? (
        <div
          aria-hidden
          className={cn(
            'compact-bar pointer-events-none fixed inset-x-0 top-0 z-30 border-b border-line bg-[var(--nav-bg)] pt-safe backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-200 lg:left-[17rem]',
            compact ? 'opacity-100' : 'opacity-0',
          )}
        >
          <p className="flex h-11 items-center justify-center truncate px-16 text-[1.0625rem] font-semibold">
            {small}
          </p>
        </div>
      ) : null}
      <header className="pb-5 pt-5 lg:pt-10">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-0.5 text-[0.8125rem] font-semibold text-faint">{eyebrow}</p>
            ) : null}
            <h1 className="min-w-0 font-display text-[2.125rem] font-bold leading-[1.1] tracking-[-0.02em] lg:text-[2.5rem]">
              {title}
            </h1>
          </div>
          <div className="mb-0.5 flex shrink-0 items-center gap-2">
            <DemoPill className="lg:hidden" />
            {actions}
            <AvatarLink />
          </div>
        </div>
        {subtitle ? (
          <p className="mt-1.5 max-w-[60ch] text-[0.95rem] text-muted">{subtitle}</p>
        ) : null}
        <div ref={sentinel} aria-hidden className="h-px" />
      </header>
    </>
  );
}

/** Initials in a circle, linking to More (profile, account, settings) on phones. */
function AvatarLink() {
  const profile = useProfile().data;
  const { pathname } = useLocation();
  if (pathname === '/more') return null;
  const initials = profile?.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <Link
      to="/more"
      aria-label="More: profile, account and settings"
      className="tap-target inline-flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--tile-iris)] to-[var(--tile-plum)] font-display text-[0.9rem] font-semibold text-white lg:hidden"
    >
      {initials || <MoreDots />}
    </Link>
  );
}

function MoreDots() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
      <circle cx="4.5" cy="10" r="1.7" fill="currentColor" />
      <circle cx="10" cy="10" r="1.7" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.7" fill="currentColor" />
    </svg>
  );
}
