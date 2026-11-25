import { useState } from 'react';
import { ShieldCheck, UsersRound } from 'lucide-react';
import { acceptRules, type Me } from '@/app/forum';
import { InlineNotice, PrimaryButton } from '@/components/kit';
import { UsernameForm } from '@/features/groups/parts';
import { CommunityMark } from './parts';
import { RULES } from './rules';

/** The rules, accepted once. */
export function RulesCard({ onAccepted }: { onAccepted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="rounded-panel bg-surface px-5 pt-6 pb-5" aria-labelledby="rules-title" data-rules>
      <CommunityMark size={48} />
      <h2 id="rules-title" className="type-title mt-3 text-text-1">
        Community rules
      </h2>
      <p className="type-subhead mt-1 text-text-2">A helpful gym community, not another noisy feed.</p>
      <ol className="mt-4 flex flex-col gap-3">
        {RULES.map((r, i) => (
          <li key={r.title} className="flex gap-3">
            <span className="type-caption tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-dim font-bold text-lime">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="type-headline block text-text-1">{r.title}</span>
              <span className="type-subhead block text-text-2">{r.line}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="type-meta mt-4 flex items-start gap-2 text-text-3">
        <ShieldCheck className="mt-px size-4 shrink-0" aria-hidden />
        Posting anonymously hides your username from members, not from Macrotrophy. Breaking the
        rules can end your access to Community, whichever way you posted.
      </p>
      {error ? (
        <InlineNotice tone="warning" className="mt-3">
          {error}
        </InlineNotice>
      ) : null}
      <PrimaryButton
        className="mt-5 w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await acceptRules();
            onAccepted();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save. Try again.');
            setBusy(false);
          }
        }}
        data-accept-rules
      >
        I agree
      </PrimaryButton>
    </section>
  );
}

/**
 * What stands between this member and posting: a username, the rules, or a plain reason they
 * cannot post (paused, banned, muted, under 18). Null when they can post.
 */
export function WriteGate({ me, onChanged }: { me: Me; onChanged: () => void }) {
  if (me.problem === 'username')
    return (
      <section className="rounded-panel bg-surface px-5 pt-6 pb-6" aria-labelledby="pick-name" data-pick-username>
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-lime-dim text-lime">
          <UsersRound className="size-6" />
        </span>
        <h2 id="pick-name" className="type-title mt-3 text-text-1">
          First, pick a username
        </h2>
        <p className="type-body mt-1 mb-4 text-text-2">
          Members see it on what you post with your name. You can still post anonymously any time.
        </p>
        <UsernameForm submitLabel="Continue" onSaved={onChanged} />
      </section>
    );
  if (me.problem === 'rules') return <RulesCard onAccepted={onChanged} />;
  const text =
    me.problem === 'paused'
      ? 'Posting is paused for a short while. You can still read everything.'
      : me.problem === 'banned'
        ? 'Your account can no longer post in Community. To appeal, send feedback from More.'
        : me.problem === 'muted'
          ? `Your account is muted in Community${me.mutedUntil ? ` until ${new Date(me.mutedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}. You can still read.`
          : me.problem === 'minor'
            ? 'Community is read-only for members under 18. You can read and save posts.'
            : me.problem === 'signed_out'
              ? 'Sign in to take part.'
              : null;
  if (!text) return null;
  return (
    <div data-write-blocked={me.problem}>
      <InlineNotice tone="info">{text}</InlineNotice>
    </div>
  );
}
