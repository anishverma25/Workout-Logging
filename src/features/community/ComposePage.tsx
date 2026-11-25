import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertTriangle, ChevronLeft, ChevronRight, Dumbbell, ImagePlus, X } from 'lucide-react';
import { useRemote } from '@/app/community';
import {
  createPost,
  getMe,
  LIMITS,
  TOPICS,
  type Author,
  type NewPhoto,
  type PostKind,
  type Topic,
} from '@/app/forum';
import { PageHeader } from '@/app/layout/PageHeader';
import { InlineNotice, PrimaryButton, SegmentedControl, Skeleton, Switch } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { PhotoError, preparePhoto } from '@/lib/forumPhoto';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { WriteGate } from './gate';
import { AuthorAvatar, AuthorName, TopicIcon } from './parts';
import { useDockHeight } from './dock';

type CardChoice = 'workouts_30' | 'workouts_90' | 'workouts_365' | 'workouts_all' | null;

const CARD_CHOICES: { value: Exclude<CardChoice, null>; label: string }[] = [
  { value: 'workouts_30', label: '30 days' },
  { value: 'workouts_90', label: '90 days' },
  { value: 'workouts_365', label: '1 year' },
  { value: 'workouts_all', label: 'All time' },
];

interface Draft {
  title: string;
  body: string;
  topic: Topic | null;
  anonymous: boolean;
  card: CardChoice;
}

const draftKey = (kind: PostKind) => `overload.community.draft.${kind}`;

function loadDraft(kind: PostKind): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(kind));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function saveDraft(kind: PostKind, d: Draft | null) {
  try {
    if (d && (d.title.trim() || d.body.trim()))
      localStorage.setItem(draftKey(kind), JSON.stringify(d));
    else localStorage.removeItem(draftKey(kind));
  } catch {
    // Private mode: the draft lives only while the page is open.
  }
}

/** Ask a question or share a journey. Drafts stay on this phone until posted. */
export function ComposePage() {
  const [params, setParams] = useSearchParams();
  const kind: PostKind = params.get('kind') === 'journey' ? 'journey' : 'question';
  const [version, setVersion] = useState(0);
  const me = useRemote(getMe, `me${version}`);

  return (
    <>
      <PageHeader
        back={{ to: '/community', label: 'Community' }}
        title={kind === 'question' ? 'Ask a question' : 'Share your journey'}
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-36" data-compose-page={kind}>
        <SegmentedControl
          label="Post type"
          value={kind}
          block
          tall
          options={[
            { value: 'question', label: 'Question' },
            { value: 'journey', label: 'Journey' },
          ]}
          onChange={(k) => setParams({ kind: k }, { replace: true })}
        />
        {me.loading ? <Skeleton height="16rem" radius="panel" /> : null}
        {me.error ? <InlineNotice tone="warning">{me.error}</InlineNotice> : null}
        {me.data && me.data.problem ? (
          <WriteGate me={me.data} onChanged={() => setVersion((v) => v + 1)} />
        ) : null}
        {me.data && !me.data.problem ? (
          <Composer
            key={kind}
            kind={kind}
            username={me.data.username ?? 'you'}
            avatar={me.data.avatar}
            verified={me.data.verified}
            photosOn={me.data.photos}
          />
        ) : null}
      </div>
    </>
  );
}

