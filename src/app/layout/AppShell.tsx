import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDemoStatus } from '@/data/hooks';
import { APP_NAME, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '../navigation';
import { BrandMark } from './BrandMark';
import { AppNotices } from './AppNotices';
import { StartWorkoutProvider } from '@/features/workout/StartWorkout';
import { WorkoutDock } from '@/features/workout/WorkoutDock';
import { SyncBadge } from '@/features/account/SyncStatus';

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only z-50 rounded-xl bg-accent px-4 py-3 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="min-w-0">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto outline-none w-full max-w-[72rem] px-safe pb-[calc(6rem+env(safe-area-inset-bottom))] pt-safe lg:px-10 lg:pb-16"
        >
          <AppNotices />
          <StartWorkoutProvider>
            <Suspense fallback={null}>
              <div key={pathname} className="page-in">
                <Outlet />
              </div>
            </Suspense>
            <WorkoutDock />
          </StartWorkoutProvider>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

export function DemoPill({ className }: { className?: string }) {
  const demo = useDemoStatus();
  if (!demo.data?.loaded) return null;
  return (
    <Link
      to="/settings#demo-data"
      className={cn(
        'tap-target inline-flex h-7 items-center gap-1.5 rounded-full border border-warn/40 bg-warn-soft px-2.5 text-xs font-semibold text-warn',
        className,
      )}
      title="You are viewing fictional demo data. Manage it in Settings."
    >
      <FlaskConical className="size-3.5" aria-hidden />
      Demo data
    </Link>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group flex h-10 items-center gap-3 rounded-[0.7rem] px-3 text-[0.95rem] font-medium transition-colors',
          isActive ? 'bg-surface text-text' : 'text-muted hover:bg-surface/60 hover:text-text',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'size-[1.2rem]',
              isActive ? 'text-accent-text' : 'text-faint group-hover:text-muted',
            )}
            aria-hidden
            strokeWidth={isActive ? 2.25 : 1.9}
          />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-4 py-6 lg:flex">
      <Link to="/" className="mb-8 flex items-center gap-2.5 px-2" aria-label={`${APP_NAME} home`}>
        <BrandMark className="size-8" />
        <span className="font-display text-[1.4rem] font-bold tracking-tight">{APP_NAME}</span>
      </Link>
      <nav aria-label="Main navigation" className="flex flex-col">
        <div className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
        <div className="mx-3 my-5 h-px bg-line" aria-hidden />
        <div className="flex flex-col gap-1" role="group" aria-label="More">
          {SECONDARY_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
      </nav>
      <div className="mt-auto flex flex-col items-start gap-2 px-2">
        <DemoPill />
        <SyncBadge className="-mx-2 w-[calc(100%+1rem)]" />
      </div>
    </aside>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[var(--nav-bg)] pb-safe backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="mx-auto grid h-[3.4rem] max-w-md grid-cols-5 px-1">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
          return (
            <li key={item.to} className="flex">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-[3px] pt-1 text-[0.66rem] font-medium tracking-[0.01em] transition-[color,transform] duration-150 active:scale-[0.92]',
                  active ? 'text-accent-text' : 'text-faint',
                )}
              >
                <Icon
                  className="size-[1.45rem]"
                  aria-hidden
                  strokeWidth={active ? 2.3 : 1.85}
                />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
