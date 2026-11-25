import { supabase } from '@/data/sync/supabase';
import { CommunityError, isSafeAvatar } from '@/app/community';

/**
 * Community (November 2026, migration 0040, docs/community.md): questions and journeys,
 * replies, Helpful and Support, optional anonymity, photos, karma and reports. Everything goes
 * through the server's forum_* functions; the phone never sees who wrote anonymous content.
 * Online only: nothing here touches the workout database or the sync outbox.
 */

export type PostKind = 'question' | 'journey';
export type FeedMode = 'for_you' | 'latest' | 'unanswered';
export type Topic = 'training' | 'nutrition' | 'technique' | 'beginner' | 'journeys';

export const TOPICS: { id: Topic; label: string; short: string }[] = [
  { id: 'training', label: 'Training and muscle gain', short: 'Training' },
  { id: 'nutrition', label: 'Nutrition and fat loss', short: 'Nutrition' },
  { id: 'technique', label: 'Technique and recovery', short: 'Technique' },
  { id: 'beginner', label: 'Beginner questions', short: 'Beginners' },
  { id: 'journeys', label: 'Journeys and achievements', short: 'Journeys' },
];
export const topicLabel = (t: string) => TOPICS.find((x) => x.id === t)?.short ?? 'Community';

export const LIMITS = { title: 120, question: 2000, journey: 3000, reply: 2000, photos: 4 } as const;

/** Who wrote something, as the server shows it. Anonymous authors carry a label only. */
export type Author =
  | { anonymous: true; label: string; me: boolean }
  | {
      anonymous: false;
      username: string;
      avatar: string | null;
      verified: boolean;
      me: boolean;
    };

export interface Media {
  id: string;
  thumb: string | null;
  w: number;
  h: number;
  held: boolean;
}

export interface ProgressCard {
  value: number;
  days: number | null;
  label: string;
}

export interface Post {
  id: string;
  kind: PostKind;
  topic: Topic;
  title: string;
  body: string;
  author: Author;
  held: boolean;
  card: ProgressCard | null;
  answered: boolean;
  bestReply: string | null;
  replies: number;
  helpful: number;
  support: number;
  createdAt: string;
  edited: boolean;
  mine: boolean;
  myHelpful: boolean;
  mySupport: boolean;
  saved: boolean;
  following: boolean;
  photoCount: number;
  media: Media[];
  /** Only in Mine, for your own posts. */
  anonymous?: boolean;
}

export interface Reply {
  id: string;
  body: string;
  deleted: boolean;
  held: boolean;
  author: Author;
  isOp: boolean;
  best: boolean;
  helpful: number;
  myHelpful: boolean;
  mine: boolean;
  edited: boolean;
  createdAt: string;
  quote: { id: string; label: string; excerpt: string } | null;
}

export interface PostDetail extends Post {
  replyList: Reply[];
}

export type WriteProblem =
  | 'signed_out'
  | 'paused'
  | 'banned'
  | 'muted'
  | 'username'
  | 'rules'
  | 'minor'
  | null;

export interface Me {
  username: string | null;
  avatar: string | null;
  verified: boolean;
  rulesAccepted: boolean;
  problem: WriteProblem;
  mutedUntil: string | null;
  enabled: boolean;
  photos: boolean;
  rewards: boolean;
  unread: number;
  karma: number;
}

export interface ActivityItem {
  id: number;
  kind: 'reply' | 'followed_reply' | 'best_answer' | 'karma_milestone' | 'reward' | 'moderation';
  postId: string | null;
  postTitle: string | null;
  actor: string;
  detail: string;
  createdAt: string;
  read: boolean;
}

export interface Profile {
  username: string;
  avatar: string | null;
  verified: boolean;
  me: boolean;
  banned: boolean;
  joined: string | null;
  recognition: 'helpful' | 'trusted' | null;
  karma: number | null;
  answers: number;
  posts: Post[];
  replies: { id: string; postId: string; postTitle: string; body: string; helpful: number; best: boolean; createdAt: string }[];
}

export interface MyReply {
  id: string;
  postId: string;
  postTitle: string;
  body: string;
  anonymous: boolean;
  helpful: number;
  best: boolean;
  held: boolean;
  createdAt: string;
}

