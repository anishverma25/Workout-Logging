import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Ban,
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  CornerUpLeft,
  EyeOff,
  Flag,
  HandHeart,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  ArrowUp,
  Trash2,
  VenetianMask,
  X,
} from 'lucide-react';
import { CommunityError } from '@/app/community';
import {
  ago,
  block,
  chooseBest,
  createReply,
  deleteContent,
  editPost,
  editReply,
  getMe,
  getPost,
  LIMITS,
  react,
  setPostFlag,
  type Author,
  type Me,
  type PostDetail,
  type Reply,
  cleanUrl,
} from '@/app/forum';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  ActionMenu,
  ConfirmSheet,
  ErrorState,
  InlineNotice,
  Skeleton,
  type MenuItem,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { WriteGate } from './gate';
import {
  AuthorAvatar,
  AuthorName,
  CardPill,
  KindTag,
  Lightbox,
  PhotoGrid,
  TopicPill,
} from './parts';
import { useDockHeight } from './dock';
import { EditSheet, ReportSheet } from './sheets';

type Target = { kind: 'post' | 'reply' | 'media'; id: string };

export function PostPage() {
  const { postId = '' } = useParams();
  const [search] = useSearchParams();
  const focusReply = search.get('reply') === '1';
  const navigate = useNavigate();
  const toast = useToast();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<number | null>(null);
  const [reporting, setReporting] = useState<Target | null>(null);
  const [blocking, setBlocking] = useState<Target | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);
  const [editing, setEditing] = useState<{ kind: 'post' } | { kind: 'reply'; reply: Reply } | null>(null);
  const [quote, setQuote] = useState<Reply | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([getPost(postId), getMe()]);
      setPost(p);
      setMe(m);
      setError(null);
    } catch (e) {
      setError(e instanceof CommunityError ? e.message : 'Could not load this post.');
    }
  }, [postId]);

  useEffect(() => {
    // State is set only after the server answers (load awaits first).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error && !post)
    return (
      <>
        <PageHeader back={{ to: '/community', label: 'Community' }} title="Post" />
        <ErrorState title="This post is not available" message={error} onRetry={() => void load()} />
      </>
    );
  if (!post)
    return (
      <>
        <PageHeader back={{ to: '/community', label: 'Community' }} title="" compactTitle="Post" />
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <Skeleton height="12rem" radius="panel" />
          <Skeleton height="6rem" radius="panel" />
          <Skeleton height="6rem" radius="panel" />
        </div>
      </>
    );

  const canWrite = me !== null && me.problem === null;
  const toggle = async (fn: () => Promise<unknown>, undo: () => void) => {
    try {
      await fn();
    } catch (e) {
      undo();
      toast(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const postMenu: MenuItem[] = [
    post.following
      ? {
          label: 'Stop following',
          icon: <BellOff />,
          onSelect: () => {
            setPost({ ...post, following: false });
            void toggle(() => setPostFlag(post.id, 'follow', false), () => setPost({ ...post }));
          },
        }
      : {
          label: 'Follow this thread',
          icon: <Bell />,
          onSelect: () => {
            setPost({ ...post, following: true });
            void toggle(() => setPostFlag(post.id, 'follow', true), () => setPost({ ...post }));
          },
        },
    ...(post.mine
      ? [
          { label: 'Edit', icon: <Pencil />, onSelect: () => setEditing({ kind: 'post' }) },
          {
            label: 'Delete',
            icon: <Trash2 />,
            danger: true,
            onSelect: () => setDeleting({ kind: 'post', id: post.id }),
          },
        ]
      : [
          {
            label: 'Hide this post',
            icon: <EyeOff />,
            onSelect: async () => {
              try {
                await setPostFlag(post.id, 'hide', true);
                toast('Hidden. You will not see it again.');
                navigate('/community', { replace: true });
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not hide it.');
              }
            },
          },
          { label: 'Report', icon: <Flag />, onSelect: () => setReporting({ kind: 'post', id: post.id }) },
          {
            label: post.author.anonymous ? 'Block this anonymous author' : 'Block author',
            icon: <Ban />,
            danger: true,
            onSelect: () => setBlocking({ kind: 'post', id: post.id }),
          },
        ]),
  ];

  return (
    <>
      <PageHeader
        back={{ to: '/community', label: 'Community' }}
        title=""
        compactTitle={post.kind === 'question' ? 'Question' : 'Journey'}
        actions={
          <>
            <IconToggle
              label={post.saved ? 'Saved' : 'Save'}
              pressed={post.saved}
              onClick={() => {
                const was = post.saved;
                setPost({ ...post, saved: !was });
                void toggle(() => setPostFlag(post.id, 'save', !was), () => setPost({ ...post, saved: was }));
                toast(was ? 'Removed from saved' : 'Saved');
              }}
              data-save
            >
              {post.saved ? <BookmarkCheck /> : <Bookmark />}
            </IconToggle>
            <MenuButton label="Post options" items={postMenu} data-post-menu />
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-40" data-post-page={post.id}>
        <article className="flex flex-col gap-3.5 rounded-panel bg-surface p-5" aria-labelledby="post-title">
          <header className="flex items-center gap-3">
            <AuthorAvatar author={post.author} size={36} />
            <div className="min-w-0 flex-1">
              <p className="type-headline flex items-center">
                <AuthorName author={post.author} />
              </p>
              <p className="type-meta text-text-3">
                {ago(post.createdAt)}
                {post.edited ? ' · Edited' : ''}
              </p>
            </div>
            <KindTag kind={post.kind} />
          </header>
          {post.held ? (
            <InlineNotice tone="warning">
              Only you can see this while it is checked. It may be removed if it breaks the rules.
            </InlineNotice>
          ) : null}
          <h1 id="post-title" className="type-title break-words text-text-1" data-post-title>
            {post.title}
          </h1>
          {post.body ? (
            <p className="type-body break-words whitespace-pre-line text-text-1" data-post-body>
              <Linked text={post.body} />
            </p>
          ) : null}
          <PhotoGrid media={post.media} onOpen={setPhoto} />
          {post.card ? <CardPill card={post.card} /> : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <TopicPill topic={post.topic} />
            {post.answered ? (
              <span className="type-meta inline-flex h-6 items-center gap-1 rounded-full bg-lime-dim px-2.5 font-semibold text-lime">
                <CircleCheck className="size-3.5" aria-hidden /> Answered
              </span>
            ) : null}
          </div>
          {!post.mine ? (
            <div className="flex flex-wrap gap-2 border-t-[0.5px] border-divider pt-3">
              <Reaction
                active={post.mySupport}
                count={post.support}
                icon={<HandHeart />}
                label="Support"
                disabled={!canWrite}
                onClick={async () => {
                  const on = !post.mySupport;
                  setPost({ ...post, mySupport: on, support: post.support + (on ? 1 : -1) });
                  try {
                    const r = await react('post', post.id, 'support', on);
                    setPost((p) => (p ? { ...p, support: r.support } : p));
                  } catch (e) {
                    setPost({ ...post });
                    toast(e instanceof Error ? e.message : 'Could not save.');
                  }
                }}
                data-support
              />
              {post.kind === 'journey' ? (
                <Reaction
                  active={post.myHelpful}
                  count={post.helpful}
                  icon={<Lightbulb />}
                  label="Helpful"
                  disabled={!canWrite}
                  onClick={async () => {
                    const on = !post.myHelpful;
                    setPost({ ...post, myHelpful: on, helpful: post.helpful + (on ? 1 : -1) });
                    try {
                      const r = await react('post', post.id, 'helpful', on);
                      setPost((p) => (p ? { ...p, helpful: r.helpful } : p));
                    } catch (e) {
                      setPost({ ...post });
                      toast(e instanceof Error ? e.message : 'Could not save.');
                    }
                  }}
                  data-post-helpful
                />
              ) : null}
            </div>
          ) : (
            <p className="type-meta border-t-[0.5px] border-divider pt-3 text-text-3">
              {post.support} support{post.kind === 'journey' ? ` · ${post.helpful} helpful` : ''}
            </p>
          )}
        </article>

        <h2 className="type-section mt-2 text-text-1">
          {post.replyList.filter((r) => !r.deleted).length
            ? `${post.replyList.filter((r) => !r.deleted).length} ${post.replyList.filter((r) => !r.deleted).length === 1 ? 'reply' : 'replies'}`
            : 'Replies'}
        </h2>
        {post.kind === 'question' && post.mine && !post.answered && post.replyList.some((r) => !r.mine && !r.deleted) ? (
          <p className="type-meta -mt-2 text-text-3">
            When an answer helps you, mark it as the best answer. It tells others what worked.
          </p>
        ) : null}

        {post.replyList.length ? (
          <ol className="flex flex-col gap-2.5" data-replies>
            {post.replyList.map((r) => (
              <ReplyItem
                key={r.id}
                reply={r}
                post={post}
                canWrite={canWrite}
                onQuote={() => {
                  setQuote(r);
                  composer.current?.focus();
                }}
                onReport={() => setReporting({ kind: 'reply', id: r.id })}
                onBlock={() => setBlocking({ kind: 'reply', id: r.id })}
                onEdit={() => setEditing({ kind: 'reply', reply: r })}
                onDelete={() => setDeleting({ kind: 'reply', id: r.id })}
                onChanged={(next) =>
                  setPost((p) => (p ? { ...p, replyList: p.replyList.map((x) => (x.id === r.id ? next : x)) } : p))
                }
                onBest={async (on) => {
                  try {
                    await chooseBest(post.id, on ? r.id : null);
                    toast(on ? 'Marked as the best answer' : 'Best answer removed');
                    await load();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Could not save.');
                  }
                }}
              />
            ))}
          </ol>
        ) : (
          <p className="type-subhead rounded-card bg-surface px-4 py-6 text-center text-text-2">
            {post.kind === 'question' ? 'No answers yet. Know something useful? Share it.' : 'Be the first to cheer them on.'}
          </p>
        )}

        {me && me.problem ? (
          <WriteGate me={me} onChanged={() => void load()} />
        ) : me ? (
          <ReplyComposer
            ref={composer}
            me={me}
            postId={post.id}
            question={post.kind === 'question'}
            autoFocus={focusReply}
            startAnonymous={post.mine && post.author.anonymous}
            quote={quote}
            onClearQuote={() => setQuote(null)}
            onPosted={async () => {
              setQuote(null);
              await load();
              toast('Reply posted');
            }}
          />
        ) : null}
      </div>

      {photo !== null ? <Lightbox media={post.media} start={photo} onClose={() => setPhoto(null)} /> : null}
      {reporting ? (
        <ReportSheet
          target={reporting}
          onClose={() => setReporting(null)}
          onSent={() => {
            setReporting(null);
            toast('Thanks. We will check it.');
          }}
        />
      ) : null}
      <ConfirmSheet
        open={blocking !== null}
        title={post.author.anonymous && blocking?.kind === 'post' ? 'Block this anonymous author?' : 'Block this person?'}
        body={
          blocking && (blocking.kind === 'post' ? post.author.anonymous : post.replyList.find((x) => x.id === blocking.id)?.author.anonymous)
            ? 'You will no longer see anything they post anonymously. Who they are stays private, even from you.'
            : 'You will no longer see their posts and replies. They are not told.'
        }
        confirmLabel="Block"
        destructive
        onClose={() => setBlocking(null)}
        onConfirm={async () => {
          if (!blocking) return;
          try {
            await block(blocking.kind === 'media' ? 'post' : blocking.kind, blocking.id);
            setBlocking(null);
            toast('Blocked');
            if (blocking.kind === 'post') navigate('/community', { replace: true });
            else await load();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not block.');
          }
        }}
      />
      <ConfirmSheet
        open={deleting !== null}
        title={deleting?.kind === 'post' ? 'Delete this post?' : 'Delete this reply?'}
        body="This cannot be undone. Karma it earned is removed."
        confirmLabel="Delete"
        destructive
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting || deleting.kind === 'media') return;
          try {
            await deleteContent(deleting.kind, deleting.id);
            setDeleting(null);
            toast('Deleted');
            if (deleting.kind === 'post') navigate('/community', { replace: true });
            else await load();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not delete.');
          }
        }}
      />
      {editing ? (
        <EditSheet
          kind={editing.kind}
          initial={
            editing.kind === 'post'
              ? { title: post.title, body: post.body, topic: post.topic, postKind: post.kind }
              : { body: editing.reply.body }
          }
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            if (editing.kind === 'post') await editPost(post.id, v.title, v.body, v.topic);
            else await editReply(editing.reply.id, v.body);
            setEditing(null);
            toast('Saved');
            await load();
          }}
        />
      ) : null}
    </>
  );
}

function ReplyItem({
  reply: r,
  post,
  canWrite,
  onQuote,
  onReport,
  onBlock,
  onEdit,
  onDelete,
  onBest,
  onChanged,
}: {
  reply: Reply;
  post: PostDetail;
  canWrite: boolean;
  onQuote: () => void;
  onReport: () => void;
  onBlock: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onBest: (on: boolean) => void;
  onChanged: (r: Reply) => void;
}) {
  const toast = useToast();
  if (r.deleted)
    return (
      <li className="type-subhead rounded-card bg-surface px-4 py-3 text-text-3" data-reply={r.id}>
        This reply was deleted.
      </li>
    );
  const canBest = post.mine && post.kind === 'question' && !r.mine;
  const items: MenuItem[] = [
    ...(canWrite ? [{ label: 'Reply to this', icon: <CornerUpLeft />, onSelect: onQuote }] : []),
    ...(canBest
      ? [
          r.best
            ? { label: 'Remove best answer', icon: <CircleCheck />, onSelect: () => onBest(false) }
            : { label: 'Mark as best answer', icon: <CircleCheck />, onSelect: () => onBest(true) },
        ]
      : []),
    ...(r.mine
      ? [
          { label: 'Edit', icon: <Pencil />, onSelect: onEdit },
          { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: onDelete },
        ]
      : [
          { label: 'Report', icon: <Flag />, onSelect: onReport },
          {
            label: r.author.anonymous ? 'Block this anonymous author' : 'Block author',
            icon: <Ban />,
            danger: true,
            onSelect: onBlock,
          },
        ]),
  ];
  return (
    <li
      className={cn(
        'flex flex-col gap-2.5 rounded-card bg-surface p-4',
        r.best && 'ring-[1.5px] ring-lime ring-inset',
      )}
      data-reply={r.id}
    >
      {r.best ? (
        <span className="type-meta inline-flex w-fit items-center gap-1 rounded-full bg-lime px-2.5 py-1 font-bold text-on-lime" data-best>
          <CircleCheck className="size-3.5" aria-hidden /> Best answer
        </span>
      ) : null}
      <header className="flex items-center gap-2.5">
        <AuthorAvatar author={r.author} size={28} />
        <span className="type-subhead flex min-w-0 flex-1 items-center gap-1.5 font-semibold">
          <AuthorName author={r.author} />
          {r.isOp ? (
            <span className="type-meta shrink-0 rounded-full bg-fill px-2 py-px font-semibold text-text-2">Author</span>
          ) : null}
          <span className="shrink-0 font-normal text-text-3">
            · {ago(r.createdAt)}
            {r.edited ? ' · Edited' : ''}
          </span>
        </span>
        <MenuButton label="Reply options" items={items} small data-reply-menu />
      </header>
      {r.held ? (
        <p className="type-meta text-warning">Only you can see this while it is checked.</p>
      ) : null}
      {r.quote ? (
        <blockquote className="type-subhead border-l-2 border-lime/60 pl-3 text-text-2" data-quote>
          <span className="font-semibold text-text-1">{r.quote.label}</span>
          {r.quote.excerpt ? <span className="line-clamp-2">{r.quote.excerpt}</span> : <span> (removed)</span>}
        </blockquote>
      ) : null}
      <p className="type-body break-words whitespace-pre-line text-text-1">
        <Linked text={r.body} />
      </p>
      <div className="flex items-center gap-2">
        {r.mine ? (
          <span className="type-meta text-text-3">
            {r.helpful} {r.helpful === 1 ? 'person' : 'people'} found this helpful
          </span>
        ) : (
          <Reaction
            small
            active={r.myHelpful}
            count={r.helpful}
            icon={<Lightbulb />}
            label="Helpful"
            disabled={!canWrite}
            onClick={async () => {
              const on = !r.myHelpful;
              onChanged({ ...r, myHelpful: on, helpful: r.helpful + (on ? 1 : -1) });
              try {
                const res = await react('reply', r.id, 'helpful', on);
                onChanged({ ...r, myHelpful: on, helpful: res.helpful });
              } catch (e) {
                onChanged(r);
                toast(e instanceof Error ? e.message : 'Could not save.');
              }
            }}
            data-helpful
          />
        )}
        {canWrite ? (
          <button
            type="button"
            onClick={onQuote}
            className="pressable type-subhead inline-flex h-8 items-center gap-1 rounded-full px-3 font-medium text-text-2"
          >
            <CornerUpLeft className="size-4" aria-hidden /> Reply
          </button>
        ) : null}
        {canBest && !r.best ? (
          <button
            type="button"
            onClick={() => onBest(true)}
            className="pressable type-subhead ml-auto inline-flex h-8 items-center gap-1 rounded-full px-3 font-medium text-lime"
            data-mark-best
          >
            <CircleCheck className="size-4" aria-hidden /> Best answer
          </button>
        ) : null}
      </div>
    </li>
  );
}

function Reaction({
  active,
  count,
  icon,
  label,
  onClick,
  disabled,
  small,
  ...data
}: {
  active: boolean;
  count: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  small?: boolean;
  [data: `data-${string}`]: unknown;
}) {
  const [bump, setBump] = useState(0);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic('light');
        if (!active) setBump((b) => b + 1);
        onClick();
      }}
      disabled={disabled}
      className={cn(
        'pressable chrome type-subhead tabular inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors duration-200 disabled:opacity-50',
        small ? 'h-8 px-3' : 'h-9 px-3.5',
        active ? 'bg-lime text-on-lime' : 'bg-fill text-text-1',
      )}
      {...data}
    >
      <span
        key={bump}
        aria-hidden
        className={cn('inline-flex size-4 [&>svg]:size-4', bump > 0 && active && 'community-pop')}
      >
        {icon}
      </span>
      {label}
      <span className={cn('tabular', active ? 'text-on-lime/70' : 'text-text-2')}>{count}</span>
    </button>
  );
}

