import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Crown, Sparkles, UtensilsCrossed } from 'lucide-react';
import { formatRupees, usePlans } from '@/app/billing';
import { useFeature } from '@/app/entitlement';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release: food logging built for
 * Indian meals (free), with AI food logging, food insights and OverloadGPT in Pro. The price comes from the
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
          <UtensilsCrossed className="size-10" strokeWidth={1.5} />
        </span>
        <p className="type-caption mt-4 font-semibold text-lime">New update</p>
        <p className="type-title mt-1 text-text-1">Food logging is here</p>
        <p className="type-body mt-1 text-text-2 [text-wrap:balance]">
          Roti and dal, whey and oats, biryani, burgers and momos: over 9,000 foods, logged the way
          you actually eat them.
        </p>
        <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2">
          <Point>
            <strong className="font-semibold text-text-1">By the katori, not the gram.</strong>{' '}
            Katori, roti, glass and ladle portions, with light, normal or rich oil.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Your usual in one tap.</strong> The
            breakfast you eat every day, a whole thali, or the family pot, logged in seconds.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Gym food and brands.</strong> Egg whites,
            chicken breast, soya chunks, whey from ON, MuscleBlaze and Avvatar, peanut butter, oats,
            muesli and protein bars, with their pack values.
          </Point>
          <Point>
            <strong className="font-semibold text-text-1">Free for everyone.</strong> Calories and
            protein against your targets, every day.
          </Point>
        </ul>
        <div className="mt-4 w-full rounded-nested bg-surface-2 p-4 text-left">
          <p className="type-headline flex items-center gap-2 text-text-1">
            <Crown className="size-4 text-lime" aria-hidden />
            {pro ? 'You have Pro, so you also get' : 'Pro goes further'}
          </p>
          <ul className="type-meta mt-2 flex flex-col gap-1.5 text-text-2">
            <li>
              <strong className="font-semibold text-text-1">Your real maintenance calories</strong>{' '}
              from what you eat and weigh, not a guess.
            </li>
            <li>
              <strong className="font-semibold text-text-1">AI food logging.</strong> Tell
              OverloadGPT what you ate, typed or spoken. It finds any food, brand or restaurant dish
              and fills your plate.
            </li>
            <li>
              <strong className="font-semibold text-text-1">Protein help in one tap</strong> with
              foods you already eat.
            </li>
            <li>
              <strong className="font-semibold text-text-1">OverloadGPT</strong>, our AI assistant
              (the coach, renamed), now reads your food too.
            </li>
          </ul>
          {pro ? null : (
            <p className="type-meta mt-2 text-text-2">
              {monthly
                ? `Just ${formatRupees(monthly.priceInr)} a month. Longer plans cost even less.`
                : 'Less than a cup of coffee a month.'}
            </p>
          )}
        </div>
        <div className="mt-5 flex w-full flex-col gap-2">
          <PrimaryButton block data-autofocus onClick={() => go('/food')}>
            Log my first meal
          </PrimaryButton>
          <SecondaryButton block onClick={() => (pro ? close() : go('/pro'))}>
            {pro ? 'Later' : 'See Pro'}
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
