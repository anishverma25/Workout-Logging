import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { useRemote } from '@/app/community';
import { getHome } from '@/app/forum';
import { AuthorName, CommunityMark } from './parts';

/**
 * The Community banner on Home, under the leaderboards: what is waiting for you (new replies),
 * else questions that need an answer, else an invitation, and the freshest thread. Silent when
 * the server cannot be reached, so Home never waits on it.
 */
export function CommunityHomeBanner() {
  const home = useRemote(getHome, 'home-community');
  const h = home.data;
  if (!h || h.paused) return null;
  const latest = h.posts[0];
  const line = h.unread
    ? `${h.unread} new ${h.unread === 1 ? 'reply' : 'replies'} for you`
    : h.unanswered
      ? `${h.unanswered} ${h.unanswered === 1 ? 'question needs' : 'questions need'} an answer`
      : 'Ask a question or share your journey';
  return (
    <Link
      to="/community"
      state={{ from: 'home' }}
      className="pressable chrome relative flex flex-col gap-3 overflow-hidden rounded-card bg-surface bg-[radial-gradient(60%_70%_at_100%_0%,var(--lime-dim),transparent_70%)] p-4 ring-1 ring-lime/20"
      data-home-community
    >
      <span className="relative flex items-center gap-3">
        <span className="relative">
          <CommunityMark size={44} />
          {h.unread ? (
            <span
              aria-hidden
              className="type-caption tabular absolute -top-1 -right-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-text-1 px-1 font-bold text-bg ring-2 ring-surface"
            >
              {h.unread > 9 ? '9+' : h.unread}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="type-headline block text-text-1">Community</span>
          <span className="type-subhead tabular block truncate text-text-2">{line}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
      </span>
      {latest ? (
        <span className="relative flex items-start gap-2.5 rounded-tile bg-surface-2 px-3 py-2.5">
          <span className="type-meta shrink-0 rounded-full bg-lime-dim px-2 py-px font-semibold text-lime">
            {latest.kind === 'question' ? 'Asked' : 'Shared'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="type-subhead line-clamp-1 block font-medium text-text-1">
              {latest.title}
            </span>
            <span className="type-meta flex min-w-0 items-center gap-1 text-text-3">
              <AuthorName author={latest.author} link={false} className="text-text-3" />
              <span className="shrink-0">
                · {latest.replies} {latest.replies === 1 ? 'reply' : 'replies'}
              </span>
            </span>
          </span>
        </span>
      ) : null}
    </Link>
  );
}