export interface RewardRules {
  karma: number;
  window_days: number;
  best_answers: number;
  helpful_voters: number;
  replies: number;
  reply_threads: number;
  active_days: number;
  account_days: number;
  reward_days: number;
}

export interface Karma {
  lifetime: number;
  qualifying: number;
  rules: RewardRules;
  bestAnswers: number;
  helpfulVoters: number;
  replies: number;
  replyThreads: number;
  activeDays: number;
  accountDays: number;
  confirmed: boolean;
  rulesAccepted: boolean;
  inGoodStanding: boolean;
  eligible: boolean;
  rewardsOn: boolean;
  lastClaim: { status: 'applied' | 'held' | 'revoked'; claimedAt: string; proUntil: string | null } | null;
  nextClaimAt: string | null;
  history: { delta: number; source: string; createdAt: string }[];
}

type Obj = Record<string, unknown>;
const str = (x: unknown) => (typeof x === 'string' ? x : '');
const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0);
const obj = (x: unknown): Obj => (x && typeof x === 'object' ? (x as Obj) : {});
const arr = (x: unknown): Obj[] => (Array.isArray(x) ? (x as Obj[]) : []);
const isJpeg = (x: unknown): x is string =>
  typeof x === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x);

export function parseAuthor(v: unknown): Author {
  const a = obj(v);
  if (a.anonymous !== false)
    return { anonymous: true, label: str(a.label) || 'Anonymous Lifter', me: a.me === true };
  return {
    anonymous: false,
    username: str(a.username) || 'member',
    avatar: isSafeAvatar(a.avatar) ? a.avatar : null,
    verified: a.verified === true,
    me: a.me === true,
  };
}

const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));

export function parsePost(v: unknown): Post {
  const p = obj(v);
  const card = obj(p.card);
  return {
    id: str(p.id),
    kind: p.kind === 'journey' ? 'journey' : 'question',
    topic: TOPIC_IDS.has(p.topic as Topic) ? (p.topic as Topic) : 'training',
    title: str(p.title),
    body: str(p.body),
    author: parseAuthor(p.author),
    held: p.status === 'held',
    card:
      p.card && typeof card.value === 'number'
        ? { value: card.value, days: typeof card.days === 'number' ? card.days : null, label: str(card.label) }
        : null,
    answered: p.answered === true,
    bestReply: typeof p.best_reply === 'string' ? p.best_reply : null,
    replies: num(p.replies),
    helpful: num(p.helpful),
    support: num(p.support),
    createdAt: str(p.created_at),
    edited: p.edited === true,
    mine: p.mine === true,
    myHelpful: p.my_helpful === true,
    mySupport: p.my_support === true,
    saved: p.saved === true,
    following: p.following === true,
    photoCount: num(p.photo_count),
    media: arr(p.media).map((m) => ({
      id: str(m.id),
      thumb: isJpeg(m.thumb) ? m.thumb : null,
      w: num(m.w) || 1,
      h: num(m.h) || 1,
      held: m.held === true,
    })),
    anonymous: typeof p.anonymous === 'boolean' ? p.anonymous : undefined,
  };
}

function parseReply(v: Obj): Reply {
  const q = v.quote ? obj(v.quote) : null;
  return {
    id: str(v.id),
    body: str(v.body),
    deleted: v.deleted === true,
    held: v.held === true,
    author: parseAuthor(v.author),
    isOp: v.is_op === true,
    best: v.best === true,
    helpful: num(v.helpful),
    myHelpful: v.my_helpful === true,
    mine: v.mine === true,
    edited: v.edited === true,
    createdAt: str(v.created_at),
    quote: q ? { id: str(q.id), label: str(q.label), excerpt: str(q.excerpt) } : null,
  };
}