function IconToggle({
  label,
  pressed,
  onClick,
  children,
  ...data
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  [data: `data-${string}`]: unknown;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'pressable tap-target inline-flex size-9 items-center justify-center rounded-full bg-fill [&>svg]:size-[1.125rem]',
        pressed ? 'text-lime' : 'text-text-1',
      )}
      {...data}
    >
      {children}
    </button>
  );
}

function MenuButton({
  label,
  items,
  small,
  ...data
}: {
  label: string;
  items: MenuItem[];
  small?: boolean;
  [data: `data-${string}`]: unknown;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          'pressable tap-target inline-flex shrink-0 items-center justify-center rounded-full text-text-2',
          small ? 'size-8' : 'size-9 bg-fill text-text-1',
        )}
        {...data}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      <ActionMenu open={open} onClose={() => setOpen(false)} anchor={ref} label={label} items={items} />
    </>
  );
}

/** Text with plain https links made tappable (they open in a new tab, without referrer). */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(https:\/\/[^\s<>"]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https:\/\//.test(p) ? (
          <a
            key={i}
            href={cleanUrl(p)}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="break-all text-lime underline underline-offset-2"
          >
            {p.replace(/^https:\/\/(www\.)?/, '').slice(0, 48)}
            {p.length > 56 ? '…' : ''}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** The reply bar docked at the bottom of a thread, like a message field. Grows as you type. */
const ReplyComposer = function ReplyComposer({
  ref,
  me,
  postId,
  question,
  startAnonymous,
  autoFocus,
  quote,
  onClearQuote,
  onPosted,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  me: Me;
  postId: string;
  question: boolean;
  /** On your own anonymous post, replies start anonymous too, so a reply never unmasks you. */
  startAnonymous: boolean;
  autoFocus: boolean;
  quote: Reply | null;
  onClearQuote: () => void;
  onPosted: () => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(startAnonymous);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, ref]);
  const me_: Author = anonymous
    ? { anonymous: true, label: 'Anonymous', me: true }
    : { anonymous: false, username: me.username ?? 'you', avatar: me.avatar, verified: me.verified, me: true };
  const send = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createReply({ clientId, postId, body: body.trim(), anonymous, quote: quote?.id ?? null });
      haptic('medium');
      setBody('');
      setClientId(crypto.randomUUID());
      ref.current?.blur();
      await onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const left = LIMITS.reply - body.length;
  const dock = useRef<HTMLDivElement>(null);
  useDockHeight(dock);
  return (
    <div
      ref={dock}
      className="material-bar fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] border-divider pb-safe lg:left-60"
      data-reply-composer
    >
      <div className="mx-auto w-full max-w-2xl px-[max(1rem,env(safe-area-inset-left))] pt-2.5 pb-2.5">
        {quote ? (
          <div className="mb-2 flex items-center gap-2 rounded-[0.75rem] bg-surface-2 px-3 py-2">
            <CornerUpLeft className="size-4 shrink-0 text-lime" aria-hidden />
            <span className="type-meta min-w-0 flex-1 truncate text-text-2">
              Replying to{' '}
              <span className="font-semibold text-text-1">
                {quote.author.anonymous ? quote.author.label : `@${quote.author.username}`}
              </span>
              : {quote.body}
            </span>
            <button
              type="button"
              aria-label="Stop replying to this"
              onClick={onClearQuote}
              className="pressable flex size-7 shrink-0 items-center justify-center rounded-full text-text-3"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        {error ? <p className="type-meta mb-2 text-danger-text" role="alert">{error}</p> : null}
        <div className="flex items-end gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={anonymous}
            aria-label={anonymous ? 'Replying anonymously. Tap to use your username' : `Replying as @${me.username}. Tap to reply anonymously`}
            onClick={() => {
              haptic('light');
              setAnonymous((a) => !a);
            }}
            className="pressable relative mb-0.5 shrink-0 rounded-full"
            data-reply-anonymous
          >
            <AuthorAvatar author={me_} size={36} />
            <span
              aria-hidden
              className={cn(
                'absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full ring-2 ring-bg',
                anonymous ? 'bg-text-1 text-bg' : 'bg-fill text-text-2',
              )}
            >
              <VenetianMask className="size-2.5" />
            </span>
          </button>
          <div className="flex min-w-0 flex-1 items-end rounded-[1.25rem] bg-surface-2 py-1.5 pr-1.5 pl-3.5 ring-1 ring-border focus-within:ring-text-3">
            <label htmlFor="reply-body" className="sr-only">
              Your reply
            </label>
            <textarea
              ref={ref}
              id="reply-body"
              value={body}
              maxLength={LIMITS.reply}
              rows={1}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                anonymous ? 'Reply anonymously' : question ? 'Write an answer' : 'Add a reply'
              }
              style={{ fieldSizing: 'content' } as React.CSSProperties}
              className="block max-h-40 min-h-[1.5rem] w-full resize-none bg-transparent py-1 text-[1rem] leading-[1.4] text-text-1 outline-none placeholder:text-text-3"
              data-reply-body
            />
            <button
              type="button"
              aria-label="Post reply"
              disabled={!body.trim() || busy}
              onClick={() => void send()}
              className="pressable ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime transition-colors disabled:bg-fill disabled:text-text-3"
              data-send-reply
            >
              <ArrowUp className="size-[1.125rem]" strokeWidth={2.6} aria-hidden />
            </button>
          </div>
        </div>
        {anonymous || left < 200 ? (
          <p className="type-meta mt-1.5 flex justify-between gap-3 pl-11 text-text-3" aria-live="polite">
            <span>{anonymous ? 'Shown as Anonymous Lifter. Rules still apply.' : ''}</span>
            <span className="tabular">{left < 200 ? `${left} left` : ''}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
};
