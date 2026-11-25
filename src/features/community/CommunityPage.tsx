import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Bell, MessageCircleQuestion, PenLine, Plus, UserRound } from 'lucide-react';
import { useRemote } from '@/app/community';
import { getFeed, getMe, TOPICS, type FeedMode, type Post, type Topic } from '@/app/forum';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  ActionMenu,
  EmptyState,
  ErrorState,
  SearchField,
  SegmentedControl,
} from '@/components/kit';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import {
  AuthorAvatar,
  CommunityMark,
  HubSwitch,
  PostCard,
  PostCardSkeleton,
  TopicIcon,
} from './parts';

/**
 * Community (November 2026): ask a question or share a journey, then a feed (For you, Latest,
 * Unanswered) with topic filters and search. Lives with the leaderboards under one switch. The
 * feed's controls stay pinned under the header while scrolling, and a compose button appears
 * once the two big actions have scrolled away.
 */
export function CommunityPage() {
  const location = useLocation();
  const fromHome = (location.state as { from?: string } | null)?.from === 'home';
  const me = useRemote(getMe, 'me');
  const [mode, setMode] = useState<FeedMode>('for_you');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const actions = useRef<HTMLDivElement>(null);
  const [showFab, setShowFab] = useState(false);
  const pin = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const el = actions.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => setShowFab(!e[0]?.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [me.data?.enabled]);

  // The feed controls get their frosted background only once they are pinned under the header.
  useEffect(() => {
    const el = pin.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => setStuck(!e[0]?.isIntersecting), {
      rootMargin: '-60px 0px 0px 0px',
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [me.data?.enabled]);

  const unread = me.data?.unread ?? 0;
  const paused = me.data ? !me.data.enabled : false;

  return (
    <>
      <PageHeader
        back={fromHome ? { to: '/', label: 'Home' } : { to: '/more', label: 'More' }}
        title="Community"
        subtitle="Ask, answer and share with lifters across India."
        actions={
          <>
            <Link
              to="/community/activity"
              aria-label={unread ? `Activity, ${unread} new` : 'Activity'}
              className="pressable tap-target relative inline-flex size-9 items-center justify-center rounded-full bg-fill text-text-1"
              data-activity-link
            >
              <Bell className="size-[1.125rem]" aria-hidden />
              {unread ? (
                <span
                  aria-hidden
                  className="type-caption tabular absolute -top-1 -right-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-lime px-1 font-bold text-on-lime ring-2 ring-bg"
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Link>
            <Link
              to="/community/mine"
              aria-label="Your posts, replies and karma"
              className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full bg-fill text-text-1"
              data-mine-link
            >
              <UserRound className="size-[1.125rem]" aria-hidden />
            </Link>
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-28" data-community-page>
        <HubSwitch current="community" />

        {paused ? (
          <EmptyState>Community is paused for a short while. Please check back soon.</EmptyState>
        ) : (
          <>
            <div ref={actions}>
              <ComposeBar
                username={me.data?.username ?? null}
                avatar={me.data?.avatar ?? null}
                verified={me.data?.verified ?? false}
              />
            </div>

            <SearchField
              label="Search Community"
              placeholder="Search questions and journeys"
              value={query}
              onChange={setQuery}
            />

            <div ref={pin} aria-hidden className="-mb-4 h-px" />
            <div
              className={cn(
                'sticky z-20 -mx-4 flex flex-col gap-3 px-4 pt-2 pb-3 transition-[background-color,box-shadow] duration-200 lg:mx-0 lg:px-0',
                stuck && 'material-bar shadow-[0_0.5px_0_var(--divider)]',
              )}
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 2.75rem)' }}
              data-feed-controls
            >
              {!debounced ? (
                <SegmentedControl
                  label="Feed"
                  value={mode}
                  block
                  tall
                  options={[
                    { value: 'for_you', label: 'For you' },
                    { value: 'latest', label: 'Latest' },
                    { value: 'unanswered', label: 'Unanswered' },
                  ]}
                  onChange={(m) => {
                    haptic('light');
                    setMode(m);
                  }}
                />
              ) : (
                <p className="type-subhead px-1 text-text-2">
                  Results for{' '}
                  <span className="font-semibold text-text-1">&ldquo;{debounced}&rdquo;</span>
                </p>
              )}
              <div
                className="relative -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
                role="group"
                aria-label="Topics"
              >
                <TopicChip selected={topic === null} onClick={() => setTopic(null)}>
                  All topics
                </TopicChip>
                {TOPICS.map((t) => (
                  <TopicChip
                    key={t.id}
                    selected={topic === t.id}
                    onClick={() => setTopic(topic === t.id ? null : t.id)}
                    icon={<TopicIcon topic={t.id} className="size-4" />}
                  >
                    {t.short}
                  </TopicChip>
                ))}
              </div>
            </div>

            <Feed
              key={`${mode}|${topic}|${debounced}`}
              mode={mode}
              topic={topic}
              query={debounced}
            />
          </>
        )}
      </div>
      {!paused ? <ComposeFab visible={showFab} /> : null}
    </>
  );
}

function TopicChip({
  selected,
  onClick,
  icon,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        haptic('light');
        onClick();
      }}
      className={cn(
        'pressable chrome type-subhead inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-semibold whitespace-nowrap transition-colors',
        selected ? 'bg-text-1 text-bg' : 'bg-fill text-text-1',
      )}
    >
      {icon ? (
        <span className={cn('inline-flex', selected ? 'text-bg' : 'text-text-2')}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

/** One place to start a post, like Reddit's "Create post": the field opens the composer. */
function ComposeBar({
  username,
  avatar,
  verified,
}: {
  username: string | null;
  avatar: string | null;
  verified: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface p-3" data-compose-bar>
      {username ? (
        <AuthorAvatar
          author={{ anonymous: false, username, avatar, verified, me: true }}
          size={36}
        />
      ) : (
        <CommunityMark size={36} />
      )}
      <Link
        to="/community/new?kind=question"
        className="pressable type-body flex h-10 min-w-0 flex-1 items-center rounded-full bg-surface-2 px-4 text-text-3"
        data-compose="question"
      >
        <span className="truncate">Ask or share something</span>
      </Link>
      <Link
        to="/community/new?kind=journey"
        aria-label="Share your journey"
        className="pressable flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime"
        data-compose="journey"
      >
        <PenLine className="size-[1.125rem]" aria-hidden />
      </Link>
    </div>
  );
}

/** Appears once the compose bar has scrolled away. */
function ComposeFab({ visible }: { visible: boolean }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="New post"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        onClick={() => {
          haptic('light');
          setOpen(true);
        }}
        className={cn(
          'fixed z-30 flex size-14 items-center justify-center rounded-full bg-lime text-on-lime shadow-[0_12px_32px_-10px_var(--lime),0_4px_14px_rgb(0_0_0/0.5)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.4,0.5,1)] active:scale-95',
          visible ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0',
        )}
        style={{
          right: 'max(1rem, env(safe-area-inset-right, 0px))',
          bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 1rem)',
        }}
        data-compose-fab
      >
        <Plus className="size-7" strokeWidth={2.4} aria-hidden />
      </button>
      <ActionMenu
        open={open}
        onClose={() => setOpen(false)}
        anchor={ref}
        label="New post"
        items={[
          {
            label: 'Ask a question',
            icon: <MessageCircleQuestion />,
            onSelect: () => navigate('/community/new?kind=question'),
          },
          {
            label: 'Share your journey',
            icon: <PenLine />,
            onSelect: () => navigate('/community/new?kind=journey'),
          },
        ]}
      />
    </>
  );
}

function Feed({ mode, topic, query }: { mode: FeedMode; topic: Topic | null; query: string }) {
  const [items, setItems] = useState<Post[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'more' | 'error'>('loading');
  const [error, setError] = useState('');
  const sentinel = useRef<HTMLDivElement>(null);

  // Fetches a page; state is only set once the server answers.
  const fetchPage = useCallback(
    async (cursor: string | null) => {
      try {
        const page = await getFeed({ mode: query ? 'for_you' : mode, topic, query, cursor });
        setItems((old) => {
          const seen = new Set(old.map((p) => p.id));
          return cursor ? [...old, ...page.items.filter((p) => !seen.has(p.id))] : page.items;
        });
        setNext(page.next);
        setState('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load Community.');
        setState('error');
      }
    },
    [mode, topic, query],
  );
  const load = useCallback(
    (cursor: string | null) => {
      setState(cursor ? 'more' : 'loading');
      void fetchPage(cursor);
    },
    [fetchPage],
  );

  useEffect(() => {
    // The feed is keyed by its filters, so it starts in the loading state; fetchPage sets
    // state only once the server answers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPage(null);
  }, [fetchPage]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || state !== 'ready' || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting) load(next);
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [next, state, load]);

  if (state === 'loading')
    return (
      <div className="flex flex-col gap-3" aria-busy aria-label="Loading posts">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  if (state === 'error' && !items.length)
    return <ErrorState title="Community did not load" message={error} onRetry={() => load(null)} />;
  if (!items.length)
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-10 text-center"
        data-feed-empty
      >
        <CommunityMark size={48} />
        <p className="type-headline text-text-1">
          {query
            ? 'No matches yet'
            : mode === 'unanswered'
              ? 'Every question has an answer'
              : 'Nothing here yet'}
        </p>
        <p className="type-subhead max-w-[30ch] text-text-2 [text-wrap:balance]">
          {query
            ? `Nobody has asked about “${query}”. Be the first.`
            : mode === 'unanswered'
              ? 'Come back later, or ask something yourself.'
              : 'Start the conversation with a question or your journey.'}
        </p>
        <Link
          to="/community/new?kind=question"
          className="pressable type-subhead mt-1 inline-flex h-10 items-center gap-1.5 rounded-full bg-lime px-4 font-semibold text-on-lime"
        >
          <MessageCircleQuestion className="size-4" aria-hidden /> Ask a question
        </Link>
      </div>
    );
  return (
    <div className="flex flex-col gap-3" data-feed>
      {items.map((p, i) => (
        <PostCard key={p.id} post={p} index={i} />
      ))}
      <div ref={sentinel} />
      {next ? (
        <button
          type="button"
          onClick={() => load(next)}
          disabled={state === 'more'}
          className="pressable type-subhead h-11 rounded-full bg-fill font-semibold text-text-1"
        >
          {state === 'more' ? 'Loading' : 'Show more'}
        </button>
      ) : (
        <p className="type-meta flex items-center justify-center gap-2 py-3 text-text-3">
          <span className="h-px w-8 bg-divider" aria-hidden /> You are all caught up
          <span className="h-px w-8 bg-divider" aria-hidden />
        </p>
      )}
    </div>
  );
}