/** The sentence for every way a Community call can fail. */
export function forumMessage(error: { message?: string; code?: string } | null): string {
  const m = error?.message ?? '';
  const problem = /Community: (\w+)/.exec(m)?.[1];
  if (/Community limit: slow down/.test(m)) return 'Give it a minute before posting again.';
  if (/Community limit: posts/.test(m)) return 'You have posted a lot today. Try again tomorrow.';
  if (/Community limit: replies/.test(m)) return 'You have replied a lot today. Try again tomorrow.';
  if (/Community text: words/.test(m)) return 'Please keep it respectful. Remove the offensive words.';
  if (/Community text: links/.test(m)) return 'Up to 3 links in one post.';
  if (/Community text: contact/.test(m))
    return 'Phone numbers and contact requests are not allowed. Keep the talk here.';
  if (/Community text: drugs/.test(m)) return 'Selling or sourcing drugs is not allowed.';
  if (/Too many reports/.test(m)) return 'You have sent a lot of reports today. We are on them.';
  switch (problem) {
    case 'paused':
      return 'Posting is paused for a short while. Reading still works.';
    case 'banned':
      return 'Your account can no longer post in Community.';
    case 'muted':
      return 'Your account is muted in Community for now.';
    case 'username':
      return 'Choose a username first.';
    case 'rules':
      return 'Please accept the Community rules first.';
    case 'minor':
      return 'Community is read-only for members under 18.';
    case 'title':
      return `Give it a title of 3 to ${LIMITS.title} characters.`;
    case 'body':
      return 'That is too long. Shorten it a little.';
    case 'own':
      return 'That is your own.';
    case 'not':
      if (/not eligible/.test(m)) return 'Not there yet. Keep helping people.';
      return 'This is no longer available.';
    case 'photos':
      return /paused/.test(m) ? 'Photo uploads are paused for a short while.' : `Up to ${LIMITS.photos} photos.`;
    default:
      break;
  }
  if (/check constraint/.test(m)) return 'One of the photos could not be used. Try another.';
  if (error?.code === 'PGRST202' || /does not exist|Could not find the function/i.test(m))
    return 'Community is not available yet. Please try again later.';
  return 'Could not reach Macrotrophy. Check your connection and try again.';
}

async function call<T>(fn: string, args: Record<string, unknown>, parse: (v: unknown) => T) {
  if (!supabase) throw new CommunityError('Accounts are not set up in this version of the app.');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new CommunityError(forumMessage(error));
  return parse(data);
}

export const getMe = () =>
  call('forum_me', {}, (v): Me => {
    const m = obj(v);
    return {
      username: typeof m.username === 'string' ? m.username : null,
      avatar: isSafeAvatar(m.avatar) ? m.avatar : null,
      verified: m.verified === true,
      rulesAccepted: m.rules_accepted === true,
      problem: (typeof m.problem === 'string' ? m.problem : null) as WriteProblem,
      mutedUntil: typeof m.muted_until === 'string' ? m.muted_until : null,
      enabled: m.enabled !== false,
      photos: m.photos !== false,
      rewards: m.rewards !== false,
      unread: num(m.unread),
      karma: num(m.karma),
    };
  });

export interface FeedPage {
  items: Post[];
  next: string | null;
  paused: boolean;
}

export const getFeed = (opts: {
  mode: FeedMode;
  topic?: Topic | null;
  kind?: PostKind | null;
  query?: string;
  cursor?: string | null;
}) =>
  call(
    'forum_feed',
    {
      p_mode: opts.mode,
      p_topic: opts.topic ?? null,
      p_kind: opts.kind ?? null,
      p_query: opts.query?.trim() || null,
      p_cursor: opts.cursor ?? null,
    },
    (v): FeedPage => {
      const f = obj(v);
      return {
        items: arr(f.items).map(parsePost),
        next: typeof f.next === 'string' ? f.next : null,
        paused: f.paused === true,
      };
    },
  );

export const getPost = (id: string) =>
  call('forum_post', { p_id: id }, (v): PostDetail => {
    const p = obj(v);
    return { ...parsePost(p), replyList: arr(p.reply_list).map(parseReply) };
  });

export const getPhoto = (id: string) =>
  call('forum_photo', { p_id: id }, (v) => (isJpeg(v) ? v : null));

export interface HomeCommunity {
  paused: boolean;
  unread: number;
  unanswered: number;
  posts: Post[];
}

export const getHome = () =>
  call('forum_home', {}, (v): HomeCommunity => {
    const h = obj(v);
    return {
      paused: h.paused === true,
      unread: num(h.unread),
      unanswered: num(h.unanswered),
      posts: arr(h.posts).map(parsePost),
    };
  });

