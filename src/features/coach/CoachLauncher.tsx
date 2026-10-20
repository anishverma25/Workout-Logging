import { useState } from 'react';
import { useLocation } from 'react-router';
import { Maximize2, Sparkles } from 'lucide-react';
import { useAccount } from '@/app/account';
import { useFeature } from '@/app/entitlement';
import { BottomSheet, TextLink } from '@/components/kit';
import { useActiveWorkout } from '@/data/hooks';
import { cn } from '@/lib/cn';
import { CoachBody } from './CoachPage';

/**
 * A small round button on every screen that opens the coach over the page, so a question is
 * one tap away wherever you are. Left out on the coach page itself and inside a running
 * workout, where the logger's own controls sit at the bottom. Above the workout bar when one
 * is showing.
 */
export function CoachLauncher() {
  const { pathname } = useLocation();
  const account = useAccount();
  const pro = useFeature('ai_coach');
  const workout = useActiveWorkout().data;
  const [open, setOpen] = useState(false);
  if (account.status === 'unavailable') return null;
  if (pathname === '/coach' || pathname === '/workout' || pathname.startsWith('/workouts/'))
    return null;
  const dock = !!workout;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={pro ? 'Ask your coach' : 'Ask your coach (Pro)'}
        title="Ask your coach"
        data-coach-launcher
        className={cn(
          'pressable chrome fixed right-4 z-30 flex size-12 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-lime lg:right-8',
          dock
            ? 'bottom-[calc(49px+1rem+3.5rem+0.75rem+env(safe-area-inset-bottom))] lg:bottom-24'
            : 'bottom-[calc(49px+1rem+env(safe-area-inset-bottom))] lg:bottom-8',
        )}
      >
        <Sparkles className="size-5" aria-hidden />
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Coach"
        subtitle="Ask about your training, in any language"
        wide
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <CoachBody />
            <TextLink
              to="/coach"
              small
              icon={<Maximize2 />}
              onClick={() => setOpen(false)}
              className="self-start"
            >
              Open full screen
            </TextLink>
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
