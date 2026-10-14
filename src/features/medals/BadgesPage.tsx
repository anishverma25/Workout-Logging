import { useMemo, useState } from 'react';
import { Share } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { BottomSheet, PrimaryButton, ProgressBar } from '@/components/kit';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { usePreferences, useTrainingData } from '@/data/hooks';
import {
  computeBadges,
  GROUP_LABELS,
  type Badge,
  type BadgeGroup,
} from '@/domain/achievements/badges';
import { buildSessions } from '@/domain/analytics/sessions';
import { formatCalendarDate } from '@/lib/format/dates';
import { useNow } from '@/lib/useNow';
import { ShareSheet } from '../share/ShareSheet';
import { BadgeMedallion } from './BadgeMedallion';

const GROUP_ORDER: BadgeGroup[] = ['workouts', 'streaks', 'medals', 'plates', 'tonnage', 'habits'];

const TIER_LABEL: Record<Badge['tier'], string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  legend: 'Legend',
};

/** Every badge, earned ones in their metal and the rest with how close they are. */
export function BadgesPage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const now = useNow();
  const data = training.data;
  const badges = useMemo(
    () =>
      data
        ? computeBadges({
            sessions: buildSessions(data),
            exercises: data.exercises,
            bodyWeights: data.bodyWeights,
            now,
            weekStartsOn: prefs.weekStartsOn,
          })
        : [],
    [data, now, prefs.weekStartsOn],
  );
  const [open, setOpen] = useState<Badge | null>(null);
  const [sharing, setSharing] = useState<Badge | null>(null);

  const earned = badges.filter((b) => b.earnedAt);
  const latest = [...earned].sort((a, b) => b.earnedAt!.getTime() - a.earnedAt!.getTime())[0];
  const next = badges
    .filter((b) => !b.earnedAt && b.current > 0)
    .sort((a, b) => b.current / b.target - a.current / a.target)
    .slice(0, 3);

  return (
    <>
      <PageHeader
        back={{ to: '/more', label: 'More' }}
        title="Badges"
        subtitle={
          badges.length
            ? `${earned.length} of ${badges.length} earned`
            : 'Earned from your workouts'
        }
      />
      {training.status === 'loading' ? <Skeleton className="h-96 rounded-panel" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}

      {latest ? (
        <button
          type="button"
          onClick={() => setOpen(latest)}
          className="pressable flex w-full items-center gap-4 rounded-panel border border-border bg-surface p-4 text-left"
        >
          <BadgeMedallion badge={latest} className="size-20" />
          <span className="min-w-0">
            <span className="type-caption block font-semibold text-gold">Latest unlock</span>
            <span className="type-title block text-text-1">{latest.title}</span>
            <span className="type-meta block text-text-2">
              {formatCalendarDate(latest.earnedAt!)} · tap to share
            </span>
          </span>
        </button>
      ) : null}

      {next.length > 0 ? (
        <section aria-labelledby="next-title" className="mt-6">
          <h2 id="next-title" className="type-title text-text-1">
            Almost there
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {next.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setOpen(b)}
                  className="pressable flex w-full items-center gap-3 rounded-panel bg-surface p-3 text-left"
                >
                  <BadgeMedallion badge={b} className="size-12" />
                  <span className="min-w-0 flex-1">
                    <span className="type-headline block text-text-1">{b.title}</span>
                    <span className="type-meta tabular block text-text-2">
                      {b.current.toLocaleString('en-GB')} of {b.target.toLocaleString('en-GB')} ·{' '}
                      {b.goal}
                    </span>
                    <ProgressBar
                      value={b.current}
                      max={b.target}
                      label={`${b.title} progress`}
                      className="mt-2"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {GROUP_ORDER.map((group) => {
        const list = badges.filter((b) => b.group === group);
        if (list.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`g-${group}`} className="mt-8">
            <h2 id={`g-${group}`} className="type-title text-text-1">
              {GROUP_LABELS[group]}
              <span className="type-meta tabular ml-2 text-text-2">
                {list.filter((b) => b.earnedAt).length}/{list.length}
              </span>
            </h2>
            <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(b)}
                    aria-label={`${b.title}, ${b.earnedAt ? `earned ${formatCalendarDate(b.earnedAt)}` : `locked, ${b.current} of ${b.target}`}`}
                    className="pressable flex w-full flex-col items-center gap-1.5 rounded-nested px-1 py-2 text-center"
                  >
                    <BadgeMedallion badge={b} className="size-20" />
                    <span
                      className={`type-caption line-clamp-2 font-semibold ${b.earnedAt ? 'text-text-1' : 'text-text-2'}`}
                    >
                      {b.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? 'Badge'}>
        {open ? (
          <div className="flex flex-col items-center pt-2 pb-1 text-center">
            <BadgeMedallion badge={open} className="size-40" />
            <p className="type-caption mt-3 font-semibold text-text-2">
              {TIER_LABEL[open.tier]} · {GROUP_LABELS[open.group]}
            </p>
            <p className="type-body mt-1 text-text-1">{open.goal}.</p>
            {open.earnedAt ? (
              <>
                <p className="type-meta mt-1 text-text-2">
                  Earned {formatCalendarDate(open.earnedAt)}
                </p>
                <PrimaryButton
                  block
                  icon={<Share aria-hidden />}
                  className="mt-5"
                  onClick={() => {
                    setSharing(open);
                    setOpen(null);
                  }}
                >
                  Share to your story
                </PrimaryButton>
              </>
            ) : (
              <div className="mt-4 w-full">
                <ProgressBar
                  value={open.current}
                  max={open.target}
                  label={`${open.title} progress`}
                />
                <p className="type-meta tabular mt-2 text-text-2">
                  {open.current.toLocaleString('en-GB')} of {open.target.toLocaleString('en-GB')}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </BottomSheet>
      {sharing ? (
        <ShareSheet
          workoutId={sharing.workoutId}
          badgeId={sharing.id}
          open
          onClose={() => setSharing(null)}
        />
      ) : null}
    </>
  );
}
