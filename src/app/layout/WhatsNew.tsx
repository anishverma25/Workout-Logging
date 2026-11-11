import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { FileChartColumn, ImagePlus, Medal, Sparkles } from 'lucide-react';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { cn } from '@/lib/cn';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release (November 2026) is story
 * cards on your own photo, the new badges and the weekly report, in three short steps. Never over
 * a running workout or setup.
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
      title="New in Macrotrophy"
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
              <PrimaryButton block data-autofocus onClick={() => go('/report')} data-release-open>
                See your weekly report
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
    icon: <ImagePlus className="size-8" strokeWidth={1.5} />,
    kicker: 'Story cards',
    title: 'Your workout on your own photo',
    lead: 'Share a workout, a record or your streak as a story card, with your photo behind it.',
    body: (
      <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2" data-release-cards>
        <Point>
          <strong className="font-semibold text-text-1">Seven designs</strong>, from stickers to a
          receipt and a scoreboard.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">Drag, pinch and resize</strong> the stats
          anywhere on the photo, and pick the colours and font.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">Share your rank</strong> from Groups and
          the global leaderboard.
        </Point>
      </ul>
    ),
  },
  {
    icon: <Medal className="size-8" strokeWidth={1.5} />,
    kicker: 'Badges',
    title: 'Badges got a glow up',
    lead: 'A new look for every badge, and a proper moment when you earn one.',
    body: (
      <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2" data-release-badges>
        <Point>
          <strong className="font-semibold text-text-1">A shape for each kind</strong>: workouts,
          streaks, records, strength and habits.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">Bronze to Legend.</strong> Gold shines and
          Legend shifts colour.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">See what is next</strong> and how close you
          are, right after you unlock one.
        </Point>
      </ul>
    ),
  },
  {
    icon: <FileChartColumn className="size-8" strokeWidth={1.5} />,
    kicker: 'Weekly report',
    title: 'Your week, read for you',
    lead: 'One report a week that reads your training and your food together.',
    body: (
      <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2" data-release-report>
        <Point>
          <strong className="font-semibold text-text-1">Three changes for next week</strong>, each
          checked in your next report.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">Strength, muscles, weight and food</strong>,
          all from your own logs, in English or Hinglish.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">Download it as a PDF.</strong> Part of Pro.
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
