import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Camera, Crown, Sparkles } from 'lucide-react';
import { formatRupees, usePlans } from '@/app/billing';
import { useFeature } from '@/app/entitlement';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release: the all-new food logging
 * (photo and AI logging in Pro, 9,000+ foods, protein brands and cafe food). The price comes from the
 * server's plans, never from this file. Never over a running workout or setup.
 */
export function WhatsNew() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pro = useFeature('food_insights');
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
          <Camera className="size-10" strokeWidth={1.5} />
        </span>
        <p className="type-caption mt-4 font-semibold text-lime">The all-new food logging</p>
        <p className="type-title mt-1 text-text-1">Snap it. Say it. Logged.</p>
        <p className="type-body mt-1 text-text-2 [text-wrap:balance]">
          The fastest way to track what you eat in India, built into the app you already train with.
        </p>
        <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2">
          <Point pro>
            <strong className="font-semibold text-text-1">Snap your plate.</strong> OverloadGPT
            names every food and judges the amount against your plate, katori and rotis. Point it at
            a nutrition label and it reads the numbers.
          </Point>
          <Point pro>
            <strong className="font-semibold text-text-1">Or just say it.</strong> &ldquo;2 aloo
            parathas and a cold coffee&rdquo;, typed or spoken, in English or Hinglish. Any brand,
            any restaurant.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Over 9,000 foods, made for India.</strong>{' '}
            Katori portions and oil levels, thalis and family recipes, over 30 protein powders, and
            cafe favourites from cappuccino to tiramisu.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Numbers you can check.</strong> Brands
            from their labels, dishes from tested recipes, and every AI estimate marked as one.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Connected to your training.</strong>{' '}
            Calories and protein against your targets, and with Pro, your real maintenance from what
            you eat and weigh, and protein help in one tap.
          </Point>
        </ul>
        {pro ? null : (
          <p className="type-meta mt-4 w-full rounded-nested bg-surface-2 p-3 text-left text-text-2">
            <Crown className="mr-1 inline size-4 align-[-3px] text-lime" aria-hidden />
            Logging from the library is free for everyone. Photo and AI logging are part of Pro
            {monthly
              ? `, from ${formatRupees(monthly.priceInr)} a month.`
              : ', for less than a cup of coffee a month.'}
          </p>
        )}
        <div className="mt-5 flex w-full flex-col gap-2">
          <PrimaryButton block data-autofocus onClick={() => go('/food')}>
            {pro ? 'Snap my next meal' : 'Open food logging'}
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
          <span className="type-caption ml-1.5 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 align-[1px] font-semibold text-text-2">
            <Crown className="size-3" aria-hidden />
            Pro
          </span>
        ) : null}
      </span>
    </li>
  );
}
