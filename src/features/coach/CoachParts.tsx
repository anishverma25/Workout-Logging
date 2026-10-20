import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { MessageCircle, Sparkles } from 'lucide-react';
import { useAccount } from '@/app/account';
import { CoachError, explain, setCoachConsent, useCoachStore, type CoachTopic } from '@/app/coach';
import { useFeature } from '@/app/entitlement';
import {
  BottomSheet,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  TextLink,
} from '@/components/kit';
import { cn } from '@/lib/cn';
import { ProLock } from '../pro/ProLock';
import { buildBrief, type BriefInput } from './brief';

/**
 * The AI coach in the app's screens: the Explain button on a card, its sheet, the one-time
 * consent and how answers are shown. Free accounts see the button too, with a Pro mark, and
 * tapping it explains that the coach is part of Pro.
 */

/** What a screen knows, so its Explain buttons can build their brief. */
const BriefContext = createContext<BriefInput | null>(null);

export function CoachBriefProvider({
  value,
  children,
}: {
  value: BriefInput;
  children: ReactNode;
}) {
  return <BriefContext.Provider value={value}>{children}</BriefContext.Provider>;
}

/** "Explain" next to a card title. Uses the screen's brief unless one is given. */
export function ExplainButton({
  topic,
  about,
  brief,
  className,
}: {
  topic: CoachTopic;
  /** What is being explained, for the sheet title and screen readers: "your rest times". */
  about: string;
  brief?: () => string;
  className?: string;
}) {
  const context = useContext(BriefContext);
  const account = useAccount();
  const pro = useFeature('ai_coach');
  const [open, setOpen] = useState(false);
  if (account.status === 'unavailable') return null;
  const getBrief = brief ?? (context ? () => buildBrief(topic, context) : null);
  if (!getBrief) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Explain ${about} with the AI coach${pro ? '' : ' (Pro)'}`}
        className={cn(
          'pressable chrome tap-target type-caption inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 font-semibold text-text-1',
          className,
        )}
        data-coach-explain={topic}
      >
        <Sparkles className="size-3.5" aria-hidden />
        Explain
        {pro ? null : <span className="text-text-2">· Pro</span>}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="AI coach"
        subtitle={`About ${about}`}
      >
        {open ? <ExplainBody topic={topic} getBrief={getBrief} pro={pro} /> : null}
      </BottomSheet>
    </>
  );
}

function ExplainBody({
  topic,
  getBrief,
  pro,
}: {
  topic: CoachTopic;
  getBrief: () => string;
  pro: boolean;
}) {
  const store = useCoachStore();
  if (!pro) return <CoachLock lead="The AI coach explains this card with your own numbers." />;
  if (!store.consent) return <CoachConsent />;
  return <ExplainAnswer topic={topic} getBrief={getBrief} />;
}

function ExplainAnswer({ topic, getBrief }: { topic: CoachTopic; getBrief: () => string }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'done'; text: string } | { status: 'error'; message: string }
  >({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);
  const mounted = useRef(false);
  const briefRef = useRef(getBrief);
  useLayoutEffect(() => {
    briefRef.current = getBrief;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Once per attempt, even when React runs effects twice in development.
    if (started.current === attempt) return;
    started.current = attempt;
    explain(topic, briefRef.current())
      .then((text) => {
        if (mounted.current) setState({ status: 'done', text });
      })
      .catch((err: unknown) => {
        if (mounted.current)
          setState({
            status: 'error',
            message: err instanceof CoachError ? err.message : 'Something went wrong. Try again.',
          });
      });
  }, [attempt, topic]);

  if (state.status === 'loading') return <Thinking />;
  if (state.status === 'error')
    return (
      <ErrorState
        title="No answer this time"
        message={state.message}
        onRetry={() => {
          setState({ status: 'loading' });
          setAttempt((a) => a + 1);
        }}
      />
    );
  return (
    <div>
      <CoachText text={state.text} />
      <CoachFootnote />
      <TextLink to="/coach" small chevron className="mt-3" icon={<MessageCircle />}>
        Ask a follow-up
      </TextLink>
    </div>
  );
}

export function Thinking({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} role="status" aria-live="polite">
      <span className="sr-only">The coach is thinking</span>
      <Skeleton height={16} width="92%" radius="full" />
      <Skeleton height={16} width="80%" radius="full" />
      <Skeleton height={16} width="64%" radius="full" />
    </div>
  );
}

/** Answers are plain text: paragraphs, and lines starting "- " as a list. */
export function CoachText({ text, className }: { text: string; className?: string }) {
  const blocks: ({ kind: 'p'; text: string } | { kind: 'ul'; items: string[] })[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const item = /^[-*•]\s+(.*)$/.exec(line) ?? /^\d+[.)]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (item) {
      if (last?.kind === 'ul') last.items.push(item[1]!);
      else blocks.push({ kind: 'ul', items: [item[1]!] });
    } else blocks.push({ kind: 'p', text: line });
  }
  return (
    <div className={cn('type-body flex flex-col gap-2 text-text-1', className)}>
      {blocks.map((b, i) =>
        b.kind === 'p' ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
            {b.items.map((t, j) => (
              <li key={j}>{t}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export function CoachFootnote({ className }: { className?: string }) {
  return (
    <p className={cn('type-caption mt-4 text-text-2', className)}>
      Written by AI from your logged numbers. It can be wrong, so check it against your data, and
      see a professional for pain or injury.
    </p>
  );
}

/** Asked once per account on this phone, before anything is sent. */
export function CoachConsent({ onDone }: { onDone?: () => void }) {
  return (
    <div data-coach-consent>
      <h3 className="type-headline text-text-1">Turn on the AI coach</h3>
      <ul className="type-meta mt-3 flex list-disc flex-col gap-2 pl-5 text-text-2">
        <li>
          To answer, the numbers it needs (your sets, records, body weight and goals) and your
          question are sent to a third-party AI service. Your name and email are never sent.
        </li>
        <li>
          That service may keep what is sent and use it to improve its products, so do not type
          anything private into your questions.
        </li>
        <li>
          Nothing is kept on our servers. Your chat stays on this phone for 7 days, and you can turn
          the coach off or clear it in Settings.
        </li>
      </ul>
      <div className="mt-5 flex flex-col gap-2 tab:flex-row">
        <PrimaryButton
          compact
          onClick={() => {
            setCoachConsent(true);
            onDone?.();
          }}
        >
          Turn on
        </PrimaryButton>
        <SecondaryButton compact onClick={() => onDone?.()}>
          Not now
        </SecondaryButton>
      </div>
      <TextLink to="/privacy" small className="mt-3">
        Privacy policy
      </TextLink>
    </div>
  );
}

export function CoachLock({ lead }: { lead: string }) {
  return <ProLock feature="ai_coach" lead={lead} />;
}

/** A row that opens the coach, with a Pro mark for free accounts. */
export function AskCoachRow({ className }: { className?: string }) {
  const account = useAccount();
  const pro = useFeature('ai_coach');
  if (account.status === 'unavailable') return null;
  return (
    <Link
      to="/coach"
      className={cn(
        'pressable chrome flex min-h-14 items-center gap-3 rounded-panel border border-border bg-surface px-4 py-2.5',
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface-2 text-text-2">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-headline flex items-center gap-2 text-text-1">
          Ask your coach
          {pro ? null : (
            <span className="type-caption rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-text-2">
              Pro
            </span>
          )}
        </span>
        <span className="type-meta block text-text-2">
          AI answers from your own numbers, in any language
        </span>
      </span>
    </Link>
  );
}