export const getUnread = () => call('forum_unread', {}, num);

export const getProfile = (username: string) =>
  call('forum_profile', { p_username: username }, (v): Profile => {
    const p = obj(v);
    return {
      username: str(p.username),
      avatar: isSafeAvatar(p.avatar) ? p.avatar : null,
      verified: p.verified === true,
      me: p.me === true,
      banned: p.banned === true,
      joined: typeof p.joined === 'string' ? p.joined : null,
      recognition: p.recognition === 'trusted' || p.recognition === 'helpful' ? p.recognition : null,
      karma: typeof p.karma === 'number' ? p.karma : null,
      answers: num(p.answers),
      posts: arr(p.posts).map(parsePost),
      replies: arr(p.replies)
        .slice(0, 10)
        .map((r) => ({
          id: str(r.id),
          postId: str(r.post_id),
          postTitle: str(r.post_title),
          body: str(r.body),
          helpful: num(r.helpful),
          best: r.best === true,
          createdAt: str(r.created_at),
        })),
    };
  });

export const getMinePosts = (tab: 'posts' | 'saved' | 'following') =>
  call('forum_mine', { p_tab: tab }, (v) => arr(v).map(parsePost));

export const getMineReplies = () =>
  call('forum_mine', { p_tab: 'replies' }, (v) =>
    arr(v).map(
      (r): MyReply => ({
        id: str(r.id),
        postId: str(r.post_id),
        postTitle: str(r.post_title),
        body: str(r.body),
        anonymous: r.anonymous === true,
        helpful: num(r.helpful),
        best: r.best === true,
        held: r.held === true,
        createdAt: str(r.created_at),
      }),
    ),
  );

export const getActivity = () =>
  call('forum_activity_list', {}, (v) =>
    arr(v).map(
      (a): ActivityItem => ({
        id: num(a.id),
        kind: (str(a.kind) || 'reply') as ActivityItem['kind'],
        postId: typeof a.post_id === 'string' ? a.post_id : null,
        postTitle: typeof a.post_title === 'string' ? a.post_title : null,
        actor: str(a.actor),
        detail: str(a.detail),
        createdAt: str(a.created_at),
        read: a.read === true,
      }),
    ),
  );

export const markActivityRead = () => call('forum_activity_read', {}, () => true);

export const acceptRules = () => call('forum_accept_rules', {}, () => true);

export interface NewPhoto {
  full: string;
  thumb: string;
  w: number;
  h: number;
}

export const createPost = (p: {
  clientId: string;
  kind: PostKind;
  topic: Topic;
  title: string;
  body: string;
  anonymous: boolean;
  photos: NewPhoto[];
  card: 'workouts_30' | 'workouts_90' | 'workouts_365' | 'workouts_all' | null;
}) =>
  call(
    'forum_create_post',
    {
      p_client: p.clientId,
      p_kind: p.kind,
      p_topic: p.topic,
      p_title: p.title,
      p_body: p.body,
      p_anonymous: p.anonymous,
      p_media: p.photos,
      p_card: p.card,
    },
    str,
  );

export const createReply = (r: {
  clientId: string;
  postId: string;
  body: string;
  anonymous: boolean;
  quote: string | null;
}) =>
  call(
    'forum_reply',
    {
      p_client: r.clientId,
      p_post: r.postId,
      p_body: r.body,
      p_anonymous: r.anonymous,
      p_quote: r.quote,
    },
    str,
  );

export const editPost = (id: string, title: string, body: string, topic: Topic) =>
  call('forum_edit_post', { p_id: id, p_title: title, p_body: body, p_topic: topic }, () => true);

export const editReply = (id: string, body: string) =>
  call('forum_edit_reply', { p_id: id, p_body: body }, () => true);

export const deleteContent = (kind: 'post' | 'reply', id: string) =>
  call('forum_delete', { p_kind: kind, p_id: id }, () => true);

export const react = (
  kind: 'post' | 'reply',
  id: string,
  reaction: 'helpful' | 'support',
  on: boolean,
) =>
  call('forum_react', { p_kind: kind, p_id: id, p_reaction: reaction, p_on: on }, (v) => {
    const r = obj(v);
    return { helpful: num(r.helpful), support: num(r.support) };
  });

