import { useEffect, useMemo, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { BottomSheet, ChipGroup, PrimaryButton, SecondaryButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { badgesEarnedIn, computeBadges } from '@/domain/achievements/badges';
import { buildSessions } from '@/domain/analytics/sessions';
import { bestBadge, medalsCard, prCard, streakCard, workoutCard } from '@/domain/share/cards';
import { prStory, streakStory, workoutStory, type StoryContent } from '@/domain/share/story';
import {
  CARD_H,
  CARD_W,
  drawBadgeCard,
  drawMedalsCard,
  loadCardFonts,
  type CardContext,
} from './draw';
import { StoryEditor } from './story/StoryEditor';

/** Workout, record and streak cards are made in the story editor; medals and badges are drawn. */
type Kind = 'workout' | 'pr' | 'streak' | 'medals' | 'badge';
const EDITABLE: Kind[] = ['workout', 'pr', 'streak'];

const LABELS: Record<Kind, string> = {
  workout: 'Workout',
  pr: 'New record',
  streak: 'Streak',
  medals: 'Medals',
  badge: 'Badge',
};

/**
 * Story cards: for a workout, pick one and share it or save the image; for a badge
 * (`badgeId`), its own card.
 */
export function ShareSheet({
  workoutId,
  badgeId,
  open,
  onClose,
}: {
  workoutId: string | null;
  badgeId?: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Share to your story"
      subtitle="Instagram story or WhatsApp status"
      tall
    >
      {open ? <ShareForm workoutId={workoutId} badgeId={badgeId} /> : null}
    </BottomSheet>
  );
}

function ShareForm({ workoutId, badgeId }: { workoutId: string | null; badgeId?: string }) {
  const training = useTrainingData();
  const prefs = usePreferences();
  const toast = useToast();
  const data = training.data;

  const cards = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const badges = computeBadges({
      sessions: buildSessions(data),
      exercises: data.exercises,
      bodyWeights: data.bodyWeights,
      now,
      weekStartsOn: prefs.weekStartsOn,
    });
    const workout = workoutId ? workoutCard(data, workoutId) : null;
    return {
      workout,
      pr: workoutId ? prCard(data, workoutId) : null,
      medals: workoutId ? medalsCard(data, workoutId) : null,
      streak: streakCard(data, now, prefs.weekStartsOn),
      badge: badgeId
        ? (badges.find((b) => b.id === badgeId && b.earnedAt) ?? null)
        : workoutId
          ? (bestBadge(badgesEarnedIn(badges, workoutId)) ?? null)
          : null,
    };
  }, [data, workoutId, badgeId, prefs.weekStartsOn]);

  const kinds = useMemo<Kind[]>(() => {
    if (!cards) return [];
    if (badgeId) return cards.badge ? ['badge'] : [];
    const out: Kind[] = [];
    if (cards.workout) out.push('workout');
    if (cards.pr) out.push('pr');
    if (cards.streak && cards.streak.weeks >= 2) out.push('streak');
    if (cards.medals && cards.medals.medals.length >= 2) out.push('medals');
    if (cards.badge) out.push('badge');
    return out;
  }, [cards, badgeId]);

  const [picked, setPicked] = useState<Kind | null>(null);
  const kind = picked ?? kinds[0] ?? null;
  const [image, setImage] = useState<{ kind: Kind; blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const first = data?.profile?.displayName?.trim().split(/\s+/)[0] || null;
  const context = useMemo<CardContext>(
    () => ({ person: first, unit: prefs.weightUnit, link: window.location.host }),
    [first, prefs.weightUnit],
  );

  const story = useMemo<StoryContent | null>(() => {
    if (!cards || !kind) return null;
    if (kind === 'workout' && cards.workout)
      return workoutStory(cards.workout, { unit: prefs.weightUnit, streakWeeks: cards.streak?.weeks ?? null });
    if (kind === 'pr' && cards.pr) return prStory(cards.pr, { unit: prefs.weightUnit });
    if (kind === 'streak' && cards.streak) return streakStory(cards.streak, new Date());
    return null;
  }, [cards, kind, prefs.weightUnit]);

  // Medals and badges: draw the card into an image.
  useEffect(() => {
    if (!cards || !kind || EDITABLE.includes(kind)) return;
    let cancelled = false;
    let made: string | null = null;
    void (async () => {
      await loadCardFonts();
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (kind === 'medals' && cards.medals) drawMedalsCard(ctx, cards.medals, context);
      else if (kind === 'badge' && cards.badge) drawBadgeCard(ctx, cards.badge, context);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob || cancelled) return;
      made = URL.createObjectURL(blob);
      setImage({ kind, blob, url: made });
    })();
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [cards, kind, context]);

  if (training.status === 'loading')
    return <p className="type-body py-6 text-text-2">Loading...</p>;
  if (!cards || !kind)
    return <p className="type-body py-6 text-text-2">This workout cannot be shared.</p>;

  const fileName = `macrotrophy-${kind}-${(badgeId ?? workoutId ?? 'card').slice(0, 12)}.png`;
  const chips =
    kinds.length > 1 ? (
      <ChipGroup
        label="Card"
        scroll
        value={kind}
        onChange={setPicked}
        options={kinds.map((k) => ({ value: k, label: LABELS[k] }))}
      />
    ) : null;

  if (story)
    return (
      <div className="flex flex-col gap-3">
        {chips}
        <StoryEditor key={kind} content={story} name={first} fileName={fileName} />
      </div>
    );

  const ready = image && image.kind === kind ? image : null;
  const file = ready ? new File([ready.blob], fileName, { type: 'image/png' }) : null;
  const canShareFile =
    !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  async function share() {
    if (!file) return;
    setBusy(true);
    try {
      // The image only: Instagram drops shares that carry text with the file.
      await navigator.share({ files: [file] });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        toast('Could not open sharing. Save the image and post it from your gallery.');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!ready) return;
    const a = document.createElement('a');
    a.href = ready.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Image saved');
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      {chips}
      <div className="flex justify-center">
        <div
          className="relative aspect-[9/16] w-[min(15rem,60vw)] overflow-hidden rounded-nested bg-surface-2 supports-[height:1dvh]:max-h-[52dvh]"
          aria-live="polite"
        >
          {ready ? (
            <img
              src={ready.url}
              alt={`${LABELS[kind]} card for your story`}
              className="size-full object-contain"
            />
          ) : (
            <span className="type-meta absolute inset-0 flex items-center justify-center text-text-2">
              Making your card...
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 pb-1">
        {canShareFile ? (
          <PrimaryButton
            block
            icon={<Share aria-hidden />}
            loading={busy}
            onClick={() => void share()}
          >
            Share
          </PrimaryButton>
        ) : null}
        <SecondaryButton block icon={<Download aria-hidden />} disabled={!ready} onClick={save}>
          Save image
        </SecondaryButton>
        <p className="type-meta text-center text-text-2">
          {canShareFile
            ? 'Pick Instagram and then Story, or WhatsApp and then My status.'
            : 'Save it, then add it to your Instagram story or WhatsApp status from your photos.'}
        </p>
      </div>
    </div>
  );
}
