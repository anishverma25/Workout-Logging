import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDemoStatus } from '@/data/hooks';
import { APP_NAME, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '../navigation';
import { BrandMark } from './BrandMark';
import { StartWorkoutProvider } from '@/features/workout/StartWorkout';
import { WorkoutDock } from '@/features/workout/WorkoutDock';

export function AppShell() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <Sidebar />
      <div className="min-w-0">
        <main
          id="main"
          className="mx-auto w-full max-w-[72rem] px-safe pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-safe lg:px-10 lg:pb-16"
        >
          <StartWorkoutProvider>
            <Suspense fallback={null}>
              <Outlet />
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
        'inline-flex h-7 items-center gap-1.5 rounded-full border border-warn/40 bg-warn-soft px-2.5 text-xs font-semibold text-warn',
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
          'group flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium transition-colors',
          isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2/60 hover:text-text',
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
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/40 px-4 py-6 lg:flex">
      <Link to="/" className="mb-8 flex items-center gap-2.5 px-2" aria-label={`${APP_NAME} home`}>
        <BrandMark className="size-8" />
        <span className="font-display text-2xl font-bold tracking-[0.01em]">{APP_NAME}</span>
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
      <div className="mt-auto px-2">
        <DemoPill />
      </div>
    </aside>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[var(--nav-bg)] pb-safe backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-[4.25rem] max-w-md grid-cols-5 px-2">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
          const isWorkout = item.to === '/workout';
          return (
            <li key={item.to} className="flex">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[0.7rem] font-semibold tracking-[0.01em] transition-colors active:scale-95"
              >
                {isWorkout ? (
                  <span
                    className={cn(
                      'flex size-11 items-center justify-center rounded-2xl transition-colors',
                      active ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-text',
                    )}
                  >
                    <Icon className="size-[1.3rem]" aria-hidden strokeWidth={2.25} />
                  </span>
                ) : (
                  <Icon
                    className={cn('size-[1.35rem]', active ? 'text-accent-text' : 'text-faint')}
                    aria-hidden
                    strokeWidth={active ? 2.25 : 1.9}
                  />
                )}
                <span className={cn(isWorkout && 'sr-only', active ? 'text-text' : 'text-faint')}>
                  {item.label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