export const chooseBest = (postId: string, replyId: string | null) =>
  call('forum_best_answer', { p_post: postId, p_reply: replyId }, () => true);

export const setPostFlag = (postId: string, what: 'save' | 'follow' | 'hide', on: boolean) =>
  call('forum_set', { p_post: postId, p_what: what, p_on: on }, () => true);

export const block = (kind: 'post' | 'reply' | 'member', id: string | null, username?: string) =>
  call('forum_block', { p_kind: kind, p_id: id, p_username: username ?? null }, () => true);

export const getBlocks = () =>
  call('forum_blocks_list', {}, (v) =>
    arr(v).map((b) => ({ id: str(b.id), label: str(b.label), createdAt: str(b.created_at) })),
  );

export const unblock = (id: string) => call('forum_unblock', { p_id: id }, () => true);

export type ReportReason =
  | 'harassment'
  | 'explicit'
  | 'spam'
  | 'health_risk'
  | 'self_harm'
  | 'privacy'
  | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: 'harassment', label: 'Harassment or hate', hint: 'Bullying, threats, body shaming' },
  { id: 'explicit', label: 'Explicit or intimate image', hint: 'Nudity or a photo shared without consent' },
  { id: 'spam', label: 'Spam or scam', hint: 'Selling, promotion, fake karma' },
  { id: 'health_risk', label: 'Risky health advice', hint: 'Crash diets, drug sourcing, dangerous claims' },
  { id: 'self_harm', label: 'Someone may be at risk', hint: 'Self-harm or an eating disorder concern' },
  { id: 'privacy', label: 'Private information', hint: 'Someone else’s photo, name or details' },
  { id: 'other', label: 'Something else', hint: 'Tell us in a note' },
];

export const report = (
  kind: 'post' | 'reply' | 'media' | 'member',
  id: string | null,
  reason: ReportReason,
  note: string,
  username?: string,
) =>
  call(
    'forum_report',
    { p_kind: kind, p_id: id, p_username: username ?? null, p_reason: reason, p_note: note },
    () => true,
  );

export const getKarma = () =>
  call('forum_my_karma', {}, (v): Karma => {
    const k = obj(v);
    const lc = k.last_claim ? obj(k.last_claim) : null;
    const rules = obj(k.rules) as unknown as RewardRules;
    return {
      lifetime: num(k.lifetime),
      qualifying: num(k.qualifying),
      rules,
      bestAnswers: num(k.best_answers),
      helpfulVoters: num(k.helpful_voters),
      replies: num(k.replies),
      replyThreads: num(k.reply_threads),
      activeDays: num(k.active_days),
      accountDays: num(k.account_days),
      confirmed: k.confirmed === true,
      rulesAccepted: k.rules_accepted === true,
      inGoodStanding: k.in_good_standing !== false,
      eligible: k.eligible === true,
      rewardsOn: k.rewards_on !== false,
      lastClaim: lc
        ? {
            status: (str(lc.status) || 'applied') as 'applied' | 'held' | 'revoked',
            claimedAt: str(lc.claimed_at),
            proUntil: typeof lc.pro_until === 'string' ? lc.pro_until : null,
          }
        : null,
      nextClaimAt: typeof k.next_claim_at === 'string' ? k.next_claim_at : null,
      history: arr(k.history).map((h) => ({
        delta: num(h.delta),
        source: str(h.source),
        createdAt: str(h.created_at),
      })),
    };
  });

export const claimReward = (clientId: string) =>
  call('forum_claim_reward', { p_client: clientId }, (v) => {
    const r = obj(v);
    return {
      status: (str(r.status) || 'applied') as 'applied' | 'held',
      proUntil: typeof r.pro_until === 'string' ? r.pro_until : null,
      days: num(r.days),
    };
  });

/** "now", "5m", "3h", "2d", then a date. */
export function ago(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Tracking parameters come off before a link is followed. */
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw.replace(/[).,!?]+$/, ''));
    for (const k of [...u.searchParams.keys()])
      if (/^(utm_|fbclid|gclid|igshid|ref$|ref_|aff|affiliate|tag$)/i.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return '#';
  }
}
