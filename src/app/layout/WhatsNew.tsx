import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Crown, Sparkles } from 'lucide-react';
import { formatRupees, usePlans } from '@/app/billing';
import { useFeature } from '@/app/entitlement';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release: the AI coach, a Pro
 * feature. The price comes from the server's plans, never from this file, so it is always the
 * price people actually pay. Never over a running workout; it waits until the person is
 * elsewhere.
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
          className="flex size-20 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-lime"
          aria-hidden
        >
          <Sparkles className="size-10" strokeWidth={1.5} />
        </span>
        <p className="type-caption mt-4 font-semibold text-lime">New update</p>
        <p className="type-title mt-1 text-text-1">Meet your AI coach</p>
        <p className="type-body mt-1 text-text-2 [text-wrap:balance]">
          The biggest thing we have ever built for Overload. A coach that knows every set you have
          logged.
        </p>
        <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2">
          <Point>
            <strong className="font-semibold text-text-1">
              Answers about you, not the internet.
            </strong>{' '}
            It reads your last 30 days: every lift, record, rest time and muscle group.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Why your lift is stuck,</strong> and the
            exact weight and reps to try in your next session.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Ask in your language.</strong> English,
            Hindi or Hinglish: "bench kyu nahi badh raha?" works.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Explain on every card,</strong> and a
            round coach button on every screen, so help is always one tap away.
          </Point>
        </ul>
        <div className="mt-4 w-full rounded-nested bg-surface-2 p-4 text-left">
          <p className="type-headline flex items-center gap-2 text-text-1">
            <Crown className="size-4 text-lime" aria-hidden />
            {pro ? 'You have Pro, so it is ready now' : 'Part of Overload Pro'}
          </p>
          <p className="type-meta mt-1 text-text-2">
            {pro
              ? 'Tap the round button at the bottom of any screen, or Explain on any Progress card.'
              : monthly
                ? `Just ${formatRupees(monthly.priceInr)} a month, less than a cup of coffee, for a coach who knows every rep you have done. Longer plans cost even less.`
                : 'A coach who knows every rep you have done, for less than a cup of coffee a month.'}
          </p>
        </div>
        <div className="mt-5 flex w-full flex-col gap-2">
          <PrimaryButton block data-autofocus onClick={() => go(pro ? '/coach' : '/pro')}>
            {pro ? 'Ask my coach' : 'Get Pro'}
          </PrimaryButton>
          <SecondaryButton block onClick={close}>
            Later
          </SecondaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Sparkles className="mt-1 size-4 shrink-0 text-lime" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
