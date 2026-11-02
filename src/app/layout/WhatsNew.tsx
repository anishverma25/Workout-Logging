import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Crown, Globe2, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { cn } from '@/lib/cn';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release (November 2026) is about
 * leaderboards only, global and in groups, explained in three short steps: what they are, how
 * points work, and what others can see. Never over a running workout or setup.
 */
export function WhatsNew() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => !seenRelease());
  const [step, setStep] = useState(0);
  const busy =
    pathname.startsWith('/workout') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/groups');
  const close = () => {
    markReleaseSeen();
    setOpen(false);
  };
  const go = (to: string) => {
    close();
    navigate(to);
  };
  const last = STEPS.length - 1;
  // Each step starts at its top, even if the last one was scrolled on a small screen.
  const toStep = (n: number) => {
    setStep(n);
    document.querySelector('[data-release]')?.closest('[data-sheet-body]')?.scrollTo(0, 0);
  };
  const s = STEPS[step]!;
  return (
    <BottomSheet
      open={open && !busy}
      onClose={close}
      title="New in Overload"
      hideHeader
      footer={
        <div>
          <div className="flex items-center justify-center gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-5 bg-lime' : 'w-1.5 bg-fill',
                )}
              />
            ))}
          </div>
          <p className="sr-only">
            Step {step + 1} of {STEPS.length}
          </p>

          <div className="mt-3 flex w-full flex-col gap-2">
            {step < last ? (
              <PrimaryButton
                block
                data-autofocus
                onClick={() => toStep(step + 1)}
                data-release-next
              >
                Next
              </PrimaryButton>
            ) : (
              <PrimaryButton
                block
                data-autofocus
                onClick={() => go('/groups/global')}
                data-release-open
              >
                See the leaderboard
              </PrimaryButton>
            )}
            <SecondaryButton
              block
              onClick={step === 0 || step === last ? close : () => toStep(step - 1)}
            >
              {step === 0 || step === last ? 'Later' : 'Back'}
            </SecondaryButton>
          </div>
        </div>
      }
    >
      <div
        className="flex flex-col items-center pt-3 text-center"
        data-release={RELEASE_ID}
        data-release-step={step + 1}
      >
        <span
          className="flex size-16 items-center justify-center rounded-full bg-lime-dim text-lime"
          aria-hidden
        >
          {s.icon}
        </span>
        <p className="type-subhead mt-3 font-semibold text-lime">{s.kicker}</p>
        <p className="type-title-1 mt-1 text-text-1 [text-wrap:balance]">{s.title}</p>
        <p className="type-body mt-1 text-text-2 [text-wrap:balance]">{s.lead}</p>
        {s.body}
      </div>
    </BottomSheet>
  );
}

const STEPS: {
  icon: ReactNode;
  kicker: string;
  title: string;
  lead: string;
  body: ReactNode;
}[] = [
  {
    icon: <Globe2 className="size-8" strokeWidth={1.5} />,
    kicker: 'New: leaderboards',
    title: 'Compete with all of Overload and your friends',
    lead: 'Weekly and monthly leaderboards, for everyone and for your own groups.',
    body: (
      <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2">
        <Point>
          <strong className="font-semibold text-text-1">Global leaderboard.</strong> Everyone on
          Overload who trains this week or month, ranked by the same fair score.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">Groups.</strong> Create one and share its
          6-character code, or join a friend&apos;s by typing theirs. Up to 30 people.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">In every group:</strong> who trained today,
          a tap to see how points add up, and past winners.
        </Point>
      </ul>
    ),
  },
  {
    icon: <Trophy className="size-8" strokeWidth={1.5} />,
    kicker: 'Fair for every level',
    title: 'Points for effort, not size',
    lead: 'A beginner can beat a strong lifter by showing up and pushing hard.',
    body: (
      <ul className="mt-3 flex w-full flex-col gap-1.5 text-left" data-release-points>
        <PointsRow points={10}>a workout of 10 minutes or more (up to 6 a week)</PointsRow>
        <PointsRow points={1}>a hard working set (up to 25 a week)</PointsRow>
        <PointsRow points={5}>a personal record on a lift you have done before</PointsRow>
        <PointsRow points={3}>a day you reach 90% of your protein target</PointsRow>
        <li className="type-subhead mt-1 text-text-2">
          Worked out on our server from what you log, so nobody can fake it.
        </li>
      </ul>
    ),
  },
  {
    icon: <ShieldCheck className="size-8" strokeWidth={1.5} />,
    kicker: 'Private by design',
    title: 'Your name, your choice',
    lead: 'On the global leaderboard others see your name and points. Your username shows only if you turn it on.',
    body: (
      <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2">
        <Point>Never your weights, food, body weight or workouts.</Point>
        <Point>
          Groups need a unique username, picked once. Show it on the global leaderboard with one
          switch, or keep it to your groups.
        </Point>
        <Point>
          The Overload Score board is free for everyone. Consistency, Effort, Progress and Volume
          boards in groups come with Pro.
          <span className="type-caption ml-1.5 inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 align-[1px] font-semibold text-text-2">
            <Crown className="size-3" aria-hidden />
            Pro
          </span>
        </Point>
      </ul>
    ),
  },
];

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Sparkles className="mt-1 size-4 shrink-0 text-lime" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function PointsRow({ points, children }: { points: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-nested bg-surface-2 px-3 py-1.5">
      <span className="type-headline tabular flex h-7 min-w-11 shrink-0 items-center justify-center rounded-full bg-lime px-2 text-on-lime">
        +{points}
      </span>
      <span className="type-subhead text-text-1">For {children}</span>
    </li>
  );
}
