import { lazy, Suspense, useState } from 'react';
import { Maximize2, Sparkles } from 'lucide-react';
import { useAccount } from '@/app/account';
import { useFeature } from '@/app/entitlement';
import { BottomSheet, Skeleton, TextLink } from '@/components/kit';
import { cn } from '@/lib/cn';
import { warmAi } from '@/app/aiWarm';

// Loaded when first opened, so the coach and its long instructions are not part of every
// app start.
const CoachBody = lazy(() => import('./CoachPage').then((m) => ({ default: m.CoachBody })));
const preload = () => void import('./CoachPage');

/**
 * OverloadGPT one tap away: a round sparkle button in the header of every main tab (UI v3, A1).
 * It opens the coach over the page, as the old floating button did, without covering anything.
 */
export function CoachButton({ className }: { className?: string }) {
  const account = useAccount();
  const pro = useFeature('ai_coach');
  const [open, setOpen] = useState(false);
  if (account.status === 'unavailable') return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (pro) warmAi();
        }}
        onPointerDown={preload}
        aria-label={pro ? 'Ask OverloadGPT' : 'Ask OverloadGPT (Pro)'}
        title="Ask OverloadGPT"
        data-coach-launcher
        className={cn(
          'pressable chrome tap-target inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-lime',
          className,
        )}
      >
        <Sparkles className="size-[1.125rem]" aria-hidden />
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="OverloadGPT"
        subtitle="Ask about your training, in any language"
        wide
      >
        {open ? (
          <div className="flex flex-col gap-4">
            <Suspense fallback={<Skeleton height={240} radius="panel" />}>
              <CoachBody />
            </Suspense>
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
