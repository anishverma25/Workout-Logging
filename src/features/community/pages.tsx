import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  Award,
  Ban,
  CircleCheck,
  Crown,
  Flag,
  Lightbulb,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  VenetianMask,
} from 'lucide-react';
import { useRemote } from '@/app/community';
import {
  ago,
  block,
  claimReward,
  getActivity,
  getBlocks,
  getKarma,
  getMe,
  getMineReplies,
  getMinePosts,
  getProfile,
  markActivityRead,
  unblock,
  type ActivityItem,
  type Karma,
} from '@/app/forum';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  ConfirmSheet,
  EmptyState,
  ErrorState,
  InlineNotice,
  PrimaryButton,
  ProgressBar,
  SegmentedControl,
  Skeleton,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { AuthorAvatar, CommunityMark, PostCard, VerifiedBadge } from './parts';
import { COMMUNITY_REWARD_DAYS } from '@/domain/entitlement/limits';
import { ReportSheet } from './sheets';

const back = { to: '/community', label: 'Community' };

// ---------------------------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------------------------

export function ActivityPage() {
  const list = useRemote(getActivity, 'activity');
  useEffect(() => {
    if (list.data?.some((a) => !a.read)) void markActivityRead().catch(() => undefined);
  }, [list.data]);
  return (
    <>
      <PageHeader back={back} title="Activity" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 pb-12" data-activity-page>
        {list.loading ? <Skeleton height="12rem" radius="panel" /> : null}
        {list.error ? <ErrorState title="Activity did not load" message={list.error} /> : null}
        {list.data && !list.data.length ? (
          <EmptyState>Replies to your posts and the threads you follow show up here.</EmptyState>
        ) : null}
        {list.data?.length ? (
          <ul className="flex flex-col overflow-hidden rounded-card bg-surface">
            {list.data.map((a, i) => (
              <li key={a.id} className={cn(i > 0 && 'border-t-[0.5px] border-divider')}>
                <ActivityRow a={a} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

function ActivityRow({ a }: { a: ActivityItem }) {
  const icon =
    a.kind === 'best_answer' ? (
      <CircleCheck />
    ) : a.kind === 'karma_milestone' ? (
      <Award />
    ) : a.kind === 'reward' ? (
      <Crown />
    ) : a.kind === 'moderation' ? (
      <ShieldAlert />
    ) : (
      <MessageCircle />
    );
  const line =
    a.kind === 'reply'
      ? `${a.actor} replied to your post`
      : a.kind === 'followed_reply'
        ? `${a.actor} replied in a thread you follow`
        : a.kind === 'best_answer'
          ? 'Your answer was chosen as the best answer'
          : a.kind === 'karma_milestone'
            ? `You reached ${a.detail}`
            : a.kind === 'reward'
              ? a.detail === 'held'
                ? `Your ${COMMUNITY_REWARD_DAYS} days of Pro are saved for when your plan ends`
                : `Your ${COMMUNITY_REWARD_DAYS} days of Pro are active`
              : 'A moderation update';
  const to = a.kind === 'karma_milestone' || a.kind === 'reward' ? '/community/karma' : a.postId ? `/community/p/${a.postId}` : null;
  const inner = (
    <span className="flex items-start gap-3 px-4 py-3.5">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full [&>svg]:size-[1.125rem]',
          a.kind === 'moderation' ? 'bg-warning-dim text-warning' : 'bg-lime-dim text-lime',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-subhead block text-text-1">
          <span className={cn(!a.read && 'font-semibold')}>{line}</span>
        </span>
        {a.postTitle ? <span className="type-meta block truncate text-text-2">{a.postTitle}</span> : null}
        {a.detail && (a.kind === 'reply' || a.kind === 'followed_reply' || a.kind === 'moderation') ? (
          <span className="type-meta mt-0.5 line-clamp-2 block text-text-3">{a.detail}</span>
        ) : null}
      </span>
      <span className="type-meta shrink-0 text-text-3">{ago(a.createdAt)}</span>
      {!a.read ? <span aria-label="New" className="mt-2 size-2 shrink-0 rounded-full bg-lime" /> : null}
    </span>
  );
  return to ? (
    <Link to={to} className="pressable block" data-activity={a.kind}>
      {inner}
    </Link>
  ) : (
    <div data-activity={a.kind}>{inner}</div>
  );
}

// ---------------------------------------------------------------------------------------------
// Mine
// ---------------------------------------------------------------------------------------------

type MineTab = 'posts' | 'replies' | 'saved' | 'following';

export function MinePage() {
  const [tab, setTab] = useState<MineTab>('posts');
  const me = useRemote(getMe, 'me');
  return (
    <>
      <PageHeader back={back} title="You in Community" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-12" data-mine-page>
        {me.data ? (
          <div className="flex items-center gap-3 rounded-card bg-surface p-4">
            <AuthorAvatar
              author={
                me.data.username
                  ? { anonymous: false, username: me.data.username, avatar: me.data.avatar, verified: me.data.verified, me: true }
                  : { anonymous: true, label: 'You', me: true }
              }
              size={56}
            />
            <div className="min-w-0 flex-1">
              <p className="type-title flex items-center gap-1.5 text-text-1">
                <span className="truncate">{me.data.username ? `@${me.data.username}` : 'No username yet'}</span>
                {me.data.verified ? <VerifiedBadge size={18} /> : null}
              </p>
              <p className="type-subhead text-text-2">
                <span className="tabular font-semibold text-text-1">{me.data.karma}</span> karma
              </p>
            </div>
            {me.data.username ? (
              <Link to={`/community/u/${me.data.username}`} className="type-subhead font-medium text-lime">
                Public profile
              </Link>
            ) : null}
          </div>
        ) : null}
        <Link
          to="/community/karma"
          className="pressable chrome flex items-center gap-3 rounded-card bg-surface p-4"
          data-karma-link
        >
          <CommunityMark size={40} />
          <span className="min-w-0 flex-1">
            <span className="type-headline block text-text-1">Karma and rewards</span>
            <span className="type-meta block text-text-2">
              Earn {COMMUNITY_REWARD_DAYS} days of Pro by helping others
            </span>
          </span>
        </Link>
        <SegmentedControl
          label="Show"
          value={tab}
          block
          options={[
            { value: 'posts', label: 'Posts' },
            { value: 'replies', label: 'Replies' },
            { value: 'saved', label: 'Saved' },
            { value: 'following', label: 'Following' },
          ]}
          onChange={setTab}
        />
        {tab === 'replies' ? <MyReplies /> : <MyPosts key={tab} tab={tab} />}
        <BlockedList />
      </div>
    </>
  );
}

function MyPosts({ tab }: { tab: 'posts' | 'saved' | 'following' }) {
  const list = useRemote(() => getMinePosts(tab), `mine-${tab}`);
  if (list.loading) return <Skeleton height="10rem" radius="panel" />;
  if (list.error) return <ErrorState title="Did not load" message={list.error} />;
  if (!list.data?.length)
    return (
      <EmptyState>
        {tab === 'posts'
          ? 'Your questions and journeys show up here, anonymous ones too (only you see those).'
          : tab === 'saved'
            ? 'Save posts to read them later.'
            : 'You follow your own posts and the threads you reply to.'}
      </EmptyState>
    );
  return (
    <div className="flex flex-col gap-3">
      {list.data.map((p) => (
        <div key={p.id} className="flex flex-col gap-1.5">
          {tab === 'posts' && p.anonymous ? (
            <span className="type-meta inline-flex items-center gap-1.5 px-1 text-text-3">
              <VenetianMask className="size-3.5" aria-hidden /> Posted anonymously. Only you can see it is yours.
            </span>
          ) : null}
          <PostCard post={p} />
        </div>
      ))}
    </div>
  );
}

function MyReplies() {
  const list = useRemote(getMineReplies, 'mine-replies');
  if (list.loading) return <Skeleton height="10rem" radius="panel" />;
  if (list.error) return <ErrorState title="Did not load" message={list.error} />;
  if (!list.data?.length) return <EmptyState>Your replies show up here.</EmptyState>;
  return (
    <ul className="flex flex-col overflow-hidden rounded-card bg-surface">
      {list.data.map((r, i) => (
        <li key={r.id} className={cn(i > 0 && 'border-t-[0.5px] border-divider')}>
          <Link to={`/community/p/${r.postId}`} className="pressable block px-4 py-3.5">
            <span className="type-meta flex items-center gap-1.5 text-text-3">
              <span className="truncate">On &ldquo;{r.postTitle}&rdquo;</span>
              {r.anonymous ? (
                <span className="inline-flex shrink-0 items-center gap-1">
                  · <VenetianMask className="size-3.5" aria-hidden /> Anonymous
                </span>
              ) : null}
            </span>
            <span className="type-subhead mt-0.5 line-clamp-2 block text-text-1">{r.body}</span>
            <span className="type-meta mt-1 flex items-center gap-3 text-text-2">
              <span className="inline-flex items-center gap-1">
                <Lightbulb className="size-3.5" aria-hidden /> {r.helpful}
              </span>
              {r.best ? (
                <span className="inline-flex items-center gap-1 font-semibold text-lime">
                  <CircleCheck className="size-3.5" aria-hidden /> Best answer
                </span>
              ) : null}
              <span>{ago(r.createdAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function BlockedList() {
  const [version, setVersion] = useState(0);
  const list = useRemote(getBlocks, `blocks${version}`);
  const toast = useToast();
  if (!list.data?.length) return null;
  return (
    <section className="mt-4" aria-labelledby="blocked-title">
      <h2 id="blocked-title" className="type-section mb-2 text-text-1">
        Blocked
      </h2>
      <ul className="flex flex-col overflow-hidden rounded-card bg-surface">
        {list.data.map((b, i) => (
          <li key={b.id} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t-[0.5px] border-divider')}>
            <Ban className="size-4 shrink-0 text-text-3" aria-hidden />
            <span className="type-subhead min-w-0 flex-1 truncate text-text-1">{b.label}</span>
            <button
              type="button"
              className="type-subhead font-medium text-lime"
              onClick={async () => {
                try {
                  await unblock(b.id);
                  toast('Unblocked');
                  setVersion((v) => v + 1);
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Could not unblock.');
                }
              }}
            >
              Unblock
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Karma and the reward
// ---------------------------------------------------------------------------------------------

export function KarmaPage() {
  const [version, setVersion] = useState(0);
  const k = useRemote(getKarma, `karma${version}`);
  return (
    <>
      <PageHeader back={back} title="Karma" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-12" data-karma-page>
        {k.loading ? <Skeleton height="16rem" radius="panel" /> : null}
        {k.error ? <ErrorState title="Karma did not load" message={k.error} /> : null}
        {k.data ? <KarmaBody k={k.data} onClaimed={() => setVersion((v) => v + 1)} /> : null}
      </div>
    </>
  );
}

const SOURCE: Record<string, string> = {
  helpful_reply: 'Helpful answer',
  helpful_post: 'Helpful journey',
  best_answer: 'Best answer',
  owner: 'Adjustment',
  reversal: 'Taken back',
};

function KarmaBody({ k, onClaimed }: { k: Karma; onClaimed: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [clientId] = useState(() => crypto.randomUUID());
  const r = k.rules;
  const reqs: { label: string; have: number; need: number }[] = [
    { label: `Karma in the last ${r.window_days} days`, have: k.qualifying, need: r.karma },
    { label: 'Best answers', have: k.bestAnswers, need: r.best_answers },
    { label: 'Members you helped', have: k.helpfulVoters, need: r.helpful_voters },
    { label: 'Detailed answers', have: k.replies, need: r.replies },
    { label: 'Threads answered', have: k.replyThreads, need: r.reply_threads },
    { label: 'Days you helped', have: k.activeDays, need: r.active_days },
    { label: 'Days since joining', have: k.accountDays, need: r.account_days },
  ];
  const [now] = useState(() => Date.now());
  const claimedRecently = k.lastClaim && k.nextClaimAt && Date.parse(k.nextClaimAt) > now;
  const toGoal = Math.min(Math.max(0, k.qualifying), r.karma);
  return (
    <>
      <section
        className="relative flex flex-col items-center overflow-hidden rounded-panel bg-surface px-5 pt-7 pb-5 text-center"
        aria-labelledby="karma-total"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-lime/10 blur-3xl"
        />
        <CommunityMark size={52} className="relative" />
        <p className="type-meta relative mt-4 text-text-2">Your karma</p>
        <p id="karma-total" className="type-hero tabular relative text-text-1" data-karma-total>
          {k.lifetime.toLocaleString('en-IN')}
        </p>
        <div className="relative mt-4 w-full max-w-xs">
          <ProgressBar value={toGoal} max={r.karma} label="Karma towards the reward" />
          <p className="type-meta tabular mt-2 text-text-2">
            {toGoal >= r.karma
              ? 'Karma goal reached'
              : `${(r.karma - toGoal).toLocaleString('en-IN')} more toward ${r.reward_days} days of Pro`}
          </p>
        </div>
        <dl className="relative mt-5 grid w-full grid-cols-3 gap-2">
          {[
            ['+5', 'Helpful answer'],
            ['+20', 'Best answer'],
            ['+3', 'Helpful journey'],
          ].map(([v, l]) => (
            <div key={l} className="flex flex-col items-center rounded-tile bg-surface-2 px-2 pt-3 pb-2.5">
              <dd className="type-metric-sm tabular text-lime">{v}</dd>
              <dt className="type-meta mt-1 flex min-h-9 items-start leading-tight text-text-2">{l}</dt>
            </div>
          ))}
        </dl>
        <p className="type-meta relative mt-4 max-w-[34ch] text-text-3 [text-wrap:balance]">
          Points come only when members find your advice helpful. Only you see your exact number.
        </p>
      </section>

      <section className="rounded-panel bg-surface px-5 pt-5 pb-5" aria-labelledby="reward-title" data-reward>
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-gold text-on-gold shadow-[0_6px_20px_-8px_var(--gold)]"
          >
            <Crown className="size-[1.375rem]" />
          </span>
          <div className="min-w-0">
            <h2 id="reward-title" className="type-headline text-text-1">
              {r.reward_days} days of Macrotrophy Pro
            </h2>
            <p className="type-meta text-text-2">For steady, useful help to many members</p>
          </div>
        </div>
        {!k.rewardsOn ? (
          <InlineNotice tone="info" className="mt-4">
            New rewards are paused for a short while. Your progress is kept.
          </InlineNotice>
        ) : null}
        <ul className="mt-4 flex flex-col">
          {reqs.map((q, i) => {
            const done = q.have >= q.need;
            return (
              <li key={q.label} className={cn('py-3', i > 0 && 'border-t-[0.5px] border-divider')}>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-[1.125rem] shrink-0 items-center justify-center rounded-full',
                      done ? 'bg-lime text-on-lime' : 'border-[1.5px] border-text-3',
                    )}
                  >
                    {done ? <CircleCheck className="size-[1.125rem]" strokeWidth={2.5} /> : null}
                  </span>
                  <span className={cn('type-subhead min-w-0 flex-1 truncate', done ? 'text-text-1' : 'text-text-2')}>
                    {q.label}
                  </span>
                  <span className="type-subhead tabular shrink-0 text-text-3">
                    <span className="font-semibold text-text-1">{Math.min(q.have, q.need)}</span> / {q.need}
                  </span>
                </div>
                <div className="mt-2 pl-[1.875rem]">
                  <ProgressBar value={Math.min(q.have, q.need)} max={q.need} label={q.label} thickness={4} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="type-meta border-t-[0.5px] border-divider pt-4 text-text-3">
          Also needed: a confirmed email, the rules accepted, and no Community ban or mute in 90 days.
          One reward a year. On autopay, the days wait until your plan ends, so billing never changes.
        </p>
        {k.lastClaim ? (
          <InlineNotice tone="info" className="mt-4">
            {k.lastClaim.status === 'held'
              ? 'Your reward is saved and starts when your autopay plan ends.'
              : `Reward claimed ${new Date(k.lastClaim.claimedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}${k.lastClaim.proUntil ? `, Pro until ${new Date(k.lastClaim.proUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}.`}
            {claimedRecently && k.nextClaimAt
              ? ` Next one possible from ${new Date(k.nextClaimAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`
              : ''}
          </InlineNotice>
        ) : null}
        {k.eligible ? (
          <PrimaryButton
            block
            className="mt-4"
            loading={busy}
            icon={<Sparkles />}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await claimReward(clientId);
                toast(res.status === 'held' ? 'Saved for when your plan ends' : `${res.days} days of Pro added`);
                onClaimed();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not claim. Try again.');
                setBusy(false);
              }
            }}
            data-claim-reward
          >
            Claim {r.reward_days} days of Pro
          </PrimaryButton>
        ) : null}
      </section>

      {k.history.length ? (
        <section aria-labelledby="karma-history">
          <h2 id="karma-history" className="type-section mb-2 text-text-1">
            Recent karma
          </h2>
          <ul className="flex flex-col overflow-hidden rounded-card bg-surface">
            {k.history.map((h, i) => (
              <li key={i} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t-[0.5px] border-divider')}>
                <span className="type-subhead flex-1 text-text-1">{SOURCE[h.source] ?? 'Karma'}</span>
                <span className="type-meta text-text-3">{ago(h.createdAt)}</span>
                <span className={cn('type-headline tabular w-12 text-right', h.delta >= 0 ? 'text-lime' : 'text-text-2')}>
                  {h.delta > 0 ? `+${h.delta}` : h.delta}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="type-meta px-4 text-center text-text-3 [text-wrap:balance]">
        Karma is a thank-you from the community, not money and not a measure of expertise. Points
        from removed content or fake votes are taken back.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Public profile
// ---------------------------------------------------------------------------------------------

export function ProfilePage() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const p = useRemote(() => getProfile(username), `profile:${username}`);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  return (
    <>
      <PageHeader back={back} title="" compactTitle={`@${username}`} />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-12" data-profile-page={username}>
        {p.loading ? <Skeleton height="10rem" radius="panel" /> : null}
        {p.error ? <ErrorState title="Profile not available" message={p.error} /> : null}
        {p.data ? (
          <>
            <section className="flex flex-col items-center gap-2 rounded-panel bg-surface px-5 pt-6 pb-5 text-center">
              <AuthorAvatar
                author={{ anonymous: false, username: p.data.username, avatar: p.data.avatar, verified: p.data.verified, me: p.data.me }}
                size={56}
              />
              <h1 className="type-title flex items-center gap-1.5 text-text-1">
                @{p.data.username}
                {p.data.verified ? <VerifiedBadge size={22} /> : null}
              </h1>
              {p.data.verified ? (
                <p className="type-meta text-lime" data-verified-label>
                  Macrotrophy Verified
                </p>
              ) : null}
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {p.data.recognition ? (
                  <span className="type-meta inline-flex items-center gap-1 rounded-full bg-lime-dim px-2.5 py-1 font-semibold text-lime">
                    <Award className="size-3.5" aria-hidden />
                    {p.data.recognition === 'trusted' ? 'Trusted helper' : 'Helpful member'}
                  </span>
                ) : null}
                <span className="type-meta rounded-full bg-fill px-2.5 py-1 text-text-2">
                  {p.data.answers} {p.data.answers === 1 ? 'answer' : 'answers'}
                </span>
                {p.data.joined ? (
                  <span className="type-meta rounded-full bg-fill px-2.5 py-1 text-text-2">
                    Active since {new Date(p.data.joined).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                  </span>
                ) : null}
              </div>
              {p.data.me && p.data.karma !== null ? (
                <p className="type-meta mt-1 text-text-3">
                  Only you see your karma: <span className="tabular font-semibold text-text-1">{p.data.karma}</span>
                </p>
              ) : null}
              {!p.data.me ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReporting(true)}
                    className="pressable type-subhead inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3.5 text-text-1"
                  >
                    <Flag className="size-4" aria-hidden /> Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlocking(true)}
                    className="pressable type-subhead inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3.5 text-danger-text"
                  >
                    <Ban className="size-4" aria-hidden /> Block
                  </button>
                </div>
              ) : null}
            </section>
            {p.data.posts.length ? (
              <>
                <h2 className="type-section text-text-1">Posts</h2>
                <div className="flex flex-col gap-3">
                  {p.data.posts.map((x) => (
                    <PostCard key={x.id} post={x} />
                  ))}
                </div>
              </>
            ) : null}
            {p.data.replies.length ? (
              <>
                <h2 className="type-section text-text-1">Recent answers</h2>
                <ul className="flex flex-col overflow-hidden rounded-card bg-surface" data-profile-answers>
                  {p.data.replies.map((r, i) => (
                    <li key={r.id} className={cn(i > 0 && 'border-t-[0.5px] border-divider')}>
                      <Link to={`/community/p/${r.postId}`} className="pressable block px-4 py-3.5">
                        <span className="type-meta block truncate text-text-3">On &ldquo;{r.postTitle}&rdquo;</span>
                        <span className="type-subhead mt-0.5 line-clamp-2 block text-text-1">{r.body}</span>
                        <span className="type-meta mt-1 flex items-center gap-3 text-text-2">
                          <span className="inline-flex items-center gap-1">
                            <Lightbulb className="size-3.5" aria-hidden /> {r.helpful} helpful
                          </span>
                          {r.best ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-lime">
                              <CircleCheck className="size-3.5" aria-hidden /> Best answer
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {!p.data.posts.length && !p.data.replies.length ? (
              <EmptyState>Nothing shared with their username yet.</EmptyState>
            ) : null}
          </>
        ) : null}
      </div>
      {reporting ? (
        <ReportSheet
          target={{ kind: 'member', id: null, username }}
          onClose={() => setReporting(false)}
          onSent={() => {
            setReporting(false);
            toast('Thanks. We will check it.');
          }}
        />
      ) : null}
      <ConfirmSheet
        open={blocking}
        title={`Block @${username}?`}
        body="You will no longer see their posts and replies. They are not told."
        confirmLabel="Block"
        destructive
        onClose={() => setBlocking(false)}
        onConfirm={async () => {
          try {
            await block('member', null, username);
            toast('Blocked');
            navigate('/community', { replace: true });
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not block.');
          }
        }}
      />
    </>
  );
}
