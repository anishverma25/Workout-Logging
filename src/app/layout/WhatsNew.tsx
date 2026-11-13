import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { Sparkles } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/kit';
import { cn } from '@/lib/cn';
import { RELEASE_STEPS, type ReleaseStep } from './whatsNewContent';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. The November 2026 revamp (the Brain and
 * fair play together) is the largest so far, so it takes the whole screen: a story-style progress
 * bar, one part per page with its drawing, what it does, who gets it and where it lives, and a
 * button to go there. The same content stays on the "What is new" page. Never over a running
 * workout, setup or a group.
 */
export function WhatsNew() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => !seenRelease());
  const [step, setStep] = useState(0);
  const busy =
    pathname.startsWith('/workout') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/groups') ||
    pathname.startsWith('/whats-new');
  const shown = open && !busy;
  const close = () => {
    markReleaseSeen();
    setOpen(false);
  };
  const go = (to: string) => {
    close();
    navigate(to);
  };
  const last = RELEASE_STEPS.length - 1;
  const scroller = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  // Each page starts at its top, even if the last one was scrolled on a small screen.
  const toStep = (n: number) => {
    setStep(Math.max(0, Math.min(last, n)));
    scroller.current?.scrollTo(0, 0);
  };

  // The page behind stays still while the walkthrough is up, and gets its scroll back after.
  useEffect(() => {
    if (!shown) return;
    const body = document.body;
    const before = body.style.overflow;
    body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      body.style.overflow = before;
    };
  }, [shown]);

  if (!shown) return null;
  const s = RELEASE_STEPS[step]!;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') toStep(step + 1);
    else if (e.key === 'ArrowLeft') toStep(step - 1);
  };
  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="New in Macrotrophy"
      tabIndex={-1}
      onKeyDown={onKey}
      className="fixed inset-0 z-[60] flex flex-col bg-bg outline-none"
      data-release={RELEASE_ID}
      data-release-step={step + 1}
      data-whats-new-full
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[55%] bg-[radial-gradient(70%_60%_at_50%_0%,var(--lime-dim),transparent_70%)]"
        aria-hidden
      />
      <header className="relative mx-auto w-full max-w-xl px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <ol className="flex gap-1" aria-hidden>
          {RELEASE_STEPS.map((x, i) => (
            <li key={x.id} className="h-1 flex-1 overflow-hidden rounded-full bg-fill">
              <span
                className={cn(
                  'block h-full rounded-full bg-lime transition-[width] duration-500 motion-reduce:transition-none',
                  i <= step ? 'w-full' : 'w-0',
                )}
              />
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-center justify-between">
          <p className="type-footnote text-text-2">
            New in Macrotrophy · {step + 1} of {RELEASE_STEPS.length}
          </p>
          <button
            type="button"
            onClick={close}
            className="pressable chrome type-subhead tap-target -mr-2 rounded-full px-2 font-semibold text-text-2"
            data-release-skip
          >
            {step === last ? 'Close' : 'Skip'}
          </button>
        </div>
      </header>

      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]"
        data-sheet-body
      >
        <div
          key={s.id}
          className="mx-auto w-full max-w-xl px-5 pt-4 pb-6 motion-safe:animate-[release-in_420ms_cubic-bezier(0.22,1,0.36,1)]"
        >
          <ReleaseStepView step={s} full />
        </div>
      </div>

      <footer className="relative mx-auto w-full max-w-xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2">
          {step < last ? (
            <PrimaryButton block data-autofocus onClick={() => toStep(step + 1)} data-release-next>
              Next
            </PrimaryButton>
          ) : (
            <PrimaryButton block data-autofocus onClick={() => go(s.where.to)} data-release-open>
              {s.where.label}
            </PrimaryButton>
          )}
          <SecondaryButton
            block
            onClick={step === 0 ? close : step === last ? close : () => toStep(step - 1)}
            data-release-second
          >
            {step === 0 ? 'Later' : step === last ? 'Start training' : 'Back'}
          </SecondaryButton>
        </div>
      </footer>
    </div>,
    document.body,
  );
}

/** One part of the release: drawing, what it does, who gets it. */
export function ReleaseStepView({
  step: s,
  page = false,
  full = false,
}: {
  step: ReleaseStep;
  page?: boolean;
  /** The full-screen walkthrough: a larger title and drawing. */
  full?: boolean;
}) {
  return (
    <div
      className={cn('flex flex-col', page ? 'text-left' : 'items-center pt-1 text-center')}
      data-release-part={s.id}
    >
      <p className="type-subhead font-semibold text-lime">{s.kicker}</p>
      {page ? (
        <h2 className="type-title-1 mt-1 text-text-1">{s.title}</h2>
      ) : full ? (
        <h2 className="mt-2 font-display text-[2.25rem] leading-[1.05] font-bold tracking-[-0.035em] text-text-1 [text-wrap:balance]">
          {s.title}
        </h2>
      ) : (
        <p className="type-title-1 mt-1 text-text-1 [text-wrap:balance]">{s.title}</p>
      )}
      <p
        className={cn(
          'type-body text-text-2 [text-wrap:balance]',
          full ? 'mt-3 text-[1.0625rem]' : 'mt-1',
        )}
      >
        {s.lead}
      </p>
      <div className={cn('w-full', full ? 'mt-6' : 'mt-4')}>{s.art}</div>
      <ul className="type-body mt-4 flex w-full flex-col gap-2.5 text-left text-text-2">
        {s.points.map((p) => (
          <li key={p.strong} className="flex gap-2.5">
            <Sparkles className="mt-1 size-4 shrink-0 text-lime" aria-hidden />
            <span>
              <strong className="font-semibold text-text-1">{p.strong}</strong> {p.text}
            </span>
          </li>
        ))}
      </ul>
      <p className="type-footnote mt-3 w-full text-left text-text-2" data-release-plan>
        {s.plan}
      </p>
    </div>
  );
}
