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
import { TAB_ICONS } from './TabIcons';

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="type-headline sr-only z-50 rounded-field bg-lime px-4 py-3 text-on-lime focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="min-w-0">
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[calc(70rem+4rem)] px-[max(1rem,env(safe-area-inset-left))] pt-safe pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none tab:px-6 lg:px-8 lg:pb-16"
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
        'chrome tap-target type-caption inline-flex h-6 items-center gap-1 rounded-full bg-surface-2 px-2.5 font-semibold text-text-2',
        className,
      )}
      title="You are viewing fictional demo data. Manage it in Settings."
    >
      <FlaskConical className="size-3.5" aria-hidden />
      Demo data
    </Link>
  );
}

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  const Tab = TAB_ICONS[item.to as keyof typeof TAB_ICONS];
  if (Tab) return <Tab filled={active} className="size-6 shrink-0" />;
  const Icon = item.icon;
  return <Icon className="size-6 shrink-0" strokeWidth={1.75} aria-hidden />;
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'pressable chrome type-body flex h-11 items-center gap-3 rounded-field px-3 font-medium',
          isActive ? 'bg-surface-2 text-text-1' : 'text-text-2 hover:text-text-1',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-lime' : undefined}>
            <NavIcon item={item} active={isActive} />
          </span>
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r-[0.5px] border-divider bg-bar px-4 py-6 lg:flex">
      <Link
        to="/"
        className="chrome mb-8 flex items-center gap-2.5 px-2"
        aria-label={`${APP_NAME} home`}
      >
        <BrandMark className="size-8" />
        <span className="type-title text-text-1">{APP_NAME}</span>
      </Link>
      <nav aria-label="Main navigation" className="flex flex-col">
        <div className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
        <div className="mx-3 my-5 h-[0.5px] bg-divider" aria-hidden />
        <div className="flex flex-col gap-1" role="group" aria-label="More">
          {SECONDARY_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
      </nav>
      <div className="mt-auto flex flex-col items-start gap-2 px-2 pt-6">
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
      className="chrome fixed inset-x-0 bottom-0 z-40 border-t-[0.5px] border-white/10 bg-bar pb-safe lg:hidden"
    >
      <ul className="mx-auto grid h-[3.0625rem] max-w-md grid-cols-5 px-1">
        {PRIMARY_NAV.map((item) => {
          const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
          return (
            <li key={item.to} className="flex">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'pressable type-caption flex flex-1 flex-col items-center justify-center gap-0.5',
                  active ? 'font-semibold text-text-1' : 'text-white/55',
                )}
              >
                <span className={active ? 'text-lime' : undefined}>
                  <NavIcon item={item} active={active} />
                </span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
