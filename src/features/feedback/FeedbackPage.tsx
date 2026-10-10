import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Check, Clock, MessageSquareHeart, Star } from 'lucide-react';
import { useAccount } from '@/app/account';
import { useEntitlement } from '@/app/entitlement';
import {
  FeedbackError,
  refreshFeedback,
  sendFeedback,
  useFeedbackList,
  type PendingFeedback,
} from '@/app/feedback';
import { PageHeader } from '@/app/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { MultiChips, TextArea } from '@/components/ui/Fields';
import {
  FEEDBACK_TAG_LABEL,
  FEEDBACK_TAGS,
  feedbackStatus,
  MESSAGE_MAX,
  RATING_LABEL,
  STATUS_LABEL,
  type FeedbackSource,
  type FeedbackTag,
  type SentFeedback,
} from '@/domain/feedback/feedback';
import { cn } from '@/lib/cn';

const SOURCES: FeedbackSource[] = ['more', 'prompt', 'error', 'pro'];

export function FeedbackPage() {
  const account = useAccount();
  const signedIn = account.status === 'signedIn';
  return (
    <>
      <PageHeader
        back={{ to: '/more', label: 'More' }}
        title="Feedback"
        subtitle="Tell us how Overload feels to use. Every message is read by the person building it."
      />
      <div className="flex max-w-2xl flex-col gap-8">
        {signedIn ? (
          <>
            <FeedbackForm />
            <History />
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-surface p-5">
            <span className="flex size-11 items-center justify-center rounded-[0.8rem] bg-[var(--tile-rose)] text-white">
              <MessageSquareHeart className="size-5" aria-hidden />
            </span>
            {account.status === 'unavailable' ? (
              <p className="text-muted">
                Feedback needs an account, and accounts are not set up in this version of the app.
              </p>
            ) : (
              <>
                <p className="text-muted">
                  Feedback is sent from your account, so we can reply and nobody else can post in
                  your name. Creating one is free.
                </p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink to="/sign-up?next=/feedback">Create a free account</ButtonLink>
                  <ButtonLink to="/sign-in?next=/feedback" variant="ghost">
                    Sign in
                  </ButtonLink>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function FeedbackForm() {
  const [params] = useSearchParams();
  const fromParam = params.get('from') as FeedbackSource | null;
  const source: FeedbackSource = fromParam && SOURCES.includes(fromParam) ? fromParam : 'more';
  const screen = params.get('screen');
  const founding = useEntitlement().plan === 'founding';
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<FeedbackTag[]>(() =>
    params.get('tag') === 'bug' ? ['bug'] : [],
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<'sent' | 'queued' | null>(null);

  if (done) {
    return (
      <section
        aria-live="polite"
        className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-surface p-6"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-ink">
          <Check className="size-6" strokeWidth={3} aria-hidden />
        </span>
        <h2 className="font-display text-[1.5rem] font-bold leading-tight">
          {founding ? 'Thank you, founding member' : 'Thank you'}
        </h2>
        <p className="text-muted">
          {done === 'sent'
            ? 'It went straight to the person building Overload. If you asked something, the reply shows up below.'
            : 'It is saved on this phone and will be sent as soon as you are back online.'}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setDone(null);
            setRating(null);
            setTags([]);
            setMessage('');
          }}
        >
          Send more feedback
        </Button>
      </section>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDone(await sendFeedback({ rating, tags, message }, source, screen));
    } catch (err) {
      setError(err instanceof FeedbackError ? err.message : 'Could not send it. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const left = MESSAGE_MAX - message.length;

  return (
    <form
      onSubmit={submit}
      aria-labelledby="feedback-form-title"
      className="flex flex-col gap-6 rounded-[var(--radius-card)] bg-surface p-5"
    >
      <div>
        <h2
          id="feedback-form-title"
          className="font-display text-[1.3rem] font-semibold leading-tight"
        >
          How has Overload been for you?
        </h2>
        <Stars value={rating} onChange={setRating} />
        <p className="mt-1.5 h-5 text-sm font-medium text-muted" aria-live="polite">
          {rating ? RATING_LABEL[rating] : ''}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">What is it about? (optional)</p>
        <MultiChips
          label="Feedback type"
          options={FEEDBACK_TAGS.map((t) => ({ value: t, label: FEEDBACK_TAG_LABEL[t] }))}
          value={tags}
          onChange={setTags}
        />
      </div>
      <TextArea
        label="What should we change or keep?"
        placeholder={
          tags.includes('bug')
            ? 'What did you tap, and what happened?'
            : 'The more specific, the better. What did you like, what got in the way?'
        }
        value={message}
        maxLength={MESSAGE_MAX}
        rows={5}
        onChange={(e) => setMessage(e.target.value)}
        hint={left < 200 ? `${left} characters left` : undefined}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? 'Sending...' : 'Send feedback'}
      </Button>
    </form>
  );
}

/** Five stars as a radio group: arrow keys move between them, as with any radio group. */
function Stars({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="mt-4 flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value !== null && n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}, ${RATING_LABEL[n]}`}
            tabIndex={value === n || (value === null && n === 1) ? 0 : -1}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, n + 1));
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(1, n - 1));
            }}
            className="tap-target flex size-12 items-center justify-center rounded-xl transition-transform active:scale-90"
          >
            <Star
              className={cn(
                'size-9 transition-colors',
                on ? 'fill-[var(--ring-3)] text-[var(--ring-3)]' : 'text-[var(--line-strong)]',
              )}
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

function History() {
  const list = useFeedbackList();
  useEffect(() => {
    void refreshFeedback();
  }, []);
  const pending = list.data?.pending ?? [];
  const sent = list.data?.sent ?? [];
  if (pending.length + sent.length === 0) return null;
  const items: (({ pending: true } & PendingFeedback) | ({ pending: false } & SentFeedback))[] = [
    ...pending.map((p) => ({ ...p, pending: true as const })),
    ...sent.map((s) => ({ ...s, pending: false as const })),
  ];
  return (
    <section aria-labelledby="feedback-history-title">
      <h2
        id="feedback-history-title"
        className="mb-2.5 font-display text-[1.3rem] font-semibold leading-tight tracking-tight"
      >
        Your feedback
      </h2>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => {
          const status = feedbackStatus(item);
          const when = new Date(item.pending ? item.createdAt : item.created_at);
          return (
            <li key={item.id} className="rounded-[var(--radius-card)] bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex flex-col gap-1">
                  {item.rating ? (
                    <span
                      className="flex gap-0.5"
                      role="img"
                      aria-label={`${item.rating} of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            'size-4',
                            n <= item.rating!
                              ? 'fill-[var(--ring-3)] text-[var(--ring-3)]'
                              : 'text-[var(--line-strong)]',
                          )}
                          aria-hidden
                        />
                      ))}
                    </span>
                  ) : null}
                  <span className="text-sm text-faint">
                    {when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {item.tags.length
                      ? ` · ${item.tags.map((t) => FEEDBACK_TAG_LABEL[t]).join(', ')}`
                      : ''}
                  </span>
                </span>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    status === 'waiting'
                      ? 'bg-warn-soft text-warn'
                      : status === 'sent'
                        ? 'bg-surface-2 text-muted'
                        : 'bg-accent-soft text-accent-text',
                  )}
                >
                  {status === 'waiting' ? (
                    <Clock className="size-3.5" aria-hidden />
                  ) : (
                    <Check className="size-3.5" aria-hidden />
                  )}
                  {STATUS_LABEL[status]}
                </span>
              </div>
              {item.message ? (
                <p className="mt-2 whitespace-pre-line break-words">{item.message}</p>
              ) : null}
              {!item.pending && item.reply ? (
                <div className="mt-3 rounded-[1rem] bg-surface-2 p-3.5">
                  <p className="text-xs font-semibold text-accent-text">Reply from Overload</p>
                  <p className="mt-1 whitespace-pre-line break-words text-[0.95rem]">
                    {item.reply}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