function Composer({
  kind,
  username,
  avatar,
  verified,
  photosOn,
}: {
  kind: PostKind;
  username: string;
  avatar: string | null;
  verified: boolean;
  photosOn: boolean;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const saved = useMemo(() => loadDraft(kind), [kind]);
  const [title, setTitle] = useState(saved?.title ?? '');
  const [body, setBody] = useState(saved?.body ?? '');
  const [topic, setTopic] = useState<Topic | null>(
    saved?.topic ?? (kind === 'journey' ? 'journeys' : null),
  );
  const [anonymous, setAnonymous] = useState(saved?.anonymous ?? false);
  const [card, setCard] = useState<CardChoice>(saved?.card ?? null);
  const [showCard, setShowCard] = useState(saved?.card != null);
  const [photos, setPhotos] = useState<NewPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientId] = useState(() => crypto.randomUUID());
  const file = useRef<HTMLInputElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  useDockHeight(dock);
  const max = kind === 'journey' ? LIMITS.journey : LIMITS.question;

  useEffect(() => {
    const t = setTimeout(() => saveDraft(kind, { title, body, topic, anonymous, card }), 400);
    return () => clearTimeout(t);
  }, [kind, title, body, topic, anonymous, card]);

  const titleLen = title.trim().length;
  const titleOk = titleLen >= 3 && titleLen <= LIMITS.title;
  const ready = titleOk && topic !== null && body.length <= max && !preparing;
  const revealing = anonymous && (photos.length > 0 || card !== null);
  const missing = !titleOk
    ? 'Add a title to post'
    : topic === null
      ? 'Choose a topic to post'
      : null;

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setPreparing(true);
    try {
      const room = LIMITS.photos - photos.length;
      const out: NewPhoto[] = [];
      for (const f of Array.from(list).slice(0, room)) out.push(await preparePhoto(f));
      setPhotos((p) => [...p, ...out].slice(0, LIMITS.photos));
      if (list.length > room) setError(`Up to ${LIMITS.photos} photos.`);
    } catch (e) {
      setError(e instanceof PhotoError ? e.message : 'That photo could not be used.');
    } finally {
      setPreparing(false);
      if (file.current) file.current.value = '';
    }
  }

  async function submit() {
    if (!ready || !topic) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createPost({
        clientId,
        kind,
        topic,
        title: title.trim(),
        body: body.trim(),
        anonymous,
        photos,
        card,
      });
      haptic('success');
      saveDraft(kind, null);
      toast(kind === 'question' ? 'Question posted' : 'Journey shared');
      navigate(`/community/p/${id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post. Try again.');
      setBusy(false);
    }
  }

  const author: Author = anonymous
    ? { anonymous: true, label: 'Anonymous Lifter', me: false }
    : { anonymous: false, username, avatar, verified, me: false };

  const move = (i: number, by: -1 | 1) =>
    setPhotos((list) => {
      const next = [...list];
      [next[i + by], next[i]] = [next[i]!, next[i + by]!];
      return next;
    });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      data-composer
    >
      <div className="-mx-4 flex flex-col gap-2 px-4" data-topic-picker>
        <p className="type-headline px-0.5 text-text-1" id="topic-label">
          Topic
        </p>
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-labelledby="topic-label"
        >
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={topic === t.id}
              onClick={() => {
                haptic('light');
                setTopic(t.id);
              }}
              className={cn(
                'pressable chrome type-subhead inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 font-semibold whitespace-nowrap transition-colors',
                topic === t.id ? 'bg-lime text-on-lime' : 'bg-surface text-text-1',
              )}
            >
              <TopicIcon
                topic={t.id}
                className={cn('size-4', topic === t.id ? 'text-on-lime' : 'text-text-2')}
              />
              {t.short}
            </button>
          ))}
        </div>
      </div>

      {/* The post as members will see it: who, then the words, then what is attached. */}
      <section className="overflow-hidden rounded-panel bg-surface" aria-label="Your post">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3" data-identity-preview>
          <AuthorAvatar author={author} size={36} />
          <div className="min-w-0 flex-1">
            <p className="type-subhead flex min-w-0 items-center font-semibold">
              <AuthorName author={author} link={false} />
            </p>
            <p className="type-meta text-text-3">{anonymous ? 'Name hidden' : 'Your username'}</p>
          </div>
          <label className="flex shrink-0 items-center gap-2">
            <span className="type-meta font-medium text-text-2">Anonymous</span>
            <Switch
              checked={anonymous}
              onChange={setAnonymous}
              aria-label="Post anonymously"
              data-identity="anonymous"
            />
          </label>
        </div>
        <div className="border-t-[0.5px] border-divider px-4 pt-3">
          <label htmlFor="community-title" className="sr-only">
            {kind === 'question' ? 'Your question' : 'Title'}
          </label>
          <textarea
            id="community-title"
            value={title}
            maxLength={LIMITS.title}
            rows={1}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
            placeholder={
              kind === 'question' ? 'What do you want to know?' : 'Give your journey a title'
            }
            style={{ fieldSizing: 'content' } as React.CSSProperties}
            className="type-title block w-full resize-none bg-transparent text-text-1 outline-none placeholder:text-text-3"
            data-title
          />
          <label htmlFor="community-body" className="sr-only">
            {kind === 'question' ? 'Details' : 'Your story'}
          </label>
          <textarea
            id="community-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={max}
            rows={kind === 'journey' ? 7 : 5}
            placeholder={
              kind === 'question'
                ? 'Add details (optional). What have you tried? Your training, food or numbers help people answer.'
                : 'Tell your story. What you did, what worked, what you would do differently.'
            }
            style={{ fieldSizing: 'content' } as React.CSSProperties}
            className="type-body mt-2 block min-h-32 w-full resize-none bg-transparent text-[1rem] leading-[1.5] text-text-1 outline-none placeholder:text-text-3"
            data-body
          />
        </div>

        {photos.length ? (
          <div className="grid grid-cols-4 gap-2 px-4 pt-1 pb-3">
            {photos.map((p, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-[0.75rem] bg-surface-2"
                data-photo-draft
              >
                <img src={p.thumb} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                  className="pressable absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
                >
                  <X className="size-4" aria-hidden />
                </button>
                {photos.length > 1 ? (
                  <div className="absolute inset-x-1 bottom-1 flex justify-between">
                    <button
                      type="button"
                      aria-label={`Move photo ${i + 1} earlier`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="pressable flex size-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-0"
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move photo ${i + 1} later`}
                      disabled={i === photos.length - 1}
                      onClick={() => move(i, 1)}
                      className="pressable flex size-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-0"
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {showCard ? (
          <div className="px-4 pb-3" data-card-picker>
            <div className="rounded-[0.875rem] bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="type-subhead flex items-center gap-2 font-semibold text-text-1">
                  <Dumbbell className="size-4 text-lime" aria-hidden /> Workout count
                </p>
                <button
                  type="button"
                  aria-label="Remove progress card"
                  onClick={() => {
                    setCard(null);
                    setShowCard(false);
                  }}
                  className="pressable flex size-7 items-center justify-center rounded-full text-text-3"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div
                className="mt-2.5 grid grid-cols-4 gap-1.5"
                role="radiogroup"
                aria-label="Period"
              >
                {CARD_CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={card === c.value}
                    onClick={() => setCard(c.value)}
                    className={cn(
                      'pressable type-meta h-9 rounded-[0.625rem] font-semibold',
                      card === c.value ? 'bg-lime text-on-lime' : 'bg-fill text-text-1',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="type-meta mt-2 text-text-3">
                Worked out by Macrotrophy from your synced logs. Nothing else is shared.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-1 border-t-[0.5px] border-divider px-2 py-2">
          {photosOn ? (
            <button
              type="button"
              onClick={() => file.current?.click()}
              disabled={preparing || photos.length >= LIMITS.photos}
              className="pressable type-subhead inline-flex h-10 items-center gap-2 rounded-full px-3 font-medium text-text-1 disabled:text-text-3"
              data-add-photo
            >
              <ImagePlus className="size-5 text-lime" aria-hidden />
              {preparing
                ? 'Preparing'
                : photos.length
                  ? `Photos ${photos.length}/${LIMITS.photos}`
                  : 'Photos'}
            </button>
          ) : null}
          {!showCard ? (
            <button
              type="button"
              onClick={() => {
                setShowCard(true);
                setCard((c) => c ?? 'workouts_90');
              }}
              className="pressable type-subhead inline-flex h-10 items-center gap-2 rounded-full px-3 font-medium text-text-1"
              data-add-card
            >
              <Dumbbell className="size-5 text-lime" aria-hidden />
              Progress card
            </button>
          ) : null}
          <span className="type-meta tabular ml-auto pr-2 text-text-3" aria-live="polite">
            {body.length > max - 300
              ? `${max - body.length} left`
              : titleLen > LIMITS.title - 20
                ? `${LIMITS.title - titleLen} left in title`
                : ''}
          </span>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void addFiles(e.target.files)}
          data-photo-input
        />
      </section>

      {revealing ? (
        <div
          className="-mt-2 flex items-start gap-2.5 rounded-[0.875rem] bg-warning-dim px-3.5 py-3 text-warning"
          role="note"
          data-reveal-warning
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="type-subhead">
            Your username will be hidden, but the photo or details you share may identify you.
          </span>
        </div>
      ) : null}

      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}

      <p className="type-meta text-text-3">
        {anonymous
          ? 'Anonymous hides you from members, not from Macrotrophy. The Community rules still apply.'
          : 'Only post photos of yourself. Location and camera details are removed before upload.'}
      </p>

      {/* Post stays within thumb reach while the page scrolls. */}
      <div
        ref={dock}
        className="material-bar fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] border-divider pb-safe lg:left-60"
        data-post-bar
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] py-2.5">
          <span className="type-meta min-w-0 flex-1 truncate text-text-2">
            {missing ?? (anonymous ? 'Posting as Anonymous Lifter' : `Posting as @${username}`)}
          </span>
          <PrimaryButton
            type="submit"
            compact
            disabled={!ready}
            loading={busy}
            className="min-w-32"
            data-post-submit
          >
            {kind === 'question' ? 'Post question' : 'Share journey'}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}
