import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDemoStatus, useProfile } from '@/data/hooks';
import { CoachButton } from '@/features/coach/CoachLauncher';
import { TAB_ROOTS } from '../navigation';

interface PageHeaderProps {
  title: ReactNode;
  /** One short factual line under the title, footnote --text-2. */
  subtitle?: ReactNode;
  /** Small line at the top left (the date on Home), Meta --text-2. */
  eyebrow?: ReactNode;
  /** Header buttons, at the top right (at most two). */
  actions?: ReactNode;
  /** Plain-text title for the compact bar, when `title` is not a string. */
  compactTitle?: string;
  /** A pushed screen: back chevron with the parent's name instead of the avatar. */
  back?: { to: string; label: string };
  /** The OverloadGPT button; on by default on the five main tabs (UI v3, A1). */
  coach?: boolean;
}

/**
 * One header for every page (UI v3, G5): a 44px row with the back button or the date on the
 * left and the buttons on the right, then the large title on its own line, so a long title
 * never wraps beside the buttons. The large title scrolls away and a centred 17px title fades
 * into a translucent bar only once it has gone.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  compactTitle,
  back,
  coach,
}: PageHeaderProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const { pathname } = useLocation();

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
  const tabRoot = !back && TAB_ROOTS.includes(pathname);
  const showCoach = coach ?? tabRoot;

  return (
    <>
      {small ? (
        <div
          aria-hidden
          className={cn(
            'compact-bar chrome pointer-events-none fixed inset-x-0 top-0 z-30 pt-safe lg:left-60',
            compact
              ? 'material-bar border-b-[0.5px] border-divider opacity-100 transition-opacity duration-150'
              : 'invisible opacity-0',
          )}
        >
          <p className="type-headline flex h-11 items-center justify-center truncate px-16 text-text-1">
            {small}
          </p>
        </div>
      ) : null}
      <header className="chrome pt-4 pb-5 lg:pt-6">
        <div className="flex h-11 items-center justify-between gap-3">
          {back ? (
            <Link
              to={back.to}
              aria-label={`Back to ${back.label}`}
              className="pressable tap-target -ml-2 inline-flex h-11 min-w-0 items-center gap-0.5 rounded-field pr-2 text-[1.0625rem] text-lime"
            >
              <ChevronLeft className="size-6 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">{back.label}</span>
            </Link>
          ) : eyebrow ? (
            <p className="type-meta min-w-0 truncate font-medium text-text-2">{eyebrow}</p>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {showCoach ? <CoachButton /> : null}
            {back ? null : <AvatarLink />}
          </div>
        </div>
        <h1 className="type-display mt-0.5 break-words text-text-1">{title}</h1>
        {subtitle ? (
          <p className="type-meta mt-1 max-w-[60ch] text-text-2 [text-wrap:balance]">{subtitle}</p>
        ) : null}
        {pathname === '/' ? <DemoBanner /> : null}
        <div ref={sentinel} aria-hidden className="h-px" />
      </header>
    </>
  );
}

/** Demo state is shown once, on Home, with the way to clear it (UI v3, B7). */
function DemoBanner() {
  const demo = useDemoStatus();
  if (!demo.data?.loaded) return null;
  return (
    <Link
      to="/settings#demo-data"
      className="pressable chrome type-meta mt-3 flex h-9 items-center justify-between rounded-field bg-surface px-3 text-text-2"
      data-demo-banner
    >
      <span>Demo data</span>
      <span className="text-lime">Manage</span>
    </Link>
  );
}

/** Initials in a 36px neutral circle, linking to More (profile, account, settings) on phones. */
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
      className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-[0.875rem] font-semibold text-text-1 lg:hidden"
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
