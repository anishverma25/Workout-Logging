import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Crown, Sparkles } from 'lucide-react';
import { formatRupees, usePlans } from '@/app/billing';
import { useFeature } from '@/app/entitlement';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release: the fresh look (UI v3):
 * five tabs, OverloadGPT on every tab, Progress in sections and History search. The price comes
 * from the server's plans, never from this file. Never over a running workout or setup.
 */
export function WhatsNew() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pro = useFeature('ai_coach');
  const plans = usePlans();
  const monthly = plans?.find((p) => p.id === 'monthly' && p.priceInr > 0) ?? null;
  const [open, setOpen] = useState(() => !seenRelease());
  const busy = pathname.startsWith('/workout') || pathname.startsWith('/setup');
  const close = () => {
    markReleaseSeen();
    setOpen(false);
  };
  const go = (to: string) => {
    close();
    navigate(to);
  };
  return (
    <BottomSheet open={open && !busy} onClose={close} title="New in Overload" hideHeader>
      <div className="flex flex-col items-center pt-5 text-center" data-release={RELEASE_ID}>
        <span
          className="flex size-20 items-center justify-center rounded-full bg-lime-dim text-lime"
          aria-hidden
        >
          <Sparkles className="size-10" strokeWidth={1.5} />
        </span>
        <p className="type-subhead mt-4 font-semibold text-lime">A fresh look</p>
        <p className="type-title-1 mt-1 text-text-1">Cleaner, calmer, quicker.</p>
        <p className="type-body mt-1 text-text-2 [text-wrap:balance]">
          Every screen was redrawn so the number you came for comes first.
        </p>
        <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2">
          <Point>
            <strong className="font-semibold text-text-1">Five tabs.</strong> Home, Workout, Food,
            Progress and History. Your routines live inside Workout.
          </Point>
          <Point pro>
            <strong className="font-semibold text-text-1">OverloadGPT on every tab.</strong> Tap the
            sparkle at the top right to ask about your own training and food.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Progress in sections.</strong> Overview,
            strength, volume, body and food, from 7 days to all time.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Search your history.</strong> Find a
            workout by name or exercise, and filter by date, muscle or exercise.
          </Point>
        </ul>
        {pro ? null : (
          <p className="type-subhead mt-4 w-full rounded-nested bg-surface-2 p-3 text-left text-text-2">
            <Crown className="mr-1 inline size-4 align-[-3px] text-lime" aria-hidden />
            OverloadGPT and the full Progress analysis are part of Pro
            {monthly ? `, from ${formatRupees(monthly.priceInr)} a month.` : '.'}
          </p>
        )}
        <div className="mt-5 flex w-full flex-col gap-2">
          <PrimaryButton block data-autofocus onClick={() => (pro ? go('/progress') : close())}>
            {pro ? 'Open Progress' : 'Got it'}
          </PrimaryButton>
          <SecondaryButton block onClick={() => (pro ? close() : go('/pro'))}>
            {pro ? 'Later' : 'See Pro'}
          </SecondaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}

function Point({ children, pro = false }: { children: React.ReactNode; pro?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <Sparkles className="mt-1 size-4 shrink-0 text-lime" aria-hidden />
      <span>
        {children}
        {pro ? (
          <span className="type-caption ml-1.5 inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 align-[1px] font-semibold text-text-2">
            <Crown className="size-3" aria-hidden />
            Pro
          </span>
        ) : null}
      </span>
    </li>
  );
}
