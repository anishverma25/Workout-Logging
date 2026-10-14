import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { BadgeMedallion } from '@/features/medals/BadgeMedallion';
import { INSTAGRAM_HANDLE, INSTAGRAM_URL, SUPPORT_EMAIL } from '@/features/legal/contact';
import type { Badge } from '@/domain/achievements/badges';
import { MedalIcon } from '@/features/medals/Medal';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/** A sample badge for the announcement: a real design, no one's real numbers. */
const SAMPLE: Badge = {
  id: 'workouts-100',
  group: 'workouts',
  title: 'Century club',
  goal: 'Log 100 workouts',
  icon: 'dumbbell',
  tier: 'gold',
  target: 100,
  current: 100,
  earnedAt: new Date(0),
  workoutId: null,
};

/**
 * Shown once per release when the app opens: what is new, and how to tell us what to build
 * next. Never over a running workout; it waits until the person is elsewhere.
 */
export function WhatsNew() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => !seenRelease());
  const busy = pathname.startsWith('/workout') || pathname.startsWith('/setup');
  const close = () => {
    markReleaseSeen();
    setOpen(false);
  };
  return (
    <BottomSheet open={open && !busy} onClose={close} title="New in Overload" hideHeader>
      <div className="flex flex-col items-center pt-5 text-center" data-release={RELEASE_ID}>
        <div className="flex items-center justify-center gap-2" aria-hidden>
          <MedalIcon className="size-12" />
          <BadgeMedallion badge={SAMPLE} className="size-24" />
          <MedalIcon className="size-12" />
        </div>
        <p className="type-caption mt-3 font-semibold text-gold">New update</p>
        <p className="type-title mt-1 text-text-1">Medals and badges are here</p>
        <ul className="type-body mt-3 flex flex-col gap-2 text-left text-text-2">
          <li>A gold medal the moment a set beats your best, for every kind of exercise.</li>
          <li>
            Badges to unlock: plate clubs, streaks, early bird, 100 workouts and more, each with how
            close you are.
          </li>
          <li>Share any badge or your medals to your Instagram story or WhatsApp status.</li>
        </ul>
        <div className="mt-4 w-full rounded-nested bg-surface-2 p-4 text-left">
          <p className="type-body text-text-1">
            Keep sending us the features you want in Overload, and we will bring them as soon as we
            can.
          </p>
          <p className="type-meta mt-2 text-text-2">
            Email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-text-1 underline">
              {SUPPORT_EMAIL}
            </a>{' '}
            or Instagram{' '}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-text-1 underline"
            >
              {INSTAGRAM_HANDLE}
            </a>
          </p>
        </div>
        <div className="mt-5 flex w-full flex-col gap-2">
          <PrimaryButton
            block
            data-autofocus
            onClick={() => {
              close();
              navigate('/badges');
            }}
          >
            See my badges
          </PrimaryButton>
          <SecondaryButton block onClick={close}>
            Later
          </SecondaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}
