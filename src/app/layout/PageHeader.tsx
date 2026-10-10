import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useProfile } from '@/data/hooks';
import { DemoPill } from './AppShell';

interface PageHeaderProps {
  title: ReactNode;
  /** One short factual line under the title, Body --text-2. */
  subtitle?: ReactNode;
  /** Small line above the title (the date on Home), Meta --text-2. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Plain-text title for the compact bar, when `title` is not a string. */
  compactTitle?: string;
  /**
   * A pushed screen: back chevron with the parent's name instead of the avatar
   * (UI Part 2, item 3).
   */
  back?: { to: string; label: string };
}

/**
 * Large title for top-level tabs: a Display title that scrolls away while a centred 17px title
 * fades into a compact bar. On phones the avatar opens More. Pushed screens pass `back` and
 * show a back row instead of the avatar.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  compactTitle,
  back,
}: PageHeaderProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => setCompact(!entries[0]?.isIntersecting),
      { rootMargin: '-8px 0px 0px 0px' },
    );
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
            'compact-bar chrome pointer-events-none fixed inset-x-0 top-0 z-30 border-b-[0.5px] pt-safe transition-opacity duration-[var(--dur-move)] lg:left-60',
            compact
              ? 'border-divider bg-bg/80 opacity-100 backdrop-blur-xl'
              : 'border-transparent opacity-0',
          )}
        >
          <p className="type-headline flex h-11 items-center justify-center truncate px-16 text-text-1">
            {small}
          </p>
        </div>
      ) : null}
      <header className={cn('chrome pb-6', back ? 'pt-1 lg:pt-6' : 'pt-4 lg:pt-8')}>
        {back ? (
          <div className="mb-2 flex h-11 items-center justify-between gap-3">
            <Link
              to={back.to}
              aria-label={`Back to ${back.label}`}
              className="pressable tap-target type-body -ml-2 inline-flex h-11 items-center gap-0.5 rounded-field pr-2 font-medium text-text-1"
            >
              <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden />
              {back.label}
            </Link>
            <div className="flex items-center gap-2">
              <DemoPill className="lg:hidden" />
              {actions}
            </div>
          </div>
        ) : null}
        {eyebrow ? (
          <div className="mb-1 flex min-h-6 items-center justify-between gap-3">
            <p className="type-meta text-text-2">{eyebrow}</p>
            {back ? null : <DemoPill className="lg:hidden" />}
          </div>
        ) : null}
        <div className="flex items-end justify-between gap-4">
          <h1 className="type-display min-w-0 text-text-1">{title}</h1>
          {back ? null : (
            <div className="mb-0.5 flex shrink-0 items-center gap-2">
              {eyebrow ? null : <DemoPill className="lg:hidden" />}
              {actions}
              <AvatarLink />
            </div>
          )}
        </div>
        {subtitle ? (
          <p className="type-body mt-1 max-w-[60ch] text-text-2 [text-wrap:balance]">{subtitle}</p>
        ) : null}
        <div ref={sentinel} aria-hidden className="h-px" />
      </header>
    </>
  );
}

/** Initials in a 40px neutral circle, linking to More (profile, account, settings) on phones. */
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
      className="pressable tap-target inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface-2 text-[0.9375rem] font-semibold text-text-1 lg:hidden"
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
