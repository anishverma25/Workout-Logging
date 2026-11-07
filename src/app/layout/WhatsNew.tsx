import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Camera, ScanText, Sparkles } from 'lucide-react';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { cn } from '@/lib/cn';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release (November 2026) is the
 * new name: Overload is now Macrotrophy, with a new logo and address, and the AI is Macrotrophy
 * AI, in two short steps. Never over a running workout or setup.
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
              <PrimaryButton block data-autofocus onClick={() => go('/food')} data-release-open>
                Log a meal
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
    icon: <img src="/icon.svg" alt="" width={64} height={64} className="size-16 rounded-[18px]" />,
    kicker: 'A new name',
    title: 'Overload is now Macrotrophy',
    lead: 'The same app and the same account, with a new name and a new logo.',
    body: (
      <ul className="type-body mt-4 flex flex-col gap-2.5 text-left text-text-2">
        <Point>
          <strong className="font-semibold text-text-1">Nothing to do.</strong> Your workouts,
          meals, records, groups and Pro stay exactly as they are.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">Our new address</strong> is macrotrophy.in.
          The app on your home screen keeps working.
        </Point>
        <Point>
          <strong className="font-semibold text-text-1">Find us</strong> on Instagram at
          @macrotrophy.in.
        </Point>
      </ul>
    ),
  },
  {
    icon: <Sparkles className="size-8" strokeWidth={1.5} />,
    kicker: 'Macrotrophy AI',
    title: 'Your AI has a new name too',
    lead: 'OverloadGPT is now Macrotrophy AI. Log food in seconds from Add food.',
    body: (
      <ul className="mt-3 flex w-full flex-col gap-1.5 text-left" data-release-ai>
        <AiRow icon={<Sparkles className="size-4" />} name="Ask AI">
          type or say what you ate
        </AiRow>
        <AiRow icon={<Camera className="size-4" />} name="AI snap">
          take a photo of your plate
        </AiRow>
        <AiRow icon={<ScanText className="size-4" />} name="Label">
          copy a pack&apos;s nutrition label
        </AiRow>
        <li className="type-subhead mt-1 text-text-2">
          Ask AI and AI snap are part of Pro. Explain buttons on Progress use it too.
        </li>
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

function AiRow({ icon, name, children }: { icon: ReactNode; name: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-nested bg-surface-2 px-3 py-2">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
        aria-hidden
      >
        {icon}
      </span>
      <span className="type-subhead text-text-1">
        <strong className="font-semibold">{name}</strong>: {children}
      </span>
    </li>
  );
}
