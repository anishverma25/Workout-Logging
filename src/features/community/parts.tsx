import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  CircleCheck,
  HandHeart,
  Lightbulb,
  MessageCircle,
  VenetianMask,
  X,
  Images,
  Dumbbell,
  Salad,
  PersonStanding,
  Sprout,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import {
  ago,
  getPhoto,
  topicLabel,
  type Author,
  type Media,
  type Post,
  type ProgressCard,
} from '@/app/forum';
import { BottomSheet, SegmentedControl } from '@/components/kit';
import { ProfileAvatar } from '@/features/profile/ProfileAvatar';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------------------------
// Brand marks
// ---------------------------------------------------------------------------------------------

/** A 12-point seal, the outline of the Macrotrophy Verified badge. */
const SEAL = (() => {
  const points = 12;
  const outer = 11.6;
  const inner = 10.1;
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
})();

/**
 * Macrotrophy Verified: a lime seal with a check. Means "officially recognised by Macrotrophy",
 * never a certificate of expertise. Never drawn on anonymous content.
 */
export function VerifiedBadge({
  size = 16,
  className,
  interactive = true,
}: {
  size?: number;
  className?: string;
  interactive?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const [open, setOpen] = useState(false);
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="block shrink-0 drop-shadow-[0_0_6px_var(--lime-dim)]"
    >
      <defs>
        <linearGradient
          id={`vb-${id}`}
          x1="3"
          y1="2"
          x2="21"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--lime) 70%, white)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--lime)' }} />
          <stop
            offset="1"
            style={{ stopColor: 'color-mix(in srgb, var(--lime) 72%, var(--gold))' }}
          />
        </linearGradient>
      </defs>
      <path d={SEAL} fill={`url(#vb-${id})`} strokeLinejoin="round" />
      <path
        d="M7.6 12.3l3 3 5.9-6.3"
        fill="none"
        stroke="var(--on-lime)"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  if (!interactive)
    return (
      <span
        role="img"
        aria-label="Macrotrophy Verified"
        className={cn('inline-flex', className)}
        data-verified
      >
        {svg}
      </span>
    );
  return (
    <>
      <button
        type="button"
        aria-label="Macrotrophy Verified"
        className={cn('inline-flex shrink-0 items-center justify-center p-0.5 -m-0.5', className)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        data-verified
      >
        {svg}
      </button>
      {open ? <VerifiedSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function VerifiedSheet({ onClose }: { onClose: () => void }) {
  return (
    <BottomSheet open onClose={onClose} title="Macrotrophy Verified">
      <div className="flex flex-col items-center gap-3 pb-2 text-center" data-verified-sheet>
        <VerifiedBadge size={64} interactive={false} />
        <p className="type-body text-text-1">
          This account is officially recognised by Macrotrophy, for example a creator we work with.
        </p>
        <p className="type-subhead text-text-2">
          It is not a certificate of scientific or medical expertise. Judge advice on its evidence,
          whoever gives it.
        </p>
      </div>
    </BottomSheet>
  );
}

/** The Community mark: two speech bubbles, the front one holding a dumbbell. */
export function CommunityMark({ size = 40, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      className={cn('block shrink-0', className)}
    >
      <defs>
        <linearGradient
          id={`cm-${id}`}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--lime) 82%, white)' }} />
          <stop
            offset="1"
            style={{ stopColor: 'color-mix(in srgb, var(--lime) 78%, var(--gold))' }}
          />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#cm-${id})`} />
      <path
        d="M15.5 10.5h12a5.5 5.5 0 0 1 5.5 5.5v5.5a5.5 5.5 0 0 1-5.5 5.5H18l-4.6 3.6c-.5.4-1.2 0-1.2-.6V26.2A5.5 5.5 0 0 1 10 21.5V16a5.5 5.5 0 0 1 5.5-5.5z"
        fill="var(--on-lime)"
        opacity="0.28"
      />
      <path
        d="M22 18.5h12.5A5.5 5.5 0 0 1 40 24v6a5.5 5.5 0 0 1-3 4.9v3.5c0 .6-.7 1-1.2.6L31 35.5h-9a5.5 5.5 0 0 1-5.5-5.5v-6a5.5 5.5 0 0 1 5.5-5.5z"
        fill="var(--on-lime)"
      />
      <g fill={`url(#cm-${id})`}>
        <rect x="22.3" y="23.4" width="3.2" height="7.6" rx="1.2" />
        <rect x="31.2" y="23.4" width="3.2" height="7.6" rx="1.2" />
        <rect x="20.2" y="24.9" width="2.4" height="4.6" rx="1" />
        <rect x="34.1" y="24.9" width="2.4" height="4.6" rx="1" />
        <rect x="25" y="26.3" width="6.6" height="1.9" rx=".9" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------------

export function AuthorAvatar({ author, size = 36 }: { author: Author; size?: 28 | 36 | 56 }) {
  const dims = size === 28 ? 'size-7' : size === 36 ? 'size-9' : 'size-14';
  if (author.anonymous)
    return (
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-2 ring-1 ring-border',
          dims,
        )}
      >
        <VenetianMask
          className={size === 56 ? 'size-7' : size === 36 ? 'size-[1.125rem]' : 'size-4'}
        />
      </span>
    );
  return (
    <ProfileAvatar
      name={author.username.replace(/[._]+/g, ' ')}
      avatar={author.avatar}
      size={size === 28 ? 36 : size}
      className={cn(
        'bg-surface-3 ring-1 ring-border',
        size === 28 && 'size-7 text-[0.6875rem]',
        // Verified creators get a lime ring on their photo, on username content only.
        author.verified && 'ring-2 ring-lime/80 ring-offset-2 ring-offset-surface',
      )}
    />
  );
}

/** "@name ✓" (linked to their profile) or "Anonymous Lifter 2". */
export function AuthorName({
  author,
  link = true,
  className,
}: {
  author: Author;
  link?: boolean;
  className?: string;
}) {
  if (author.anonymous)
    return (
      <span
        className={cn('inline-flex min-w-0 items-center gap-1 text-text-1', className)}
        data-author-anon
      >
        <span className="truncate">{author.label}</span>
        {author.me ? <span className="type-meta shrink-0 text-text-3">(you)</span> : null}
      </span>
    );
  const inner = (
    <>
      <span className="truncate">@{author.username}</span>
      {author.verified ? <VerifiedBadge size={15} /> : null}
    </>
  );
  if (!link)
    return (
      <span
        className={cn('inline-flex min-w-0 items-center gap-1 text-text-1', className)}
        data-author
      >
        {inner}
      </span>
    );
  return (
    <Link
      to={`/community/u/${author.username}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex min-w-0 items-center gap-1 text-text-1 hover:underline',
        className,
      )}
      data-author={author.username}
    >
      {inner}
    </Link>
  );
}

// ---------------------------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------------------------

const TOPIC_ICON: Record<string, LucideIcon> = {
  training: Dumbbell,
  nutrition: Salad,
  technique: PersonStanding,
  beginner: Sprout,
  journeys: Trophy,
};

export function TopicIcon({ topic, className }: { topic: string; className?: string }) {
  const Icon = TOPIC_ICON[topic] ?? MessageCircle;
  return <Icon className={className} aria-hidden />;
}

export function KindTag({ kind }: { kind: Post['kind'] }) {
  return kind === 'question' ? (
    <span className="type-meta inline-flex h-6 shrink-0 items-center rounded-full bg-lime-dim px-2.5 font-semibold text-lime">
      Question
    </span>
  ) : (
    <span className="type-meta inline-flex h-6 shrink-0 items-center rounded-full bg-gold-dim px-2.5 font-semibold text-gold">
      Journey
    </span>
  );
}

export function TopicPill({ topic }: { topic: string }) {
  return (
    <span className="type-meta inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-fill px-2.5 font-medium text-text-2">
      <TopicIcon topic={topic} className="size-3.5" />
      {topicLabel(topic)}
    </span>
  );
}

export function CardPill({ card }: { card: ProgressCard }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[0.875rem] bg-gradient-to-br from-lime/12 to-transparent px-3.5 py-3 ring-1 ring-lime/15"
      data-progress-card
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-lime text-on-lime"
      >
        <Dumbbell className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-metric-sm tabular block text-text-1">
          {card.value.toLocaleString('en-IN')}
          <span className="type-subhead ml-1.5 font-medium text-text-2">
            {card.label.toLowerCase()}
          </span>
        </span>
        <span className="type-meta block text-text-3">
          From this member&rsquo;s Macrotrophy logs
        </span>
      </span>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  active,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        'type-subhead tabular inline-flex items-center gap-1.5',
        active ? 'text-lime' : 'text-text-2',
      )}
      aria-label={`${value} ${label}`}
    >
      <span aria-hidden className="inline-flex size-[1.125rem] [&>svg]:size-[1.125rem]">
        {icon}
      </span>
      <span aria-hidden>{value}</span>
    </span>
  );
}

/** A post in a list. The whole card opens the thread. */
export function PostCard({ post, index = 0 }: { post: Post; index?: number }) {
  const navigate = useNavigate();
  const thumb = post.media[0];
  const open = (focus?: boolean) => navigate(`/community/p/${post.id}${focus ? '?reply=1' : ''}`);
  const waiting = post.kind === 'question' && !post.answered && post.replies === 0 && !post.mine;
  return (
    <article
      className="community-rise relative flex cursor-pointer flex-col gap-3 rounded-card bg-surface p-4 transition-transform duration-150 active:scale-[0.985]"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
      onClick={() => open()}
      data-post-card={post.id}
      aria-labelledby={`t-${post.id}`}
    >
      <header className="flex items-center gap-3">
        <AuthorAvatar author={post.author} size={36} />
        <div className="min-w-0 flex-1">
          <p className="type-subhead flex min-w-0 items-center font-semibold">
            <AuthorName author={post.author} />
          </p>
          <p className="type-meta flex items-center gap-1 text-text-3">
            <TopicIcon topic={post.topic} className="size-3.5 shrink-0" />
            <span className="truncate">{topicLabel(post.topic)}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{ago(post.createdAt)}</span>
          </p>
        </div>
        <KindTag kind={post.kind} />
      </header>
      <div className="flex flex-col gap-1">
        <h3
          id={`t-${post.id}`}
          className="type-headline line-clamp-2 text-[1.0625rem] leading-snug text-text-1"
        >
          <Link
            to={`/community/p/${post.id}`}
            onClick={(e) => e.stopPropagation()}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-focus"
          >
            {post.title}
          </Link>
        </h3>
        {post.body ? (
          <p className="type-body line-clamp-3 whitespace-pre-line text-text-2">{post.body}</p>
        ) : null}
      </div>
      {thumb?.thumb ? (
        <div className="relative overflow-hidden rounded-[0.875rem] bg-surface-2">
          <img
            src={thumb.thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="block max-h-72 w-full object-cover"
            style={{ aspectRatio: `${Math.max(0.8, Math.min(1.9, thumb.w / thumb.h))}` }}
          />
          {post.photoCount > 1 ? (
            <span className="type-meta absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 font-semibold text-white backdrop-blur-md">
              <Images className="size-3.5" aria-hidden />+{post.photoCount - 1}
            </span>
          ) : null}
        </div>
      ) : null}
      {post.card ? <CardPill card={post.card} /> : null}
      <footer className="relative flex min-h-8 items-center gap-5">
        <Stat
          icon={<MessageCircle />}
          value={post.replies}
          label={post.replies === 1 ? 'reply' : 'replies'}
        />
        {post.kind === 'journey' ? (
          <Stat icon={<HandHeart />} value={post.support} label="support" active={post.mySupport} />
        ) : null}
        {post.helpful ? (
          <Stat icon={<Lightbulb />} value={post.helpful} label="helpful" active={post.myHelpful} />
        ) : null}
        <span className="ml-auto">
          {post.held ? (
            <span className="type-meta font-semibold text-warning">Under review</span>
          ) : post.answered ? (
            <span className="type-meta inline-flex h-7 items-center gap-1 rounded-full bg-lime-dim px-2.5 font-semibold text-lime">
              <CircleCheck className="size-3.5" aria-hidden /> Answered
            </span>
          ) : waiting ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                open(true);
              }}
              className="pressable type-meta relative z-10 inline-flex h-7 items-center gap-1 rounded-full px-3 font-semibold text-lime ring-1 ring-lime/40"
              data-answer-cta
            >
              Answer first
            </button>
          ) : null}
        </span>
      </footer>
    </article>
  );
}

/** A post card while the feed loads. */
export function PostCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-hidden>
      <div className="flex items-center gap-3">
        <span className="size-9 animate-pulse rounded-full bg-surface-2" />
        <span className="flex flex-1 flex-col gap-1.5">
          <span className="h-3 w-28 animate-pulse rounded-full bg-surface-2" />
          <span className="h-2.5 w-20 animate-pulse rounded-full bg-surface-2" />
        </span>
      </div>
      <span className="h-4 w-4/5 animate-pulse rounded-full bg-surface-2" />
      <span className="h-3 w-full animate-pulse rounded-full bg-surface-2" />
      <span className="h-3 w-2/3 animate-pulse rounded-full bg-surface-2" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------------------------

export function PhotoGrid({ media, onOpen }: { media: Media[]; onOpen: (i: number) => void }) {
  if (!media.length) return null;
  const one = media.length === 1;
  return (
    <div
      className={cn(
        'grid gap-1.5 overflow-hidden rounded-tile',
        one ? 'grid-cols-1' : 'grid-cols-2',
      )}
      data-photos
    >
      {media.map((m, i) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpen(i)}
          className={cn(
            'pressable relative block overflow-hidden bg-surface-2',
            media.length === 3 && i === 0 && 'row-span-2',
          )}
          aria-label={`Open photo ${i + 1} of ${media.length}`}
        >
          {m.thumb ? (
            <img
              src={m.thumb}
              alt=""
              loading="lazy"
              decoding="async"
              className="block h-full w-full object-cover"
              style={{ aspectRatio: one ? `${Math.max(0.75, Math.min(1.9, m.w / m.h))}` : '1' }}
            />
          ) : null}
          {m.held ? (
            <span className="type-caption absolute inset-x-2 bottom-2 rounded-full bg-black/60 px-2 py-1 text-white">
              Under review
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Full-size photos, fetched one at a time, on black. */
export function Lightbox({
  media,
  start,
  onClose,
}: {
  media: Media[];
  start: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const [full, setFull] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDialogElement>(null);
  const m = media[index];
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    if (!m || full[m.id]) return;
    let live = true;
    getPhoto(m.id).then(
      (url) => {
        if (live && url) setFull((f) => ({ ...f, [m.id]: url }));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [m, full]);
  if (!m) return null;
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
      aria-label="Photo"
      data-lightbox
    >
      <div className="relative flex h-full w-full items-center justify-center">
        <img
          src={full[m.id] ?? m.thumb ?? ''}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pressable absolute flex size-11 items-center justify-center rounded-full bg-white/15 backdrop-blur"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
          }}
        >
          <X className="size-5" />
        </button>
        {media.length > 1 ? (
          <div
            className="absolute inset-x-0 flex items-center justify-center gap-2"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
          >
            {media.map((x, i) => (
              <button
                key={x.id}
                type="button"
                aria-label={`Photo ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn('size-2.5 rounded-full', i === index ? 'bg-white' : 'bg-white/35')}
              />
            ))}
          </div>
        ) : null}
        {media.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute inset-y-0 left-0 w-1/4"
              onClick={() => setIndex((i) => (i - 1 + media.length) % media.length)}
            />
            <button
              type="button"
              aria-label="Next photo"
              className="absolute inset-y-0 right-0 w-1/4"
              onClick={() => setIndex((i) => (i + 1) % media.length)}
            />
          </>
        ) : null}
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Leaderboards and Community, one place
// ---------------------------------------------------------------------------------------------

export function HubSwitch({ current }: { current: 'community' | 'leaderboards' }) {
  const navigate = useNavigate();
  return (
    <SegmentedControl
      label="Leaderboards and Community"
      value={current}
      block
      tall
      options={[
        { value: 'community', label: 'Community' },
        { value: 'leaderboards', label: 'Leaderboards' },
      ]}
      onChange={(v) => {
        if (v !== current)
          navigate(v === 'community' ? '/community' : '/groups', { replace: true });
      }}
    />
  );
}
