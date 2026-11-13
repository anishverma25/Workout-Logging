import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Sparkles } from 'lucide-react';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { cn } from '@/lib/cn';
import { RELEASE_STEPS, type ReleaseStep } from './whatsNewContent';
import { seenRelease, markReleaseSeen, RELEASE_ID } from './whatsNewStore';

/**
 * Shown once per release when the app opens, to everyone. This release (November 2026) is the
 * Macrotrophy Brain, the largest so far, so it is a full walkthrough: one part per step, each
 * with a drawing, what it does, who gets it and where it lives. The same content stays on the
 * "What is new" page. Never over a running workout, setup or a group.
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
  const close = () => {
    markReleaseSeen();
    setOpen(false);
  };
  const go = (to: string) => {
    close();
    navigate(to);
  };
  const last = RELEASE_STEPS.length - 1;
  // Each step starts at its top, even if the last one was scrolled on a small screen.
  const toStep = (n: number) => {
    setStep(n);
    document.querySelector('[data-release]')?.closest('[data-sheet-body]')?.scrollTo(0, 0);
  };
  const s = RELEASE_STEPS[step]!;
  return (
    <BottomSheet
      open={open && !busy}
      onClose={close}
      title="New in Macrotrophy"
      hideHeader
      tall
      footer={
        <div>
          <div className="flex items-center justify-center gap-1.5" aria-hidden>
            {RELEASE_STEPS.map((x, i) => (
              <span
                key={x.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-5 bg-lime' : 'w-1.5 bg-fill',
                )}
              />
            ))}
          </div>
          <p className="sr-only">
            Step {step + 1} of {RELEASE_STEPS.length}
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
              <PrimaryButton block data-autofocus onClick={() => go(s.where.to)} data-release-open>
                {s.where.label}
              </PrimaryButton>
            )}
            <SecondaryButton
              block
              onClick={
                step === 0 ? close : step === last ? () => go('/whats-new') : () => toStep(step - 1)
              }
              data-release-second
            >
              {step === 0 ? 'Later' : step === last ? 'Read it all again' : 'Back'}
            </SecondaryButton>
          </div>
        </div>
      }
    >
      <div data-release={RELEASE_ID} data-release-step={step + 1}>
        <ReleaseStepView step={s} />
      </div>
    </BottomSheet>
  );
}

/** One part of the release: drawing, what it does, who gets it. */
export function ReleaseStepView({ step: s, page = false }: { step: ReleaseStep; page?: boolean }) {
  return (
    <div
      className={cn('flex flex-col', page ? 'text-left' : 'items-center pt-1 text-center')}
      data-release-part={s.id}
    >
      <p className="type-subhead font-semibold text-lime">{s.kicker}</p>
      {page ? (
        <h2 className="type-title-1 mt-1 text-text-1">{s.title}</h2>
      ) : (
        <p className="type-title-1 mt-1 text-text-1 [text-wrap:balance]">{s.title}</p>
      )}
      <p className="type-body mt-1 text-text-2 [text-wrap:balance]">{s.lead}</p>
      <div className="mt-4 w-full">{s.art}</div>
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
