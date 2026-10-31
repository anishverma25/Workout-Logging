import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ClipboardList, Crown, Sparkles } from 'lucide-react';
import { formatRupees, useCoachingPlan } from '@/app/billing';
import { useEntitlement } from '@/app/entitlement';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release (November 2026) is about
 * one thing only: 1:1 coaching. The price comes from the server's plans, never from this file.
 * Never over a running workout or setup.
 */
export function WhatsNew() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const e = useEntitlement();
  const plan = useCoachingPlan();
  const [open, setOpen] = useState(() => !seenRelease());
  const busy =
    pathname.startsWith('/workout') || pathname.startsWith('/setup') || pathname === '/coaching';
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
          <ClipboardList className="size-10" strokeWidth={1.5} />
        </span>
        <p className="type-subhead mt-4 font-semibold text-lime">New: 1:1 coaching</p>
        <p className="type-title-1 mt-1 text-text-1 [text-wrap:balance]">
          Your own coach, inside Overload
        </p>
        <p className="type-body mt-1 text-text-2 [text-wrap:balance]">
          An experienced, science-based coach who plans your training and diet with you.
        </p>
        <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2">
          <Point>
            <strong className="font-semibold text-text-1">Your plan.</strong> Split, exercises, sets
            and reps for your goal, days and gym.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Your diet.</strong> Calories, protein and
            meals from the Indian food you already eat.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Calls and WhatsApp.</strong> One to one
            with your coach, between calls too.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Pro included.</strong> Every Pro feature
            and OverloadGPT while your coaching runs.
          </Point>
        </ul>
        {plan && !e.coaching ? (
          <p className="type-subhead mt-4 w-full rounded-nested bg-surface-2 p-3 text-left text-text-2">
            <Crown className="mr-1 inline size-4 align-[-3px] text-lime" aria-hidden />
            {formatRupees(plan.priceInr)} a month, about{' '}
            {formatRupees(Math.round(plan.priceInr / 30))} a day. Cancel any time.
          </p>
        ) : null}
        <div className="mt-5 flex w-full flex-col gap-2">
          <PrimaryButton block data-autofocus onClick={() => go('/coaching')} data-release-open>
            {e.coaching ? 'Open my coaching' : 'See 1:1 coaching'}
          </PrimaryButton>
          <SecondaryButton block onClick={close}>
            Later
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
